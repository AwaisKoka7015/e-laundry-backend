// src/app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';

// POST /api/notifications/:id - Mark single notification as read
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id: userId, role } = authResult.user;
    
    // Build where clause based on role
    const where: any = { id: params.id };
    if (role === 'CUSTOMER') where.user_id = userId;
    else if (role === 'LAUNDRY') where.laundry_id = userId;
    else if (role === 'DELIVERY_PARTNER') where.delivery_partner_id = userId;
    
    const notification = await prisma.notification.findFirst({ where });
    if (!notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }
    
    await prisma.notification.update({
      where: { id: params.id },
      data: { is_read: true, read_at: new Date() },
    });
    
    return NextResponse.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark Notification Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to mark notification' }, { status: 500 });
  }
}
