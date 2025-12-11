// src/app/api/laundry/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/laundry/dashboard - Get laundry dashboard stats
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const laundryId = authResult.user.id;
    
    // Date ranges
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get laundry info
    const laundry = await prisma.laundry.findUnique({
      where: { id: laundryId },
      select: { rating: true, total_reviews: true, total_orders: true, services_count: true },
    });
    
    // Today's stats
    const [todayNewOrders, todayCompletedOrders, todayRevenue, pendingPickups] = await Promise.all([
      prisma.order.count({
        where: { laundry_id: laundryId, created_at: { gte: todayStart } },
      }),
      prisma.order.count({
        where: { laundry_id: laundryId, status: 'DELIVERED', delivered_at: { gte: todayStart } },
      }),
      prisma.order.aggregate({
        where: { laundry_id: laundryId, status: 'DELIVERED', delivered_at: { gte: todayStart } },
        _sum: { total_amount: true },
      }),
      prisma.order.count({
        where: { laundry_id: laundryId, status: { in: ['ACCEPTED', 'PICKUP_SCHEDULED'] } },
      }),
    ]);
    
    // This week's stats
    const [weekOrders, weekRevenue, weekNewCustomers] = await Promise.all([
      prisma.order.count({
        where: { laundry_id: laundryId, created_at: { gte: weekStart }, status: { not: 'CANCELLED' } },
      }),
      prisma.order.aggregate({
        where: { laundry_id: laundryId, status: 'DELIVERED', delivered_at: { gte: weekStart } },
        _sum: { total_amount: true },
      }),
      prisma.order.groupBy({
        by: ['customer_id'],
        where: { laundry_id: laundryId, created_at: { gte: weekStart } },
      }),
    ]);
    
    // This month's stats
    const [monthOrders, monthRevenue] = await Promise.all([
      prisma.order.count({
        where: { laundry_id: laundryId, created_at: { gte: monthStart }, status: { not: 'CANCELLED' } },
      }),
      prisma.order.aggregate({
        where: { laundry_id: laundryId, status: 'DELIVERED', delivered_at: { gte: monthStart } },
        _sum: { total_amount: true },
      }),
    ]);
    
    // Pending actions
    const [pendingOrders, readyForDelivery] = await Promise.all([
      prisma.order.count({ where: { laundry_id: laundryId, status: 'PENDING' } }),
      prisma.order.count({ where: { laundry_id: laundryId, status: 'READY' } }),
    ]);
    
    // Recent orders
    const recentOrders = await prisma.order.findMany({
      where: { laundry_id: laundryId },
      include: {
        customer: { select: { name: true, phone_number: true, avatar: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });
    
    // Unread notifications
    const unreadNotifications = await prisma.notification.count({
      where: { laundry_id: laundryId, is_read: false },
    });
    
    return NextResponse.json({
      success: true,
      data: {
        today: {
          new_orders: todayNewOrders,
          completed_orders: todayCompletedOrders,
          revenue: todayRevenue._sum.total_amount || 0,
          pending_pickups: pendingPickups,
        },
        this_week: {
          total_orders: weekOrders,
          revenue: weekRevenue._sum.total_amount || 0,
          new_customers: weekNewCustomers.length,
        },
        this_month: {
          total_orders: monthOrders,
          revenue: monthRevenue._sum.total_amount || 0,
        },
        overview: {
          rating: laundry?.rating || 0,
          total_reviews: laundry?.total_reviews || 0,
          total_orders: laundry?.total_orders || 0,
          services_count: laundry?.services_count || 0,
        },
        pending_actions: {
          pending_orders: pendingOrders,
          ready_for_delivery: readyForDelivery,
        },
        recent_orders: recentOrders,
        unread_notifications: unreadNotifications,
      },
    });
  } catch (error) {
    console.error('Get Laundry Dashboard Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch dashboard' }, { status: 500 });
  }
}
