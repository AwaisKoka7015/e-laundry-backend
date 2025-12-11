// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { createOrderSchema } from '@/types';
import { generateOrderNumber, calculateEstimatedDelivery, getTimelineEvent } from '@/lib/order-utils';

// GET /api/orders - List customer's orders
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'CUSTOMER') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const where: any = { customer_id: authResult.user.id };
    if (status) where.status = status;
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          laundry: { select: { id: true, laundry_name: true, laundry_logo: true, phone_number: true } },
          items: {
            include: {
              clothing_item: { select: { name: true, type: true } },
              laundry_service: { select: { name: true, category: { select: { name: true } } } },
            },
          },
          review: { select: { id: true, rating: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);
    
    return NextResponse.json({
      success: true,
      data: { orders },
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit), has_more: page * limit < total },
    });
  } catch (error) {
    console.error('Get Orders Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST /api/orders - Create new order
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'CUSTOMER') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const validation = createOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.errors }, { status: 400 });
    }
    
    const data = validation.data;
    
    // Verify laundry exists
    const laundry = await prisma.laundry.findUnique({
      where: { id: data.laundry_id, status: 'ACTIVE' },
    });
    if (!laundry) {
      return NextResponse.json({ success: false, error: 'Laundry not found' }, { status: 404 });
    }
    
    // Calculate pricing
    let subtotal = 0;
    let maxEstimatedHours = 24;
    const orderItems: any[] = [];
    
    for (const item of data.items) {
      const pricing = await prisma.servicePricing.findFirst({
        where: {
          laundry_service_id: item.service_id,
          clothing_item_id: item.clothing_item_id,
          is_available: true,
        },
        include: { laundry_service: true },
      });
      
      if (!pricing) {
        return NextResponse.json(
          { success: false, error: `Pricing not found for item: ${item.clothing_item_id}` },
          { status: 400 }
        );
      }
      
      const unitPrice = data.order_type === 'EXPRESS' && pricing.express_price
        ? pricing.express_price
        : pricing.price;
      
      let totalPrice: number;
      if (pricing.price_unit === 'PER_KG' && item.weight_kg) {
        totalPrice = unitPrice * item.weight_kg;
      } else {
        totalPrice = unitPrice * item.quantity;
      }
      
      subtotal += totalPrice;
      maxEstimatedHours = Math.max(maxEstimatedHours, pricing.laundry_service.estimated_hours);
      
      orderItems.push({
        laundry_service_id: item.service_id,
        clothing_item_id: item.clothing_item_id,
        quantity: item.quantity,
        weight_kg: item.weight_kg,
        unit_price: unitPrice,
        price_unit: pricing.price_unit,
        total_price: totalPrice,
        special_notes: item.special_notes,
      });
    }
    
    // Calculate fees
    const deliveryFee = subtotal >= 1000 ? 0 : 100; // Free delivery over Rs 1000
    const expressFee = data.order_type === 'EXPRESS' ? subtotal * 0.5 : 0;
    
    // Apply promo code if provided
    let discount = 0;
    if (data.promo_code) {
      const promo = await prisma.promoCode.findFirst({
        where: {
          code: data.promo_code,
          is_active: true,
          valid_until: { gte: new Date() },
          valid_from: { lte: new Date() },
        },
      });
      
      if (promo && subtotal >= promo.min_order_amount) {
        if (promo.discount_type === 'PERCENTAGE') {
          discount = (subtotal * promo.discount_value) / 100;
          if (promo.max_discount && discount > promo.max_discount) {
            discount = promo.max_discount;
          }
        } else {
          discount = promo.discount_value;
        }
        
        // Update promo usage
        await prisma.promoCode.update({
          where: { id: promo.id },
          data: { used_count: { increment: 1 } },
        });
      }
    }
    
    const totalAmount = subtotal + deliveryFee + expressFee - discount;
    
    // Generate order number
    const orderNumber = await generateOrderNumber();
    
    // Calculate estimated delivery
    const pickupDate = new Date(data.pickup_date);
    const expectedDelivery = calculateEstimatedDelivery(pickupDate, maxEstimatedHours, data.order_type === 'EXPRESS');
    
    // Create order
    const order = await prisma.order.create({
      data: {
        order_number: orderNumber,
        customer_id: authResult.user.id,
        laundry_id: data.laundry_id,
        status: 'PENDING',
        order_type: data.order_type,
        
        pickup_address: data.pickup_address,
        pickup_latitude: data.pickup_latitude,
        pickup_longitude: data.pickup_longitude,
        pickup_date: pickupDate,
        pickup_time_slot: data.pickup_time_slot,
        pickup_notes: data.pickup_notes,
        
        delivery_address: data.delivery_address || data.pickup_address,
        delivery_latitude: data.delivery_latitude || data.pickup_latitude,
        delivery_longitude: data.delivery_longitude || data.pickup_longitude,
        delivery_notes: data.delivery_notes,
        expected_delivery_date: expectedDelivery,
        
        subtotal,
        delivery_fee: deliveryFee,
        express_fee: expressFee,
        discount,
        promo_code: data.promo_code,
        total_amount: totalAmount,
        
        special_instructions: data.special_instructions,
        
        items: { create: orderItems },
        
        timeline: {
          create: {
            ...getTimelineEvent('PENDING'),
            description: 'Order has been placed successfully',
          },
        },
        
        status_history: {
          create: {
            to_status: 'PENDING',
            changed_by: authResult.user.id,
            notes: 'Order created',
          },
        },
        
        payment: {
          create: {
            amount: totalAmount,
            payment_method: 'COD',
            payment_status: 'PENDING',
          },
        },
      },
      include: {
        laundry: { select: { id: true, laundry_name: true, laundry_logo: true, phone_number: true } },
        items: { include: { clothing_item: true, laundry_service: { include: { category: true } } } },
        payment: true,
      },
    });
    
    // TODO: Send notification to laundry
    
    return NextResponse.json({
      success: true,
      message: 'Order placed successfully',
      data: { order },
    }, { status: 201 });
  } catch (error) {
    console.error('Create Order Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create order' }, { status: 500 });
  }
}
