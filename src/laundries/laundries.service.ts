import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateLaundryProfileDto,
  GetLaundriesDto,
  GetNearbyLaundriesDto,
  GetTopRatedLaundriesDto,
  SortBy,
  SortOrder,
  PaginationMeta,
} from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LaundriesService {
  constructor(private prisma: PrismaService) {}

  // ==================== GET ALL LAUNDRIES ====================
  async getLaundries(dto: GetLaundriesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      city,
      min_rating,
      category_id,
      is_verified,
      sort_by = SortBy.RATING,
      sort_order = SortOrder.DESC,
    } = dto;

    // Build where clause - only show ACTIVE and is_open laundries to customers
    const where: Prisma.LaundryWhereInput = {
      status: 'ACTIVE',
      is_open: true,
      ...(search && {
        laundry_name: { contains: search, mode: 'insensitive' },
      }),
      ...(city && { city: { equals: city, mode: 'insensitive' } }),
      ...(min_rating && { rating: { gte: min_rating } }),
      ...(is_verified !== undefined && { is_verified }),
    };

    // If category filter, we need to filter by services
    if (category_id) {
      where.services = {
        some: {
          category_id,
          is_available: true,
        },
      };
    }

    // Build orderBy
    const orderBy = this.buildOrderBy(sort_by, sort_order);

    // Get total count (optimized - separate query)
    const total = await this.prisma.laundry.count({ where });

    // Get paginated results
    const laundries = await this.prisma.laundry.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: this.getLaundrySelectFields(),
    });

    // Get service previews for each laundry
    const laundryIds = laundries.map((l) => l.id);
    const servicesMap = await this.getServicesPreview(laundryIds);

    // Format response
    const formattedLaundries = laundries.map((laundry) => ({
      ...this.formatLaundryItem(laundry),
      services_preview: servicesMap.get(laundry.id) || [],
    }));

    return {
      laundries: formattedLaundries,
      pagination: this.buildPagination(page, limit, total),
    };
  }

  // ==================== GET NEARBY LAUNDRIES ====================
  async getNearbyLaundries(dto: GetNearbyLaundriesDto) {
    const {
      page = 1,
      limit = 10,
      latitude,
      longitude,
      radius_km = 10,
      min_rating,
      category_id,
      sort_by = SortBy.DISTANCE,
    } = dto;

    // Build where clause - only show ACTIVE and is_open laundries
    const where: Prisma.LaundryWhereInput = {
      status: 'ACTIVE',
      is_open: true,
      latitude: { not: null },
      longitude: { not: null },
      ...(min_rating && { rating: { gte: min_rating } }),
    };

    if (category_id) {
      where.services = {
        some: {
          category_id,
          is_available: true,
        },
      };
    }

    // Get all laundries with location (we need to calculate distance in-memory)
    // For large scale, consider PostGIS extension for spatial queries
    const allLaundries = await this.prisma.laundry.findMany({
      where,
      select: {
        ...this.getLaundrySelectFields(),
        latitude: true,
        longitude: true,
      },
    });

    // Calculate distance and filter by radius
    const laundriesWithDistance = allLaundries
      .map((laundry) => ({
        ...laundry,
        distance_km: this.calculateDistance(
          latitude,
          longitude,
          laundry.latitude!,
          laundry.longitude!,
        ),
      }))
      .filter((laundry) => laundry.distance_km <= radius_km);

    // Sort
    this.sortLaundries(laundriesWithDistance, sort_by);

    // Paginate
    const total = laundriesWithDistance.length;
    const paginated = laundriesWithDistance.slice((page - 1) * limit, page * limit);

    // Get service previews
    const laundryIds = paginated.map((l) => l.id);
    const servicesMap = await this.getServicesPreview(laundryIds);

    // Format response
    const formattedLaundries = paginated.map((laundry) => ({
      ...this.formatLaundryItem(laundry),
      distance_km: Math.round(laundry.distance_km * 10) / 10,
      services_preview: servicesMap.get(laundry.id) || [],
    }));

    return {
      laundries: formattedLaundries,
      pagination: this.buildPagination(page, limit, total),
    };
  }

  // ==================== GET TOP RATED LAUNDRIES ====================
  async getTopRatedLaundries(dto: GetTopRatedLaundriesDto) {
    const { page = 1, limit = 10, city, min_reviews = 0, category_id } = dto;

    // Build where clause - only show ACTIVE and is_open laundries
    const where: Prisma.LaundryWhereInput = {
      status: 'ACTIVE',
      is_open: true,
      total_reviews: { gte: min_reviews },
      ...(city && { city: { equals: city, mode: 'insensitive' } }),
    };

    if (category_id) {
      where.services = {
        some: {
          category_id,
          is_available: true,
        },
      };
    }

    // Get total count
    const total = await this.prisma.laundry.count({ where });

    // Get paginated results - sorted by rating DESC, then by total_reviews DESC
    const laundries = await this.prisma.laundry.findMany({
      where,
      orderBy: [{ rating: 'desc' }, { total_reviews: 'desc' }, { total_orders: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      select: this.getLaundrySelectFields(),
    });

    // Get service previews
    const laundryIds = laundries.map((l) => l.id);
    const servicesMap = await this.getServicesPreview(laundryIds);

    // Format response
    const formattedLaundries = laundries.map((laundry) => ({
      ...this.formatLaundryItem(laundry),
      services_preview: servicesMap.get(laundry.id) || [],
    }));

    return {
      laundries: formattedLaundries,
      pagination: this.buildPagination(page, limit, total),
    };
  }

  // ==================== EXISTING METHODS ====================

  async updateProfile(laundryId: string, dto: UpdateLaundryProfileDto) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    const updated = await this.prisma.laundry.update({
      where: { id: laundryId },
      data: dto,
    });

    return { user: { ...updated, role: 'LAUNDRY' } };
  }

  // ==================== TOGGLE SHOP OPEN/CLOSE ====================
  async toggleShopOpen(laundryId: string, isOpen?: boolean) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    // If isOpen is provided, use it; otherwise toggle current value
    const newIsOpen = isOpen !== undefined ? isOpen : !laundry.is_open;

    const updated = await this.prisma.laundry.update({
      where: { id: laundryId },
      data: { is_open: newIsOpen },
    });

    return {
      is_open: updated.is_open,
      message: updated.is_open ? 'Shop is now open' : 'Shop is now closed',
    };
  }

  async findById(laundryId: string) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
      include: {
        services: {
          where: { is_available: true },
          include: {
            category: true,
            pricing: {
              where: { is_available: true },
              include: { clothing_item: true },
            },
          },
        },
      },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    return laundry;
  }

  // ==================== GET LAUNDRY STATUS (FOR FLUTTER APP) ====================
  async getLaundryStatus(laundryId: string) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
      select: {
        id: true,
        is_open: true,
        status: true,
        laundry_name: true,
      },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    return {
      id: laundry.id,
      laundry_name: laundry.laundry_name,
      is_open: laundry.is_open,
      status: laundry.status,
      is_available: laundry.status === 'ACTIVE' && laundry.is_open,
    };
  }

  async getPublicProfile(laundryId: string) {
    const laundry = await this.findById(laundryId);

    return {
      id: laundry.id,
      laundry_name: laundry.laundry_name,
      laundry_logo: laundry.laundry_logo,
      description: laundry.description,
      rating: laundry.rating,
      total_reviews: laundry.total_reviews,
      total_orders: laundry.total_orders,
      services_count: laundry.services_count,
      is_verified: laundry.is_verified,
      is_open: laundry.is_open,
      latitude: laundry.latitude,
      longitude: laundry.longitude,
      address_text: laundry.address_text,
      city: laundry.city,
      near_landmark: laundry.near_landmark,
      working_hours: laundry.working_hours,
      services: laundry.services,
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Select fields for laundry list (optimized - only needed fields)
   */
  private getLaundrySelectFields() {
    return {
      id: true,
      laundry_name: true,
      laundry_logo: true,
      shop_images: true,
      rating: true,
      total_reviews: true,
      total_orders: true,
      services_count: true,
      is_verified: true,
      is_open: true,
      address_text: true,
      city: true,
      latitude: true,
      longitude: true,
    };
  }

  /**
   * Get service category names for multiple laundries (batch query)
   */
  private async getServicesPreview(laundryIds: string[]): Promise<Map<string, string[]>> {
    if (laundryIds.length === 0) return new Map();

    const services = await this.prisma.laundryService.findMany({
      where: {
        laundry_id: { in: laundryIds },
        is_available: true,
      },
      select: {
        laundry_id: true,
        category: {
          select: { name: true },
        },
      },
      distinct: ['laundry_id', 'category_id'],
    });

    const servicesMap = new Map<string, string[]>();
    services.forEach((service) => {
      const existing = servicesMap.get(service.laundry_id) || [];
      if (!existing.includes(service.category.name)) {
        existing.push(service.category.name);
      }
      servicesMap.set(service.laundry_id, existing.slice(0, 3)); // Max 3 preview
    });

    return servicesMap;
  }

  /**
   * Format laundry item for response
   */
  private formatLaundryItem(laundry: any) {
    return {
      id: laundry.id,
      laundry_name: laundry.laundry_name,
      laundry_logo: laundry.laundry_logo,
      shop_images: laundry.shop_images || [],
      rating: laundry.rating,
      total_reviews: laundry.total_reviews,
      total_orders: laundry.total_orders,
      services_count: laundry.services_count,
      is_verified: laundry.is_verified,
      is_open: laundry.is_open,
      address_text: laundry.address_text,
      city: laundry.city,
      latitude: laundry.latitude,
      longitude: laundry.longitude,
    };
  }

  /**
   * Build orderBy clause
   */
  private buildOrderBy(
    sortBy: SortBy,
    sortOrder: SortOrder,
  ): Prisma.LaundryOrderByWithRelationInput | Prisma.LaundryOrderByWithRelationInput[] {
    const order = sortOrder === SortOrder.ASC ? 'asc' : 'desc';

    switch (sortBy) {
      case SortBy.RATING:
        return { rating: order };
      case SortBy.REVIEWS:
        return { total_reviews: order };
      case SortBy.ORDERS:
        return { total_orders: order };
      case SortBy.NEWEST:
        return { created_at: order };
      default:
        return { rating: 'desc' };
    }
  }

  /**
   * Sort laundries array (for in-memory sorting after distance calculation)
   */
  private sortLaundries(
    laundries: Array<{ distance_km: number; rating: number; total_orders: number }>,
    sortBy: SortBy,
  ) {
    switch (sortBy) {
      case SortBy.RATING:
        laundries.sort((a, b) => b.rating - a.rating);
        break;
      case SortBy.ORDERS:
        laundries.sort((a, b) => b.total_orders - a.total_orders);
        break;
      case SortBy.DISTANCE:
      default:
        laundries.sort((a, b) => a.distance_km - b.distance_km);
        break;
    }
  }

  /**
   * Build pagination metadata
   */
  private buildPagination(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
