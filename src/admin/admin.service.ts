import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminUsersQueryDto,
  UserStatusFilter,
  AdminLaundriesQueryDto,
  LaundryStatusFilter,
  LaundryVerifiedFilter,
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
}
