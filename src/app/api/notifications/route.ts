// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id, role } = authResult.user;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unread') === 'true';
    
    // Build where clause based on role
    const where: any = {};
    if (role === 'CUSTOMER') where.user_id = id;
    else if (role === 'LAUNDRY') where.laundry_id = id;
    else if (role === 'DELIVERY_PARTNER') where.delivery_partner_id = id;
    
    if (unreadOnly) where.is_read = false;
    
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { ...where, is_read: false } }),
    ]);
    
    return NextResponse.json({
      success: true,
      data: { notifications, unread_count: unreadCount },
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit), has_more: page * limit < total },
    });
  } catch (error) {
    console.error('Get Notifications Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST /api/notifications - Mark notifications as read
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id, role } = authResult.user;
    const body = await request.json();
    const { notification_ids, mark_all } = body;
    
    // Build where clause based on role
    const where: any = {};
    if (role === 'CUSTOMER') where.user_id = id;
    else if (role === 'LAUNDRY') where.laundry_id = id;
    else if (role === 'DELIVERY_PARTNER') where.delivery_partner_id = id;
    
    if (mark_all) {
      await prisma.notification.updateMany({
        where: { ...where, is_read: false },
        data: { is_read: true, read_at: new Date() },
      });
    } else if (notification_ids && notification_ids.length > 0) {
      await prisma.notification.updateMany({
        where: { ...where, id: { in: notification_ids } },
        data: { is_read: true, read_at: new Date() },
      });
    }
    
    return NextResponse.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Mark Notifications Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to mark notifications' }, { status: 500 });
  }
}
