// src/app/api/orders/[id]/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { cancelOrderSchema } from '@/types';
import { canCancelOrder, getTimelineEvent } from '@/lib/order-utils';

// POST /api/orders/:id/cancel - Cancel order
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id: userId, role } = authResult.user;
    
    // Get order
    const where: any = { id: params.id };
    if (role === 'CUSTOMER') where.customer_id = userId;
    else if (role === 'LAUNDRY') where.laundry_id = userId;
    
    const order = await prisma.order.findFirst({ where });
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    
    // Check if cancellation is allowed
    const cancelCheck = canCancelOrder(order.status);
    if (!cancelCheck.allowed) {
      return NextResponse.json(
        { success: false, error: cancelCheck.reason, code: 'CANCEL_NOT_ALLOWED' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const validation = cancelOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.errors }, { status: 400 });
    }
    
    const { reason } = validation.data;
    
    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id: params.id },
      data: {
        status: 'CANCELLED',
        cancelled_at: new Date(),
        cancellation_reason: reason,
        cancelled_by: userId,
        
        timeline: {
          create: {
            ...getTimelineEvent('CANCELLED'),
            description: `Cancelled by ${role.toLowerCase()}: ${reason}`,
          },
        },
        
        status_history: {
          create: {
            from_status: order.status,
            to_status: 'CANCELLED',
            changed_by: userId,
            notes: reason,
          },
        },
      },
      include: {
        laundry: { select: { laundry_name: true } },
        customer: { select: { name: true } },
      },
    });
    
    // TODO: Send notification to other party
    
    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      data: { order: updatedOrder },
    });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to cancel order' }, { status: 500 });
  }
}
