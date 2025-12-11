// src/app/api/laundry/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { updateOrderStatusSchema } from '@/types';
import { isValidStatusTransition, getTimelineEvent, updateLaundryStats } from '@/lib/order-utils';

// GET /api/laundry/orders/:id - Get order details
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const order = await prisma.order.findFirst({
      where: { id: params.id, laundry_id: authResult.user.id },
      include: {
        customer: { select: { id: true, name: true, phone_number: true, avatar: true, address_text: true } },
        items: {
          include: {
            clothing_item: true,
            laundry_service: { include: { category: true } },
          },
        },
        timeline: { orderBy: { timestamp: 'desc' } },
        payment: true,
      },
    });
    
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: { order } });
  } catch (error) {
    console.error('Get Order Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch order' }, { status: 500 });
  }
}

// PUT /api/laundry/orders/:id - Update order status
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const order = await prisma.order.findFirst({
      where: { id: params.id, laundry_id: authResult.user.id },
    });
    
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    
    const body = await request.json();
    const validation = updateOrderStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.errors }, { status: 400 });
    }
    
    const { status, notes } = validation.data;
    
    // Validate status transition
    if (!isValidStatusTransition(order.status, status)) {
      return NextResponse.json(
        { success: false, error: `Cannot change status from ${order.status} to ${status}`, code: 'INVALID_STATUS_TRANSITION' },
        { status: 400 }
      );
    }
    
    // Build update data
    const updateData: any = {
      status,
      updated_at: new Date(),
      timeline: {
        create: {
          ...getTimelineEvent(status),
          description: notes || `Status updated to ${status}`,
        },
      },
      status_history: {
        create: {
          from_status: order.status,
          to_status: status,
          changed_by: authResult.user.id,
          notes,
        },
      },
    };
    
    // Set timestamps based on status
    switch (status) {
      case 'ACCEPTED':
        updateData.accepted_at = new Date();
        break;
      case 'PICKED_UP':
        updateData.picked_up_at = new Date();
        break;
      case 'PROCESSING':
        updateData.processing_started_at = new Date();
        break;
      case 'READY':
        updateData.ready_at = new Date();
        break;
      case 'OUT_FOR_DELIVERY':
        updateData.out_for_delivery_at = new Date();
        break;
      case 'DELIVERED':
        updateData.delivered_at = new Date();
        updateData.actual_delivery_date = new Date();
        // Update payment status for COD
        if (order.payment_method === 'COD') {
          await prisma.payment.update({
            where: { order_id: params.id },
            data: { payment_status: 'COMPLETED', paid_at: new Date() },
          });
        }
        break;
    }
    
    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: updateData,
      include: {
        customer: { select: { id: true, name: true, phone_number: true } },
        items: { include: { clothing_item: true } },
      },
    });
    
    // Update laundry stats if order completed/delivered
    if (status === 'DELIVERED' || status === 'COMPLETED') {
      await updateLaundryStats(authResult.user.id);
    }
    
    // TODO: Send notification to customer
    
    return NextResponse.json({
      success: true,
      message: `Order status updated to ${status}`,
      data: { order: updatedOrder },
    });
  } catch (error) {
    console.error('Update Order Status Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}
