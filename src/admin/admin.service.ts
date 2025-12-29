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
      const totalSpent = user.orders.reduce(
        (sum, order) => sum + (order.total_amount || 0),
        0,
      );
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

  async updateUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
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

    // Soft delete by setting status to DELETED
    await this.prisma.user.update({
      where: { id },
      data: { status: 'DELETED' },
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
    const [total, active, suspended, pendingLocation] = await Promise.all([
      this.prisma.user.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { status: 'PENDING_LOCATION' } }),
    ]);

    return {
      total,
      active,
      suspended,
      pending_location: pendingLocation,
    };
  }

  // ==================== LAUNDRIES ====================

  async getLaundries(query: AdminLaundriesQueryDto) {
    const { page = 1, limit = 10, search, status, verified, city } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.LaundryWhereInput = {
      status: { not: 'DELETED' },
    };

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

  async updateLaundryStatus(id: string, status: 'ACTIVE' | 'SUSPENDED') {
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

    // Soft delete
    await this.prisma.laundry.update({
      where: { id },
      data: { status: 'DELETED' },
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
    const [total, active, suspended, verified, unverified, pendingLocation] =
      await Promise.all([
        this.prisma.laundry.count({ where: { status: { not: 'DELETED' } } }),
        this.prisma.laundry.count({ where: { status: 'ACTIVE' } }),
        this.prisma.laundry.count({ where: { status: 'SUSPENDED' } }),
        this.prisma.laundry.count({
          where: { is_verified: true, status: { not: 'DELETED' } },
        }),
        this.prisma.laundry.count({
          where: { is_verified: false, status: { not: 'DELETED' } },
        }),
        this.prisma.laundry.count({ where: { status: 'PENDING_LOCATION' } }),
      ]);

    return {
      total,
      active,
      suspended,
      verified,
      unverified,
      pending_location: pendingLocation,
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

  async updateOrderStatus(
    id: string,
    status: string,
    notes?: string,
  ) {
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
        ...(status === 'DELIVERED' && { delivered_at: new Date(), actual_delivery_date: new Date() }),
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
      throw new ConflictException(
        `Item "${dto.name}" already exists for type ${dto.type}`,
      );
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
        throw new ConflictException(
          `Item "${newName}" already exists for type ${newType}`,
        );
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
    const [total, men, women, kids, home, active, inactive] = await Promise.all(
      [
        this.prisma.clothingItem.count(),
        this.prisma.clothingItem.count({ where: { type: 'MEN' } }),
        this.prisma.clothingItem.count({ where: { type: 'WOMEN' } }),
        this.prisma.clothingItem.count({ where: { type: 'KIDS' } }),
        this.prisma.clothingItem.count({ where: { type: 'HOME' } }),
        this.prisma.clothingItem.count({ where: { is_active: true } }),
        this.prisma.clothingItem.count({ where: { is_active: false } }),
      ],
    );

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
    const [total, visible, hidden, replied, pending, avgRating, ratingCounts] =
      await Promise.all([
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
    if (promo.usage_limit && promo.used_count >= promo.usage_limit)
      return 'used_up';
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

    const [
      total,
      active,
      inactive,
      expired,
      totalDiscountGiven,
      totalUsage,
      topPromos,
    ] = await Promise.all([
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
}
