// src/app/api/orders/[id]/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/orders/:id/timeline - Get order timeline
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id: userId, role } = authResult.user;
    
    // Verify access
    const where: any = { id: params.id };
    if (role === 'CUSTOMER') where.customer_id = userId;
    else if (role === 'LAUNDRY') where.laundry_id = userId;
    
    const order = await prisma.order.findFirst({
      where,
      select: { id: true },
    });
    
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    
    const timeline = await prisma.orderTimeline.findMany({
      where: { order_id: params.id },
      orderBy: { timestamp: 'desc' },
    });
    
    return NextResponse.json({
      success: true,
      data: { timeline },
    });
  } catch (error) {
    console.error('Get Timeline Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch timeline' }, { status: 500 });
  }
}
