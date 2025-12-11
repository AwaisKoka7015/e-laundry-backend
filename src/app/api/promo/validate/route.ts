// src/app/api/promo/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { validatePromoSchema } from '@/types';

// POST /api/promo/validate - Validate promo code
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'CUSTOMER') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const validation = validatePromoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.errors }, { status: 400 });
    }
    
    const { code, order_amount, laundry_id } = validation.data;
    
    // Find promo code
    const promo = await prisma.promoCode.findFirst({
      where: {
        code: code.toUpperCase(),
        is_active: true,
        valid_from: { lte: new Date() },
        valid_until: { gte: new Date() },
      },
    });
    
    if (!promo) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired promo code', code: 'INVALID_PROMO' },
        { status: 400 }
      );
    }
    
    // Check usage limit
    if (promo.usage_limit && promo.used_count >= promo.usage_limit) {
      return NextResponse.json(
        { success: false, error: 'Promo code usage limit reached', code: 'LIMIT_REACHED' },
        { status: 400 }
      );
    }
    
    // Check minimum order amount
    if (order_amount < promo.min_order_amount) {
      return NextResponse.json(
        { success: false, error: `Minimum order amount is Rs ${promo.min_order_amount}`, code: 'MIN_AMOUNT_NOT_MET' },
        { status: 400 }
      );
    }
    
    // Check first order only
    if (promo.first_order_only) {
      const existingOrders = await prisma.order.count({
        where: { customer_id: authResult.user.id, status: { not: 'CANCELLED' } },
      });
      if (existingOrders > 0) {
        return NextResponse.json(
          { success: false, error: 'This promo code is only valid for first orders', code: 'FIRST_ORDER_ONLY' },
          { status: 400 }
        );
      }
    }
    
    // Check specific laundry restriction
    if (promo.specific_laundries && laundry_id) {
      const laundries = promo.specific_laundries as string[];
      if (!laundries.includes(laundry_id)) {
        return NextResponse.json(
          { success: false, error: 'This promo code is not valid for this laundry', code: 'LAUNDRY_NOT_ELIGIBLE' },
          { status: 400 }
        );
      }
    }
    
    // Calculate discount
    let discount: number;
    if (promo.discount_type === 'PERCENTAGE') {
      discount = (order_amount * promo.discount_value) / 100;
      if (promo.max_discount && discount > promo.max_discount) {
        discount = promo.max_discount;
      }
    } else {
      discount = promo.discount_value;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Promo code is valid',
      data: {
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        max_discount: promo.max_discount,
        calculated_discount: Math.round(discount),
        final_amount: Math.round(order_amount - discount),
      },
    });
  } catch (error) {
    console.error('Validate Promo Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to validate promo' }, { status: 500 });
  }
}
