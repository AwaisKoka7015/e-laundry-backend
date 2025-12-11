// src/app/api/laundry/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/laundry/orders - Get laundry's orders
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const where: any = { laundry_id: authResult.user.id };
    if (status) {
      if (status === 'active') {
        where.status = { in: ['PENDING', 'ACCEPTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY'] };
      } else {
        where.status = status;
      }
    }
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone_number: true, avatar: true } },
          items: {
            include: {
              clothing_item: { select: { name: true, type: true } },
              laundry_service: { select: { name: true, category: { select: { name: true } } } },
            },
          },
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
    console.error('Get Laundry Orders Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 });
  }
}
