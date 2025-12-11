// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/orders/:id - Get order details
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id, role } = authResult.user;
    
    // Build where clause based on role
    const where: any = { id: params.id };
    if (role === 'CUSTOMER') {
      where.customer_id = id;
    } else if (role === 'LAUNDRY') {
      where.laundry_id = id;
    }
    
    const order = await prisma.order.findFirst({
      where,
      include: {
        customer: { select: { id: true, name: true, phone_number: true, avatar: true } },
        laundry: { select: { id: true, laundry_name: true, laundry_logo: true, phone_number: true, address_text: true } },
        items: {
          include: {
            clothing_item: { select: { id: true, name: true, name_urdu: true, type: true } },
            laundry_service: { select: { id: true, name: true, category: { select: { name: true } } } },
          },
        },
        timeline: { orderBy: { timestamp: 'desc' } },
        payment: true,
        review: true,
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
