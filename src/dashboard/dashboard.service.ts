import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private readonly ACTIVE_STATUSES: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.ACCEPTED,
    OrderStatus.PICKUP_SCHEDULED,
    OrderStatus.PICKED_UP,
    OrderStatus.PROCESSING,
    OrderStatus.READY,
    OrderStatus.OUT_FOR_DELIVERY,
  ];

  // Customer Dashboard
  async getCustomerDashboard(customerId: string) {
    const [activeOrders, completedOrders, totalSpent, recentOrders, unreadNotifications] =
      await Promise.all([
        // Active orders count
        this.prisma.order.count({
          where: {
            customer_id: customerId,
            status: { in: this.ACTIVE_STATUSES },
          },
        }),

        // Completed orders count
        this.prisma.order.count({
          where: {
            customer_id: customerId,
            status: 'COMPLETED',
          },
        }),

        // Total spent
        this.prisma.order.aggregate({
          where: {
            customer_id: customerId,
            status: 'COMPLETED',
          },
          _sum: { total_amount: true },
        }),

        // Recent orders
        this.prisma.order.findMany({
          where: { customer_id: customerId },
          include: {
            laundry: {
              select: {
                id: true,
                laundry_name: true,
                laundry_logo: true,
              },
            },
          },
          orderBy: { created_at: 'desc' },
          take: 5,
        }),

        // Unread notifications
        this.prisma.notification.count({
          where: {
            user_id: customerId,
            is_read: false,
          },
        }),
      ]);

    // Get favorite laundry
    const favoriteLaundry = await this.prisma.order.groupBy({
      by: ['laundry_id'],
      where: {
        customer_id: customerId,
        status: 'COMPLETED',
      },
      _count: { laundry_id: true },
      orderBy: { _count: { laundry_id: 'desc' } },
      take: 1,
    });

    let favorite: {
      id: string;
      laundry_name: string | null;
      laundry_logo: string | null;
      orders_count: number;
    } | null = null;
    if (favoriteLaundry.length > 0) {
      const laundry = await this.prisma.laundry.findUnique({
        where: { id: favoriteLaundry[0].laundry_id },
        select: {
          id: true,
          laundry_name: true,
          laundry_logo: true,
        },
      });
      if (laundry) {
        favorite = {
          ...laundry,
          orders_count: favoriteLaundry[0]._count.laundry_id,
        };
      }
    }

    return {
      active_orders: activeOrders,
      completed_orders: completedOrders,
      total_spent: totalSpent._sum.total_amount || 0,
      favorite_laundry: favorite,
      recent_orders: recentOrders,
      unread_notifications: unreadNotifications,
    };
  }

  // Laundry Dashboard
  async getLaundryDashboard(laundryId: string) {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date();
    monthStart.setDate(1);

    const [
      todayNewOrders,
      todayCompletedOrders,
      todayRevenue,
      todayPendingPickups,
      weekOrders,
      weekRevenue,
      weekNewCustomers,
      monthOrders,
      monthRevenue,
      laundry,
      pendingOrders,
      readyForDelivery,
      recentOrders,
      unreadNotifications,
    ] = await Promise.all([
      // Today's new orders
      this.prisma.order.count({
        where: {
          laundry_id: laundryId,
          created_at: { gte: todayStart, lte: todayEnd },
        },
      }),

      // Today's completed orders
      this.prisma.order.count({
        where: {
          laundry_id: laundryId,
          status: 'COMPLETED',
          updated_at: { gte: todayStart, lte: todayEnd },
        },
      }),

      // Today's revenue
      this.prisma.order.aggregate({
        where: {
          laundry_id: laundryId,
          status: 'COMPLETED',
          updated_at: { gte: todayStart, lte: todayEnd },
        },
        _sum: { total_amount: true },
      }),

      // Pending pickups
      this.prisma.order.count({
        where: {
          laundry_id: laundryId,
          status: { in: ['ACCEPTED', 'PICKUP_SCHEDULED'] },
        },
      }),

      // This week's orders
      this.prisma.order.count({
        where: {
          laundry_id: laundryId,
          created_at: { gte: weekStart },
        },
      }),

      // This week's revenue
      this.prisma.order.aggregate({
        where: {
          laundry_id: laundryId,
          status: 'COMPLETED',
          updated_at: { gte: weekStart },
        },
        _sum: { total_amount: true },
      }),

      // This week's new customers
      this.prisma.order.groupBy({
        by: ['customer_id'],
        where: {
          laundry_id: laundryId,
          created_at: { gte: weekStart },
        },
      }),

      // This month's orders
      this.prisma.order.count({
        where: {
          laundry_id: laundryId,
          created_at: { gte: monthStart },
        },
      }),

      // This month's revenue
      this.prisma.order.aggregate({
        where: {
          laundry_id: laundryId,
          status: 'COMPLETED',
          updated_at: { gte: monthStart },
        },
        _sum: { total_amount: true },
      }),

      // Laundry overview
      this.prisma.laundry.findUnique({
        where: { id: laundryId },
        select: {
          rating: true,
          total_reviews: true,
          total_orders: true,
          services_count: true,
        },
      }),

      // Pending orders
      this.prisma.order.count({
        where: {
          laundry_id: laundryId,
          status: 'PENDING',
        },
      }),

      // Ready for delivery
      this.prisma.order.count({
        where: {
          laundry_id: laundryId,
          status: 'READY',
        },
      }),

      // Recent orders
      this.prisma.order.findMany({
        where: { laundry_id: laundryId },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone_number: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),

      // Unread notifications
      this.prisma.notification.count({
        where: {
          laundry_id: laundryId,
          is_read: false,
        },
      }),
    ]);

    return {
      today: {
        new_orders: todayNewOrders,
        completed_orders: todayCompletedOrders,
        revenue: todayRevenue._sum.total_amount || 0,
        pending_pickups: todayPendingPickups,
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
      overview: laundry || {
        rating: 0,
        total_reviews: 0,
        total_orders: 0,
        services_count: 0,
      },
      pending_actions: {
        pending_orders: pendingOrders,
        ready_for_delivery: readyForDelivery,
      },
      recent_orders: recentOrders,
      unread_notifications: unreadNotifications,
    };
  }
}
