import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminUsersQueryDto,
  UserStatusFilter,
  AdminLaundriesQueryDto,
  LaundryStatusFilter,
  LaundryVerifiedFilter,
  AdminOrdersQueryDto,
  OrderStatusFilter,
  PaymentStatusFilter,
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
  ClothingItemsQueryDto,
  ClothingTypeFilter,
  CreateClothingItemDto,
  UpdateClothingItemDto,
  AdminReviewsQueryDto,
  RatingFilter,
  VisibilityFilter,
  ReplyFilter,
  AdminPromoCodesQueryDto,
  PromoStatusFilter,
  PromoTypeFilter,
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  PromoUsageQueryDto,
  DashboardQueryDto,
  DashboardPeriod,
  AdminNotificationsQueryDto,
  AdminNotificationType,
  NotificationTarget,
  SendNotificationDto,
  SendBulkNotificationDto,
  BulkUpdateSettingsDto,
} from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ==================== USERS (CUSTOMERS) ====================

  async getUsers(query: AdminUsersQueryDto) {
    const { page = 1, limit = 10, search, status, city } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {};

    // Status filter
    if (status && status !== UserStatusFilter.ALL) {
      where.status = status as any;
    }

    // City filter
    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    // Search filter (name or phone)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone_number: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get users with order stats
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          phone_number: true,
          email: true,
          avatar: true,
          gender: true,
          city: true,
          status: true,
          created_at: true,
          last_login: true,
          _count: {
            select: { orders: true },
          },
          orders: {
            where: { payment_status: 'COMPLETED' },
            select: { total_amount: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // Calculate total spent for each user
    const usersWithStats = users.map((user) => {
      const totalSpent = user.orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
      return {
        id: user.id,
        name: user.name,
        phone_number: user.phone_number,
        email: user.email,
        avatar: user.avatar,
        gender: user.gender,
        city: user.city,
        status: user.status,
        created_at: user.created_at,
        last_login: user.last_login,
        total_orders: user._count.orders,
        total_spent: totalSpent,
      };
    });

    return {
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { created_at: 'desc' },
          take: 10,
          include: {
            laundry: {
              select: { id: true, laundry_name: true },
            },
          },
        },
        reviews: {
          orderBy: { created_at: 'desc' },
          take: 5,
        },
        _count: {
          select: { orders: true, reviews: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate total spent
    const spentResult = await this.prisma.order.aggregate({
      where: {
        customer_id: id,
        payment_status: 'COMPLETED',
      },
      _sum: { total_amount: true },
    });

    return {
      ...user,
      total_spent: spentResult._sum.total_amount || 0,
    };
  }

  async updateUserStatus(id: string, status: 'ACTIVE' | 'BLOCKED') {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    return updated;
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete by setting status to BLOCKED
    await this.prisma.user.update({
      where: { id },
      data: { status: 'BLOCKED' },
    });

    return { message: 'User deleted successfully' };
  }

  async getUserOrders(id: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { customer_id: id },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          laundry: {
            select: { id: true, laundry_name: true },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where: { customer_id: id } }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ==================== STATS ====================

  async getUserStats() {
    const [total, pending, active, blocked] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'PENDING' } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'BLOCKED' } }),
    ]);

    return {
      total,
      pending,
      active,
      blocked,
    };
  }

  // ==================== LAUNDRIES ====================

  async getLaundries(query: AdminLaundriesQueryDto) {
    const { page = 1, limit = 10, search, status, verified, city } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.LaundryWhereInput = {};

    // Status filter
    if (status && status !== LaundryStatusFilter.ALL) {
      where.status = status as any;
    }

    // Verified filter
    if (verified && verified !== LaundryVerifiedFilter.ALL) {
      where.is_verified = verified === LaundryVerifiedFilter.VERIFIED;
    }

    // City filter
    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    // Search filter (laundry name or phone)
    if (search) {
      where.OR = [
        { laundry_name: { contains: search, mode: 'insensitive' } },
        { phone_number: { contains: search } },
      ];
    }

    // Get laundries
    const [laundries, total] = await Promise.all([
      this.prisma.laundry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          laundry_name: true,
          phone_number: true,
          email: true,
          laundry_logo: true,
          city: true,
          status: true,
          rating: true,
          total_reviews: true,
          total_orders: true,
          services_count: true,
          is_verified: true,
          created_at: true,
          last_login: true,
        },
      }),
      this.prisma.laundry.count({ where }),
    ]);

    return {
      laundries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLaundryById(id: string) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            category: true,
            _count: { select: { pricing: true } },
          },
        },
        orders: {
          orderBy: { created_at: 'desc' },
          take: 10,
          include: {
            customer: {
              select: { id: true, name: true, phone_number: true },
            },
          },
        },
        reviews: {
          orderBy: { created_at: 'desc' },
          take: 5,
          include: {
            customer: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: { orders: true, reviews: true, services: true },
        },
      },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    // Calculate total revenue
    const revenueResult = await this.prisma.order.aggregate({
      where: {
        laundry_id: id,
        payment_status: 'COMPLETED',
      },
      _sum: { total_amount: true },
    });

    return {
      ...laundry,
      total_revenue: revenueResult._sum.total_amount || 0,
    };
  }

  async updateLaundryStatus(id: string, status: 'ACTIVE' | 'BLOCKED') {
    const laundry = await this.prisma.laundry.findUnique({ where: { id } });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    const updated = await this.prisma.laundry.update({
      where: { id },
      data: { status },
    });

    return updated;
  }

  async activateLaundry(id: string) {
    const laundry = await this.prisma.laundry.findUnique({ where: { id } });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    if (laundry.status === 'ACTIVE') {
      return { ...laundry, message: 'Laundry is already active' };
    }

    // Activate the laundry and optionally verify it
    const updated = await this.prisma.laundry.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        is_verified: true,
        is_open: true,
        approved_at: new Date(),
      },
    });

    return updated;
  }

  async verifyLaundry(id: string) {
    const laundry = await this.prisma.laundry.findUnique({ where: { id } });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    const updated = await this.prisma.laundry.update({
      where: { id },
      data: { is_verified: !laundry.is_verified },
    });

    return updated;
  }

  async deleteLaundry(id: string) {
    const laundry = await this.prisma.laundry.findUnique({ where: { id } });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    // Soft delete by blocking
    await this.prisma.laundry.update({
      where: { id },
      data: { status: 'BLOCKED' },
    });

    return { message: 'Laundry deleted successfully' };
  }

  async getLaundryOrders(id: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const laundry = await this.prisma.laundry.findUnique({ where: { id } });
    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { laundry_id: id },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true, phone_number: true },
          },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where: { laundry_id: id } }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLaundryStats() {
    const [total, pending, active, blocked, verified, unverified, pendingSetup] = await Promise.all(
      [
        this.prisma.laundry.count(),
        this.prisma.laundry.count({ where: { status: 'PENDING' } }),
        this.prisma.laundry.count({ where: { status: 'ACTIVE' } }),
        this.prisma.laundry.count({ where: { status: 'BLOCKED' } }),
        this.prisma.laundry.count({ where: { is_verified: true } }),
        this.prisma.laundry.count({ where: { is_verified: false } }),
        // Pending laundries that have NOT been set up yet (no setup_at)
        this.prisma.laundry.count({ where: { status: 'PENDING', setup_at: null } }),
      ],
    );

    return {
      total,
      pending,
      active,
      blocked,
      verified,
      unverified,
      pending_setup: pendingSetup,
    };
  }

  // Get pending laundries for setup page
  async getPendingLaundriesForSetup(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [laundries, total] = await Promise.all([
      this.prisma.laundry.findMany({
        where: {
          status: 'PENDING',
          setup_at: null, // Not yet set up by admin
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          laundry_name: true,
          phone_number: true,
          email: true,
          laundry_logo: true,
          shop_images: true,
          city: true,
          address_text: true,
          latitude: true,
          longitude: true,
          created_at: true,
        },
      }),
      this.prisma.laundry.count({
        where: { status: 'PENDING', setup_at: null },
      }),
    ]);

    return {
      laundries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Setup laundry with all active categories and clothing items
  async setupLaundry(laundryId: string, adminId: string) {
    // 1. Get the laundry
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    if (laundry.status !== 'PENDING') {
      throw new ConflictException('Laundry is not in pending status');
    }

    if (laundry.setup_at) {
      throw new ConflictException('Laundry has already been set up');
    }

    // 2. Get all active categories
    const categories = await this.prisma.serviceCategory.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });

    if (categories.length === 0) {
      throw new ConflictException('No active categories found. Please create categories first.');
    }

    // 3. Get all active clothing items
    const clothingItems = await this.prisma.clothingItem.findMany({
      where: { is_active: true },
      orderBy: [{ type: 'asc' }, { sort_order: 'asc' }],
    });

    if (clothingItems.length === 0) {
      throw new ConflictException(
        'No active clothing items found. Please create clothing items first.',
      );
    }

    // 4. Create services and pricing in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const servicesCreated: any[] = [];

      // Create a service for each category
      for (const category of categories) {
        // Create the laundry service
        const service = await tx.laundryService.create({
          data: {
            laundry_id: laundryId,
            category_id: category.id,
            name: category.name,
            description: category.description || `${category.name} service`,
            base_price: 0, // Will use item-specific pricing
            price_unit: 'PER_PIECE',
            estimated_hours: 24,
            is_available: true,
          },
        });

        // Create pricing for each clothing item
        const pricingData = clothingItems.map((item) => ({
          laundry_service_id: service.id,
          clothing_item_id: item.id,
          price: 0, // Default price - laundry owner can update later
          express_price: 0,
          price_unit: 'PER_PIECE' as const,
          is_available: true,
        }));

        await tx.servicePricing.createMany({
          data: pricingData,
        });

        servicesCreated.push({
          ...service,
          category_name: category.name,
          pricing_count: pricingData.length,
        });
      }

      // 5. Update laundry with setup info
      const updatedLaundry = await tx.laundry.update({
        where: { id: laundryId },
        data: {
          setup_at: new Date(),
          setup_by: adminId,
          services_count: servicesCreated.length,
        },
      });

      return {
        laundry: updatedLaundry,
        services: servicesCreated,
        total_services: servicesCreated.length,
        total_pricing: servicesCreated.length * clothingItems.length,
      };
    });

    return result;
  }

  // Approve laundries that have been set up for more than 2 hours (called by cron)
  async approveSetupLaundries() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Find laundries that:
    // - Are in PENDING status
    // - Have been set up (setup_at is not null)
    // - Were set up more than 2 hours ago
    // - Have not been approved yet (approved_at is null)
    const laundriesToApprove = await this.prisma.laundry.findMany({
      where: {
        status: 'PENDING',
        setup_at: { not: null, lte: twoHoursAgo },
        approved_at: null,
      },
    });

    if (laundriesToApprove.length === 0) {
      return { approved_count: 0, laundries: [] };
    }

    // Approve all eligible laundries
    const approvedLaundries = await this.prisma.$transaction(
      laundriesToApprove.map((laundry) =>
        this.prisma.laundry.update({
          where: { id: laundry.id },
          data: {
            status: 'ACTIVE',
            is_verified: true,
            is_open: true, // Auto-open the shop
            approved_at: new Date(),
          },
        }),
      ),
    );

    return {
      approved_count: approvedLaundries.length,
      laundries: approvedLaundries.map((l) => ({
        id: l.id,
        laundry_name: l.laundry_name,
        phone_number: l.phone_number,
      })),
    };
  }

  // ==================== ORDERS ====================

  async getOrders(query: AdminOrdersQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      payment_status,
      laundry_id,
      customer_id,
      date_from,
      date_to,
    } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.OrderWhereInput = {};

    // Status filter
    if (status && status !== OrderStatusFilter.ALL) {
      where.status = status as any;
    }

    // Payment status filter
    if (payment_status && payment_status !== PaymentStatusFilter.ALL) {
      where.payment_status = payment_status as any;
    }

    // Laundry filter
    if (laundry_id) {
      where.laundry_id = laundry_id;
    }

    // Customer filter
    if (customer_id) {
      where.customer_id = customer_id;
    }

    // Date range filter
    if (date_from || date_to) {
      where.created_at = {};
      if (date_from) {
        where.created_at.gte = new Date(date_from);
      }
      if (date_to) {
        where.created_at.lte = new Date(date_to);
      }
    }

    // Search filter (order number, customer name, or laundry name)
    if (search) {
      where.OR = [
        { order_number: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { phone_number: { contains: search } } },
        { laundry: { laundry_name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Get orders with optimized query
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          order_number: true,
          status: true,
          order_type: true,
          total_amount: true,
          payment_status: true,
          payment_method: true,
          created_at: true,
          pickup_date: true,
          expected_delivery_date: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone_number: true,
            },
          },
          laundry: {
            select: {
              id: true,
              laundry_name: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            email: true,
            avatar: true,
          },
        },
        laundry: {
          select: {
            id: true,
            laundry_name: true,
            phone_number: true,
            laundry_logo: true,
          },
        },
        items: {
          include: {
            clothing_item: true,
            laundry_service: {
              include: {
                category: true,
              },
            },
          },
        },
        timeline: {
          orderBy: { timestamp: 'desc' },
        },
        status_history: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async updateOrderStatus(id: string, status: string, notes?: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const previousStatus = order.status;

    // Update order status
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: status as any,
        // Update timestamp fields based on status
        ...(status === 'ACCEPTED' && { accepted_at: new Date() }),
        ...(status === 'PICKED_UP' && { picked_up_at: new Date() }),
        ...(status === 'PROCESSING' && { processing_started_at: new Date() }),
        ...(status === 'READY' && { ready_at: new Date() }),
        ...(status === 'OUT_FOR_DELIVERY' && { out_for_delivery_at: new Date() }),
        ...(status === 'DELIVERED' && {
          delivered_at: new Date(),
          actual_delivery_date: new Date(),
        }),
        ...(status === 'CANCELLED' && { cancelled_at: new Date() }),
      },
    });

    // Create status history record
    await this.prisma.orderStatusHistory.create({
      data: {
        order_id: id,
        from_status: previousStatus,
        to_status: status as any,
        changed_by: 'ADMIN',
        notes,
      },
    });

    // Create timeline entry
    await this.prisma.orderTimeline.create({
      data: {
        order_id: id,
        event: `STATUS_CHANGED_TO_${status}`,
        title: this.getStatusTitle(status),
        description: notes || `Order status updated to ${status}`,
        icon: this.getStatusIcon(status),
      },
    });

    return updated;
  }

  async getOrderStats() {
    const [
      total,
      pending,
      accepted,
      processing,
      ready,
      outForDelivery,
      delivered,
      completed,
      cancelled,
      todayOrders,
      todayRevenue,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: 'ACCEPTED' } }),
      this.prisma.order.count({ where: { status: 'PROCESSING' } }),
      this.prisma.order.count({ where: { status: 'READY' } }),
      this.prisma.order.count({ where: { status: 'OUT_FOR_DELIVERY' } }),
      this.prisma.order.count({ where: { status: 'DELIVERED' } }),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.order.count({ where: { status: 'CANCELLED' } }),
      this.prisma.order.count({
        where: {
          created_at: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.order.aggregate({
        where: {
          created_at: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
          payment_status: 'COMPLETED',
        },
        _sum: { total_amount: true },
      }),
    ]);

    return {
      total,
      pending,
      accepted,
      processing,
      ready,
      out_for_delivery: outForDelivery,
      delivered,
      completed,
      cancelled,
      today_orders: todayOrders,
      today_revenue: todayRevenue._sum.total_amount || 0,
    };
  }

  private getStatusTitle(status: string): string {
    const titles: Record<string, string> = {
      PENDING: 'Order Placed',
      ACCEPTED: 'Order Accepted',
      REJECTED: 'Order Rejected',
      PICKUP_SCHEDULED: 'Pickup Scheduled',
      PICKED_UP: 'Items Picked Up',
      PROCESSING: 'Processing Started',
      READY: 'Ready for Delivery',
      OUT_FOR_DELIVERY: 'Out for Delivery',
      DELIVERED: 'Order Delivered',
      COMPLETED: 'Order Completed',
      CANCELLED: 'Order Cancelled',
    };
    return titles[status] || status;
  }

  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      PENDING: 'clock',
      ACCEPTED: 'check-circle',
      REJECTED: 'x-circle',
      PICKUP_SCHEDULED: 'calendar',
      PICKED_UP: 'package',
      PROCESSING: 'loader',
      READY: 'check-square',
      OUT_FOR_DELIVERY: 'truck',
      DELIVERED: 'home',
      COMPLETED: 'star',
      CANCELLED: 'x-octagon',
    };
    return icons[status] || 'circle';
  }

  // ==================== CATEGORIES ====================

  async getCategories() {
    const categories = await this.prisma.serviceCategory.findMany({
      orderBy: { sort_order: 'asc' },
      include: {
        _count: {
          select: { services: true },
        },
      },
    });

    return categories.map((cat) => ({
      ...cat,
      services_count: cat._count.services,
      _count: undefined,
    }));
  }

  async getCategoryById(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        services: {
          include: {
            laundry: {
              select: { id: true, laundry_name: true },
            },
          },
        },
        _count: {
          select: { services: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return {
      ...category,
      services_count: category._count.services,
    };
  }

  async createCategory(dto: CreateCategoryDto) {
    // Check if category name already exists
    const existing = await this.prisma.serviceCategory.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException('Category with this name already exists');
    }

    // Get max sort order if not provided
    if (dto.sort_order === undefined) {
      const maxOrder = await this.prisma.serviceCategory.aggregate({
        _max: { sort_order: true },
      });
      dto.sort_order = (maxOrder._max.sort_order || 0) + 1;
    }

    const category = await this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        name_urdu: dto.name_urdu,
        icon: dto.icon,
        description: dto.description,
        sort_order: dto.sort_order,
        is_active: dto.is_active ?? true,
      },
    });

    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if new name conflicts with existing category
    if (dto.name && dto.name !== category.name) {
      const existing = await this.prisma.serviceCategory.findUnique({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException('Category with this name already exists');
      }
    }

    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.name_urdu !== undefined && { name_urdu: dto.name_urdu }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });

    return updated;
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { services: true } },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if category has services
    if (category._count.services > 0) {
      throw new ConflictException(
        `Cannot delete category. It has ${category._count.services} service(s) associated with it.`,
      );
    }

    await this.prisma.serviceCategory.delete({
      where: { id },
    });

    return { message: 'Category deleted successfully' };
  }

  async reorderCategories(dto: ReorderCategoriesDto) {
    // Update sort orders in a transaction
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.serviceCategory.update({
          where: { id: item.id },
          data: { sort_order: item.sort_order },
        }),
      ),
    );

    return { message: 'Categories reordered successfully' };
  }

  async toggleCategoryStatus(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const updated = await this.prisma.serviceCategory.update({
      where: { id },
      data: { is_active: !category.is_active },
    });

    return updated;
  }

  // ==================== CLOTHING ITEMS ====================

  async getClothingItems(query: ClothingItemsQueryDto) {
    const { page = 1, limit = 50, search, type } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ClothingItemWhereInput = {};

    // Type filter
    if (type && type !== ClothingTypeFilter.ALL) {
      where.type = type as any;
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { name_urdu: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.clothingItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ type: 'asc' }, { sort_order: 'asc' }],
        include: {
          _count: {
            select: { pricing: true, order_items: true },
          },
        },
      }),
      this.prisma.clothingItem.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        pricing_count: item._count.pricing,
        usage_count: item._count.order_items,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getClothingItemById(id: string) {
    const item = await this.prisma.clothingItem.findUnique({
      where: { id },
      include: {
        pricing: {
          include: {
            laundry_service: {
              include: {
                laundry: {
                  select: { id: true, laundry_name: true },
                },
                category: true,
              },
            },
          },
        },
        _count: {
          select: { pricing: true, order_items: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Clothing item not found');
    }

    return {
      ...item,
      pricing_count: item._count.pricing,
      usage_count: item._count.order_items,
    };
  }

  async createClothingItem(dto: CreateClothingItemDto) {
    // Check if item with same name and type exists
    const existing = await this.prisma.clothingItem.findUnique({
      where: { name_type: { name: dto.name, type: dto.type as any } },
    });

    if (existing) {
      throw new ConflictException(`Item "${dto.name}" already exists for type ${dto.type}`);
    }

    // Get max sort order for this type if not provided
    if (dto.sort_order === undefined) {
      const maxOrder = await this.prisma.clothingItem.aggregate({
        where: { type: dto.type as any },
        _max: { sort_order: true },
      });
      dto.sort_order = (maxOrder._max.sort_order || 0) + 1;
    }

    const item = await this.prisma.clothingItem.create({
      data: {
        name: dto.name,
        name_urdu: dto.name_urdu,
        type: dto.type as any,
        icon: dto.icon,
        description: dto.description,
        sort_order: dto.sort_order,
        is_active: dto.is_active ?? true,
      },
    });

    return item;
  }

  async updateClothingItem(id: string, dto: UpdateClothingItemDto) {
    const item = await this.prisma.clothingItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Clothing item not found');
    }

    // Check for name+type conflicts
    const newName = dto.name || item.name;
    const newType = dto.type || item.type;

    if (newName !== item.name || newType !== item.type) {
      const existing = await this.prisma.clothingItem.findUnique({
        where: { name_type: { name: newName, type: newType as any } },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Item "${newName}" already exists for type ${newType}`);
      }
    }

    const updated = await this.prisma.clothingItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.name_urdu !== undefined && { name_urdu: dto.name_urdu }),
        ...(dto.type !== undefined && { type: dto.type as any }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.sort_order !== undefined && { sort_order: dto.sort_order }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });

    return updated;
  }

  async deleteClothingItem(id: string) {
    const item = await this.prisma.clothingItem.findUnique({
      where: { id },
      include: {
        _count: { select: { pricing: true, order_items: true } },
      },
    });

    if (!item) {
      throw new NotFoundException('Clothing item not found');
    }

    // Check if item is in use
    if (item._count.pricing > 0 || item._count.order_items > 0) {
      throw new ConflictException(
        `Cannot delete item. It has ${item._count.pricing} pricing(s) and ${item._count.order_items} order(s) associated with it.`,
      );
    }

    await this.prisma.clothingItem.delete({
      where: { id },
    });

    return { message: 'Clothing item deleted successfully' };
  }

  async toggleClothingItemStatus(id: string) {
    const item = await this.prisma.clothingItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Clothing item not found');
    }

    const updated = await this.prisma.clothingItem.update({
      where: { id },
      data: { is_active: !item.is_active },
    });

    return updated;
  }

  async getClothingItemStats() {
    const [total, men, women, kids, home, active, inactive] = await Promise.all([
      this.prisma.clothingItem.count(),
      this.prisma.clothingItem.count({ where: { type: 'MEN' } }),
      this.prisma.clothingItem.count({ where: { type: 'WOMEN' } }),
      this.prisma.clothingItem.count({ where: { type: 'KIDS' } }),
      this.prisma.clothingItem.count({ where: { type: 'HOME' } }),
      this.prisma.clothingItem.count({ where: { is_active: true } }),
      this.prisma.clothingItem.count({ where: { is_active: false } }),
    ]);

    return { total, men, women, kids, home, active, inactive };
  }

  // ==================== REVIEWS ====================

  async getReviews(query: AdminReviewsQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      rating,
      visibility,
      reply_status,
      laundry_id,
      customer_id,
    } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ReviewWhereInput = {};

    // Rating filter
    if (rating && rating !== RatingFilter.ALL) {
      where.rating = parseInt(rating);
    }

    // Visibility filter
    if (visibility && visibility !== VisibilityFilter.ALL) {
      where.is_visible = visibility === VisibilityFilter.VISIBLE;
    }

    // Reply status filter
    if (reply_status && reply_status !== ReplyFilter.ALL) {
      if (reply_status === ReplyFilter.REPLIED) {
        where.laundry_reply = { not: null };
      } else {
        where.laundry_reply = null;
      }
    }

    // Laundry filter
    if (laundry_id) {
      where.laundry_id = laundry_id;
    }

    // Customer filter
    if (customer_id) {
      where.customer_id = customer_id;
    }

    // Search filter
    if (search) {
      where.OR = [
        { comment: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { laundry: { laundry_name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          laundry: {
            select: {
              id: true,
              laundry_name: true,
              laundry_logo: true,
            },
          },
          order: {
            select: {
              id: true,
              order_number: true,
            },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReviewById(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            avatar: true,
            phone_number: true,
          },
        },
        laundry: {
          select: {
            id: true,
            laundry_name: true,
            laundry_logo: true,
          },
        },
        order: {
          select: {
            id: true,
            order_number: true,
            total_amount: true,
            status: true,
            created_at: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async updateReviewVisibility(id: string, is_visible: boolean) {
    const review = await this.prisma.review.findUnique({ where: { id } });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const updated = await this.prisma.review.update({
      where: { id },
      data: { is_visible },
    });

    // Update laundry rating if visibility changed
    await this.updateLaundryRating(review.laundry_id);

    return updated;
  }

  async deleteReview(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const laundryId = review.laundry_id;

    await this.prisma.review.delete({
      where: { id },
    });

    // Update laundry rating after deletion
    await this.updateLaundryRating(laundryId);

    return { message: 'Review deleted successfully' };
  }

  async getReviewStats() {
    const [total, visible, hidden, replied, pending, avgRating, ratingCounts] = await Promise.all([
      this.prisma.review.count(),
      this.prisma.review.count({ where: { is_visible: true } }),
      this.prisma.review.count({ where: { is_visible: false } }),
      this.prisma.review.count({ where: { laundry_reply: { not: null } } }),
      this.prisma.review.count({ where: { laundry_reply: null } }),
      this.prisma.review.aggregate({ _avg: { rating: true } }),
      this.prisma.review.groupBy({
        by: ['rating'],
        _count: { rating: true },
        orderBy: { rating: 'desc' },
      }),
    ]);

    // Convert rating counts to object
    const ratings = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingCounts.forEach((rc) => {
      ratings[Math.round(rc.rating)] = rc._count.rating;
    });

    return {
      total,
      visible,
      hidden,
      replied,
      pending,
      average_rating: avgRating._avg.rating || 0,
      ratings,
    };
  }

  private async updateLaundryRating(laundryId: string) {
    const result = await this.prisma.review.aggregate({
      where: {
        laundry_id: laundryId,
        is_visible: true,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.laundry.update({
      where: { id: laundryId },
      data: {
        rating: result._avg.rating || 0,
        total_reviews: result._count.rating,
      },
    });
  }

  // ==================== PROMO CODES ====================

  async getPromoCodes(query: AdminPromoCodesQueryDto) {
    const { page = 1, limit = 10, search, status, type } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.PromoCodeWhereInput = {};
    const now = new Date();

    // Type filter
    if (type && type !== PromoTypeFilter.ALL) {
      where.discount_type = type;
    }

    // Status filter
    if (status && status !== PromoStatusFilter.ALL) {
      switch (status) {
        case PromoStatusFilter.ACTIVE:
          where.is_active = true;
          where.valid_until = { gte: now };
          where.OR = [
            { usage_limit: null },
            { used_count: { lt: this.prisma.$queryRaw`usage_limit` as any } },
          ];
          break;
        case PromoStatusFilter.INACTIVE:
          where.is_active = false;
          break;
        case PromoStatusFilter.EXPIRED:
          where.valid_until = { lt: now };
          break;
        case PromoStatusFilter.USED_UP:
          where.usage_limit = { not: null };
          // We'll filter used_up in the application layer
          break;
      }
    }

    // Search filter
    if (search) {
      where.code = { contains: search.toUpperCase(), mode: 'insensitive' };
    }

    const [promoCodes, total] = await Promise.all([
      this.prisma.promoCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.promoCode.count({ where }),
    ]);

    // Filter used_up codes if needed
    let filteredCodes = promoCodes;
    if (status === PromoStatusFilter.USED_UP) {
      filteredCodes = promoCodes.filter(
        (p) => p.usage_limit !== null && p.used_count >= p.usage_limit,
      );
    }

    // Calculate status for each promo code
    const promoCodesWithStatus = filteredCodes.map((promo) => ({
      ...promo,
      computed_status: this.getPromoStatus(promo),
    }));

    return {
      data: promoCodesWithStatus,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private getPromoStatus(promo: any): string {
    const now = new Date();
    if (new Date(promo.valid_until) < now) return 'expired';
    if (promo.usage_limit && promo.used_count >= promo.usage_limit) return 'used_up';
    if (!promo.is_active) return 'inactive';
    return 'active';
  }

  async getPromoCodeById(id: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }

    return {
      ...promo,
      computed_status: this.getPromoStatus(promo),
    };
  }

  async createPromoCode(dto: CreatePromoCodeDto) {
    // Check if code already exists
    const existing = await this.prisma.promoCode.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException('Promo code already exists');
    }

    const promo = await this.prisma.promoCode.create({
      data: {
        code: dto.code.toUpperCase(),
        discount_type: dto.discount_type,
        discount_value: dto.discount_value,
        max_discount: dto.max_discount,
        min_order_amount: dto.min_order_amount || 0,
        valid_from: new Date(dto.valid_from),
        valid_until: new Date(dto.valid_until),
        usage_limit: dto.usage_limit,
        first_order_only: dto.first_order_only || false,
        is_active: dto.is_active ?? true,
      },
    });

    return promo;
  }

  async updatePromoCode(id: string, dto: UpdatePromoCodeDto) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }

    // Check if new code conflicts with existing
    if (dto.code && dto.code.toUpperCase() !== promo.code) {
      const existing = await this.prisma.promoCode.findUnique({
        where: { code: dto.code.toUpperCase() },
      });
      if (existing) {
        throw new ConflictException('Promo code already exists');
      }
    }

    const updated = await this.prisma.promoCode.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code.toUpperCase() }),
        ...(dto.discount_type !== undefined && {
          discount_type: dto.discount_type,
        }),
        ...(dto.discount_value !== undefined && {
          discount_value: dto.discount_value,
        }),
        ...(dto.max_discount !== undefined && { max_discount: dto.max_discount }),
        ...(dto.min_order_amount !== undefined && {
          min_order_amount: dto.min_order_amount,
        }),
        ...(dto.valid_from !== undefined && {
          valid_from: new Date(dto.valid_from),
        }),
        ...(dto.valid_until !== undefined && {
          valid_until: new Date(dto.valid_until),
        }),
        ...(dto.usage_limit !== undefined && { usage_limit: dto.usage_limit }),
        ...(dto.first_order_only !== undefined && {
          first_order_only: dto.first_order_only,
        }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });

    return updated;
  }

  async deletePromoCode(id: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }

    // Check if promo has been used
    const usageCount = await this.prisma.order.count({
      where: { promo_code: promo.code },
    });

    if (usageCount > 0) {
      throw new ConflictException(
        `Cannot delete promo code. It has been used in ${usageCount} order(s). Consider deactivating it instead.`,
      );
    }

    await this.prisma.promoCode.delete({
      where: { id },
    });

    return { message: 'Promo code deleted successfully' };
  }

  async togglePromoCodeStatus(id: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }

    const updated = await this.prisma.promoCode.update({
      where: { id },
      data: { is_active: !promo.is_active },
    });

    return updated;
  }

  async getPromoCodeStats() {
    const now = new Date();

    const [total, active, inactive, expired, totalDiscountGiven, totalUsage, topPromos] =
      await Promise.all([
        this.prisma.promoCode.count(),
        this.prisma.promoCode.count({
          where: { is_active: true, valid_until: { gte: now } },
        }),
        this.prisma.promoCode.count({ where: { is_active: false } }),
        this.prisma.promoCode.count({ where: { valid_until: { lt: now } } }),
        this.prisma.order.aggregate({
          where: { promo_code: { not: null }, discount: { gt: 0 } },
          _sum: { discount: true },
        }),
        this.prisma.promoCode.aggregate({
          _sum: { used_count: true },
        }),
        this.prisma.promoCode.findMany({
          orderBy: { used_count: 'desc' },
          take: 5,
          select: {
            id: true,
            code: true,
            used_count: true,
            discount_type: true,
            discount_value: true,
          },
        }),
      ]);

    return {
      total,
      active,
      inactive,
      expired,
      total_discount_given: totalDiscountGiven._sum.discount || 0,
      total_usage: totalUsage._sum.used_count || 0,
      top_promos: topPromos,
    };
  }

  // Get promo code usage history (who used it, when, how much discount)
  async getPromoCodeUsage(id: string, query: PromoUsageQueryDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const promo = await this.prisma.promoCode.findUnique({
      where: { id },
    });

    if (!promo) {
      throw new NotFoundException('Promo code not found');
    }

    // Build where clause for orders
    const where: Prisma.OrderWhereInput = {
      promo_code: promo.code,
    };

    if (search) {
      where.OR = [
        { order_number: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          order_number: true,
          total_amount: true,
          discount: true,
          created_at: true,
          status: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone_number: true,
              avatar: true,
            },
          },
          laundry: {
            select: {
              id: true,
              laundry_name: true,
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    // Calculate total discount given by this promo
    const totalDiscount = await this.prisma.order.aggregate({
      where: { promo_code: promo.code },
      _sum: { discount: true },
    });

    return {
      promo_code: promo,
      usage: {
        data: orders,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      summary: {
        total_uses: total,
        total_discount: totalDiscount._sum.discount || 0,
      },
    };
  }

  // ==================== DASHBOARD ====================

  private getDateRange(period: DashboardPeriod): { start: Date; end: Date } {
    const end = new Date();
    let start: Date;

    switch (period) {
      case DashboardPeriod.TODAY:
        start = new Date();
        start.setHours(0, 0, 0, 0);
        break;
      case DashboardPeriod.WEEK:
        start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case DashboardPeriod.MONTH:
        start = new Date();
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case DashboardPeriod.YEAR:
        start = new Date();
        start.setFullYear(start.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      default:
        start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  }

  private getPreviousDateRange(period: DashboardPeriod): {
    start: Date;
    end: Date;
  } {
    const current = this.getDateRange(period);
    const duration = current.end.getTime() - current.start.getTime();

    return {
      start: new Date(current.start.getTime() - duration),
      end: new Date(current.start.getTime()),
    };
  }

  async getDashboardStats(query: DashboardQueryDto) {
    const period = query.period || DashboardPeriod.WEEK;
    const { start, end } = this.getDateRange(period);
    const previous = this.getPreviousDateRange(period);

    // Current period stats
    const [
      currentRevenue,
      currentOrders,
      currentCustomers,
      currentLaundries,
      previousRevenue,
      previousOrders,
      previousCustomers,
      previousLaundries,
    ] = await Promise.all([
      // Current period
      this.prisma.order.aggregate({
        where: {
          created_at: { gte: start, lte: end },
          payment_status: 'COMPLETED',
        },
        _sum: { total_amount: true },
      }),
      this.prisma.order.count({
        where: { created_at: { gte: start, lte: end } },
      }),
      this.prisma.user.count({
        where: {
          status: 'ACTIVE',
          orders: { some: { created_at: { gte: start, lte: end } } },
        },
      }),
      this.prisma.laundry.count({
        where: { status: 'ACTIVE' },
      }),
      // Previous period
      this.prisma.order.aggregate({
        where: {
          created_at: { gte: previous.start, lte: previous.end },
          payment_status: 'COMPLETED',
        },
        _sum: { total_amount: true },
      }),
      this.prisma.order.count({
        where: { created_at: { gte: previous.start, lte: previous.end } },
      }),
      this.prisma.user.count({
        where: {
          status: 'ACTIVE',
          orders: {
            some: { created_at: { gte: previous.start, lte: previous.end } },
          },
        },
      }),
      this.prisma.laundry.count({
        where: {
          status: 'ACTIVE',
          created_at: { lte: previous.end },
        },
      }),
    ]);

    const calcChange = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const currentRevenueValue = currentRevenue._sum.total_amount || 0;
    const previousRevenueValue = previousRevenue._sum.total_amount || 0;

    return {
      revenue: {
        value: currentRevenueValue,
        change: calcChange(currentRevenueValue, previousRevenueValue),
        changeType: currentRevenueValue >= previousRevenueValue ? 'increase' : 'decrease',
      },
      orders: {
        value: currentOrders,
        change: calcChange(currentOrders, previousOrders),
        changeType: currentOrders >= previousOrders ? 'increase' : 'decrease',
      },
      customers: {
        value: currentCustomers,
        change: calcChange(currentCustomers, previousCustomers),
        changeType: currentCustomers >= previousCustomers ? 'increase' : 'decrease',
      },
      laundries: {
        value: currentLaundries,
        change: calcChange(currentLaundries, previousLaundries),
        changeType: currentLaundries >= previousLaundries ? 'increase' : 'decrease',
      },
      period,
      date_range: { start, end },
    };
  }

  async getDashboardChartData(query: DashboardQueryDto) {
    const period = query.period || DashboardPeriod.WEEK;
    const { start, end } = this.getDateRange(period);

    // Generate labels based on period
    const labels: string[] = [];

    switch (period) {
      case DashboardPeriod.TODAY:
        for (let i = 0; i < 24; i++) {
          labels.push(`${i}:00`);
        }
        break;
      case DashboardPeriod.WEEK: {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          labels.push(days[d.getDay()]);
        }
        break;
      }
      case DashboardPeriod.MONTH:
        for (let i = 30; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
        }
        break;
      case DashboardPeriod.YEAR: {
        const months = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const currentMonth = new Date().getMonth();
        for (let i = 11; i >= 0; i--) {
          labels.push(months[(currentMonth - i + 12) % 12]);
        }
        break;
      }
    }

    // Get orders within the date range
    const orders = await this.prisma.order.findMany({
      where: {
        created_at: { gte: start, lte: end },
      },
      select: {
        id: true,
        total_amount: true,
        payment_status: true,
        created_at: true,
      },
    });

    // Group data
    const chartData = labels.map((label, index) => {
      let matchingOrders: typeof orders = [];

      if (period === DashboardPeriod.TODAY) {
        matchingOrders = orders.filter((o) => {
          const hour = new Date(o.created_at).getHours();
          return hour === index;
        });
      } else if (period === DashboardPeriod.WEEK) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - (6 - index));
        matchingOrders = orders.filter((o) => {
          const orderDate = new Date(o.created_at);
          return orderDate.toDateString() === targetDate.toDateString();
        });
      } else if (period === DashboardPeriod.MONTH) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - (30 - index));
        matchingOrders = orders.filter((o) => {
          const orderDate = new Date(o.created_at);
          return orderDate.toDateString() === targetDate.toDateString();
        });
      } else if (period === DashboardPeriod.YEAR) {
        const currentMonth = new Date().getMonth();
        const targetMonth = (currentMonth - (11 - index) + 12) % 12;
        const targetYear = new Date().getFullYear() - (currentMonth - (11 - index) < 0 ? 1 : 0);
        matchingOrders = orders.filter((o) => {
          const orderDate = new Date(o.created_at);
          return orderDate.getMonth() === targetMonth && orderDate.getFullYear() === targetYear;
        });
      }

      const revenue = matchingOrders
        .filter((o) => o.payment_status === 'COMPLETED')
        .reduce((sum, o) => sum + (o.total_amount || 0), 0);

      return {
        name: label,
        revenue,
        orders: matchingOrders.length,
      };
    });

    return chartData;
  }

  async getDashboardOrderStatus(query: DashboardQueryDto) {
    const period = query.period || DashboardPeriod.WEEK;
    const { start, end } = this.getDateRange(period);

    const [completed, processing, pending, cancelled, ready, outForDelivery] = await Promise.all([
      this.prisma.order.count({
        where: {
          created_at: { gte: start, lte: end },
          status: { in: ['COMPLETED', 'DELIVERED'] },
        },
      }),
      this.prisma.order.count({
        where: {
          created_at: { gte: start, lte: end },
          status: 'PROCESSING',
        },
      }),
      this.prisma.order.count({
        where: {
          created_at: { gte: start, lte: end },
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
      }),
      this.prisma.order.count({
        where: {
          created_at: { gte: start, lte: end },
          status: 'CANCELLED',
        },
      }),
      this.prisma.order.count({
        where: {
          created_at: { gte: start, lte: end },
          status: 'READY',
        },
      }),
      this.prisma.order.count({
        where: {
          created_at: { gte: start, lte: end },
          status: 'OUT_FOR_DELIVERY',
        },
      }),
    ]);

    return [
      { name: 'Completed', value: completed, color: '#22c55e' },
      { name: 'Processing', value: processing, color: '#3b82f6' },
      { name: 'Pending', value: pending, color: '#f59e0b' },
      { name: 'Cancelled', value: cancelled, color: '#ef4444' },
      { name: 'Ready', value: ready, color: '#8b5cf6' },
      { name: 'Out for Delivery', value: outForDelivery, color: '#06b6d4' },
    ];
  }

  async getDashboardRecentOrders(limit = 5) {
    const orders = await this.prisma.order.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        order_number: true,
        total_amount: true,
        status: true,
        created_at: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        laundry: {
          select: {
            id: true,
            laundry_name: true,
          },
        },
      },
    });

    return orders.map((order) => ({
      id: order.order_number,
      customer: order.customer?.name || 'Unknown',
      laundry: order.laundry?.laundry_name || 'Unknown',
      amount: order.total_amount,
      status: order.status,
      time: order.created_at,
    }));
  }

  async getDashboardTopLaundries(query: DashboardQueryDto, limit = 5) {
    const period = query.period || DashboardPeriod.WEEK;
    const { start, end } = this.getDateRange(period);

    // Get laundries with their order stats
    const laundries = await this.prisma.laundry.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        laundry_name: true,
        rating: true,
        orders: {
          where: {
            created_at: { gte: start, lte: end },
            payment_status: 'COMPLETED',
          },
          select: {
            id: true,
            total_amount: true,
          },
        },
      },
    });

    // Calculate stats and sort by revenue
    const laundryStats = laundries
      .map((laundry) => ({
        id: laundry.id,
        name: laundry.laundry_name || 'Unknown',
        orders: laundry.orders.length,
        revenue: laundry.orders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
        rating: laundry.rating,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return laundryStats;
  }

  async getDashboardSummary(query: DashboardQueryDto) {
    const [stats, chartData, orderStatus, recentOrders, topLaundries] = await Promise.all([
      this.getDashboardStats(query),
      this.getDashboardChartData(query),
      this.getDashboardOrderStatus(query),
      this.getDashboardRecentOrders(5),
      this.getDashboardTopLaundries(query, 4),
    ]);

    return {
      stats,
      chart_data: chartData,
      order_status: orderStatus,
      recent_orders: recentOrders,
      top_laundries: topLaundries,
    };
  }

  // ==================== NOTIFICATIONS ====================

  async getNotifications(query: AdminNotificationsQueryDto) {
    const { page = 1, limit = 10, search, type, target } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.NotificationWhereInput = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type && type !== AdminNotificationType.ALL) {
      where.type = type as any;
    }

    // Target filtering - check if notification has user_id or laundry_id
    if (target === NotificationTarget.CUSTOMERS) {
      where.user_id = { not: null };
      where.laundry_id = null;
    } else if (target === NotificationTarget.LAUNDRIES) {
      where.laundry_id = { not: null };
    }

    // Get notifications grouped by title + body + type (to identify campaigns)
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true } },
          laundry: { select: { id: true, laundry_name: true } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.body,
        type: n.type,
        target: n.laundry_id ? 'LAUNDRIES' : n.user_id ? 'CUSTOMERS' : 'ALL_USERS',
        recipient: n.user?.name || n.laundry?.laundry_name || 'Unknown',
        is_read: n.is_read,
        is_sent: n.is_sent,
        sent_at: n.sent_at,
        created_at: n.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getNotificationCampaigns(query: AdminNotificationsQueryDto) {
    const { page = 1, limit = 10, search, type } = query;
    const skip = (page - 1) * limit;

    // Get unique campaigns (grouped by title + body within same minute)
    const campaigns = await this.prisma.$queryRaw<
      Array<{
        title: string;
        body: string;
        type: string;
        sent_count: bigint;
        read_count: bigint;
        created_at: Date;
        target: string;
      }>
    >`
      SELECT
        title,
        body,
        type,
        COUNT(*) as sent_count,
        SUM(CASE WHEN is_read = true THEN 1 ELSE 0 END) as read_count,
        MIN(created_at) as created_at,
        CASE
          WHEN COUNT(laundry_id) > 0 AND COUNT(user_id) = 0 THEN 'LAUNDRIES'
          WHEN COUNT(user_id) > 0 AND COUNT(laundry_id) = 0 THEN 'CUSTOMERS'
          ELSE 'ALL_USERS'
        END as target
      FROM notifications
      WHERE 1=1
      ${search ? Prisma.sql`AND (title ILIKE ${`%${search}%`} OR body ILIKE ${`%${search}%`})` : Prisma.empty}
      ${type && type !== AdminNotificationType.ALL ? Prisma.sql`AND type = ${type}::"NotificationType"` : Prisma.empty}
      GROUP BY title, body, type, DATE_TRUNC('minute', created_at)
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${skip}
    `;

    // Get total count
    const totalResult = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM (
        SELECT title, body, type
        FROM notifications
        WHERE 1=1
        ${search ? Prisma.sql`AND (title ILIKE ${`%${search}%`} OR body ILIKE ${`%${search}%`})` : Prisma.empty}
        ${type && type !== AdminNotificationType.ALL ? Prisma.sql`AND type = ${type}::"NotificationType"` : Prisma.empty}
        GROUP BY title, body, type, DATE_TRUNC('minute', created_at)
      ) as campaigns
    `;

    const total = Number(totalResult[0]?.count || 0);

    return {
      data: campaigns.map((c, index) => ({
        id: `campaign-${index}-${c.created_at.getTime()}`,
        title: c.title,
        message: c.body,
        type: c.type,
        target: c.target,
        sent_count: Number(c.sent_count),
        read_count: Number(c.read_count),
        created_at: c.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async sendNotification(dto: SendNotificationDto) {
    const { title, message, type, target, image } = dto;

    // Get target users based on target audience
    let userIds: string[] = [];
    let laundryIds: string[] = [];

    if (target === NotificationTarget.CUSTOMERS || target === NotificationTarget.ALL_USERS) {
      const users = await this.prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }

    if (target === NotificationTarget.LAUNDRIES || target === NotificationTarget.ALL_USERS) {
      const laundries = await this.prisma.laundry.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });
      laundryIds = laundries.map((l) => l.id);
    }

    // Create notifications for users
    const userNotifications = userIds.map((userId) => ({
      user_id: userId,
      title,
      body: message,
      type: type as any,
      image,
      is_sent: true,
      sent_at: new Date(),
    }));

    // Create notifications for laundries
    const laundryNotifications = laundryIds.map((laundryId) => ({
      laundry_id: laundryId,
      title,
      body: message,
      type: type as any,
      image,
      is_sent: true,
      sent_at: new Date(),
    }));

    // Bulk create notifications
    const allNotifications = [...userNotifications, ...laundryNotifications];

    if (allNotifications.length > 0) {
      await this.prisma.notification.createMany({
        data: allNotifications,
      });
    }

    return {
      sent_count: allNotifications.length,
      user_count: userIds.length,
      laundry_count: laundryIds.length,
    };
  }

  async sendBulkNotification(dto: SendBulkNotificationDto) {
    const { title, message, type, user_ids, image } = dto;

    // Create notifications for specified users
    const notifications = user_ids.map((userId) => ({
      user_id: userId,
      title,
      body: message,
      type: type as any,
      image,
      is_sent: true,
      sent_at: new Date(),
    }));

    await this.prisma.notification.createMany({
      data: notifications,
    });

    return {
      sent_count: notifications.length,
    };
  }

  async getNotificationStats() {
    const [totalNotifications, totalSent, totalRead, typeBreakdown, recentCampaigns] =
      await Promise.all([
        this.prisma.notification.count(),
        this.prisma.notification.count({ where: { is_sent: true } }),
        this.prisma.notification.count({ where: { is_read: true } }),
        this.prisma.notification.groupBy({
          by: ['type'],
          _count: { type: true },
        }),
        this.prisma.$queryRaw<
          Array<{
            title: string;
            sent_count: bigint;
            read_count: bigint;
            created_at: Date;
          }>
        >`
        SELECT
          title,
          COUNT(*) as sent_count,
          SUM(CASE WHEN is_read = true THEN 1 ELSE 0 END) as read_count,
          MIN(created_at) as created_at
        FROM notifications
        GROUP BY title, body, DATE_TRUNC('minute', created_at)
        ORDER BY created_at DESC
        LIMIT 5
      `,
      ]);

    // Calculate total reach (unique users + laundries)
    const [uniqueUsers, uniqueLaundries] = await Promise.all([
      this.prisma.notification.groupBy({
        by: ['user_id'],
        where: { user_id: { not: null } },
      }),
      this.prisma.notification.groupBy({
        by: ['laundry_id'],
        where: { laundry_id: { not: null } },
      }),
    ]);

    const types: Record<string, number> = {};
    typeBreakdown.forEach((t) => {
      types[t.type] = t._count.type;
    });

    return {
      total: totalNotifications,
      sent: totalSent,
      read: totalRead,
      read_rate: totalSent > 0 ? Math.round((totalRead / totalSent) * 100) : 0,
      total_reach: uniqueUsers.length + uniqueLaundries.length,
      types,
      recent_campaigns: recentCampaigns.map((c) => ({
        title: c.title,
        sent_count: Number(c.sent_count),
        read_count: Number(c.read_count),
        created_at: c.created_at,
      })),
    };
  }

  async deleteNotification(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({ where: { id } });

    return { message: 'Notification deleted successfully' };
  }

  // ==================== SETTINGS ====================

  // Default settings values
  private readonly defaultSettings: Record<string, any> = {
    // General
    app_name: 'E-Laundry',
    support_email: 'support@elaundry.pk',
    support_phone: '+92 300 1234567',
    currency: 'PKR',
    timezone: 'Asia/Karachi',
    maintenance_mode: false,
    // Pricing
    delivery_fee: 100,
    free_delivery_threshold: 1000,
    express_multiplier: 1.5,
    platform_commission: 15,
    tax_percentage: 0,
    // Delivery
    default_pickup_radius: 10,
    max_pickup_radius: 25,
    min_order_amount: 200,
    standard_delivery_days: 2,
    express_delivery_days: 1,
    // Notifications
    notify_new_order: true,
    notify_order_status: true,
    notify_promotional: true,
    notify_system: true,
    // Security
    otp_expiry_minutes: 5,
    max_login_attempts: 5,
    session_timeout_hours: 24,
    require_phone_verification: true,
    // Appearance
    primary_color: '#3b82f6',
    secondary_color: '#1e293b',
    logo_url: '',
  };

  async getAllSettings() {
    const dbSettings = await this.prisma.appSetting.findMany();

    // Merge defaults with database values
    const settings: Record<string, any> = { ...this.defaultSettings };

    dbSettings.forEach((setting) => {
      settings[setting.key] = setting.value;
    });

    return settings;
  }

  async getSetting(key: string) {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key },
    });

    if (setting) {
      return { key, value: setting.value };
    }

    // Return default if exists
    if (key in this.defaultSettings) {
      return { key, value: this.defaultSettings[key] };
    }

    throw new NotFoundException(`Setting "${key}" not found`);
  }

  async updateSetting(key: string, value: any) {
    // Upsert the setting
    const setting = await this.prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return {
      key: setting.key,
      value: setting.value,
      updated_at: setting.updated_at,
    };
  }

  async updateSettingsBulk(dto: BulkUpdateSettingsDto) {
    const { settings } = dto;
    const results: Array<{ key: string; value: any }> = [];

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      const setting = await this.prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
      results.push({ key: setting.key, value: setting.value });
    }

    return {
      updated: results.length,
      settings: results,
    };
  }

  async deleteSetting(key: string) {
    const setting = await this.prisma.appSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting "${key}" not found`);
    }

    await this.prisma.appSetting.delete({ where: { key } });

    return { message: `Setting "${key}" deleted successfully` };
  }

  async resetSettings() {
    // Delete all settings to reset to defaults
    await this.prisma.appSetting.deleteMany();

    return {
      message: 'All settings reset to defaults',
      settings: this.defaultSettings,
    };
  }

  async getSettingsByCategory(category: string) {
    const categoryKeys: Record<string, string[]> = {
      general: [
        'app_name',
        'support_email',
        'support_phone',
        'currency',
        'timezone',
        'maintenance_mode',
      ],
      pricing: [
        'delivery_fee',
        'free_delivery_threshold',
        'express_multiplier',
        'platform_commission',
        'tax_percentage',
      ],
      delivery: [
        'default_pickup_radius',
        'max_pickup_radius',
        'min_order_amount',
        'standard_delivery_days',
        'express_delivery_days',
      ],
      notifications: [
        'notify_new_order',
        'notify_order_status',
        'notify_promotional',
        'notify_system',
      ],
      security: [
        'otp_expiry_minutes',
        'max_login_attempts',
        'session_timeout_hours',
        'require_phone_verification',
      ],
      appearance: ['primary_color', 'secondary_color', 'logo_url'],
    };

    const keys = categoryKeys[category];
    if (!keys) {
      throw new NotFoundException(`Category "${category}" not found`);
    }

    const allSettings = await this.getAllSettings();
    const categorySettings: Record<string, any> = {};

    keys.forEach((key) => {
      categorySettings[key] = allSettings[key];
    });

    return categorySettings;
  }
}
