// src/app/api/customer/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/customer/dashboard - Get customer dashboard stats
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'CUSTOMER') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const customerId = authResult.user.id;
    
    // Get stats
    const [
      activeOrders,
      completedOrders,
      totalSpent,
      recentOrders,
      favoriteLaundry,
      unreadNotifications,
    ] = await Promise.all([
      // Active orders count
      prisma.order.count({
        where: {
          customer_id: customerId,
          status: { in: ['PENDING', 'ACCEPTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY'] },
        },
      }),
      
      // Completed orders count
      prisma.order.count({
        where: { customer_id: customerId, status: { in: ['DELIVERED', 'COMPLETED'] } },
      }),
      
      // Total spent
      prisma.order.aggregate({
        where: { customer_id: customerId, status: { in: ['DELIVERED', 'COMPLETED'] } },
        _sum: { total_amount: true },
      }),
      
      // Recent orders
      prisma.order.findMany({
        where: { customer_id: customerId },
        include: {
          laundry: { select: { laundry_name: true, laundry_logo: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 5,
      }),
      
      // Favorite laundry (most orders)
      prisma.order.groupBy({
        by: ['laundry_id'],
        where: { customer_id: customerId, status: { in: ['DELIVERED', 'COMPLETED'] } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1,
      }),
      
      // Unread notifications
      prisma.notification.count({
        where: { user_id: customerId, is_read: false },
      }),
    ]);
    
    // Get favorite laundry details
    let favoriteLaundryData = null;
    if (favoriteLaundry.length > 0) {
      const laundry = await prisma.laundry.findUnique({
        where: { id: favoriteLaundry[0].laundry_id },
        select: { id: true, laundry_name: true, laundry_logo: true },
      });
      if (laundry) {
        favoriteLaundryData = {
          ...laundry,
          orders_count: favoriteLaundry[0]._count.id,
        };
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        active_orders: activeOrders,
        completed_orders: completedOrders,
        total_spent: totalSpent._sum.total_amount || 0,
        favorite_laundry: favoriteLaundryData,
        recent_orders: recentOrders,
        unread_notifications: unreadNotifications,
      },
    });
  } catch (error) {
    console.error('Get Customer Dashboard Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
