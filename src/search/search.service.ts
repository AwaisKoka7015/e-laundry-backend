import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async searchLaundries(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
    categoryId?: string,
    minRating?: number,
    sortBy: string = 'distance',
    page: number = 1,
    limit: number = 10,
  ) {
    // Get all active laundries
    const laundries = await this.prisma.laundry.findMany({
      where: {
        status: 'ACTIVE',
        latitude: { not: null },
        longitude: { not: null },
        ...(minRating && { rating: { gte: minRating } }),
      },
      include: {
        services: {
          where: {
            is_available: true,
            ...(categoryId && { category_id: categoryId }),
          },
          include: { category: true },
          take: 3,
        },
      },
    });

    // Calculate distances and filter
    const laundriesWithDistance = laundries
      .map((laundry) => {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          laundry.latitude!,
          laundry.longitude!,
        );
        return { ...laundry, distance_km: Math.round(distance * 10) / 10 };
      })
      .filter((laundry) => laundry.distance_km <= radiusKm);

    // Filter by category if specified
    let filtered = laundriesWithDistance;
    if (categoryId) {
      filtered = laundriesWithDistance.filter(
        (l) => l.services.length > 0,
      );
    }

    // Sort
    switch (sortBy) {
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case 'orders':
        filtered.sort((a, b) => b.total_orders - a.total_orders);
        break;
      case 'distance':
      default:
        filtered.sort((a, b) => a.distance_km - b.distance_km);
        break;
    }

    // Paginate
    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    // Format response
    const results = paginated.map((l) => ({
      id: l.id,
      laundry_name: l.laundry_name,
      laundry_logo: l.laundry_logo,
      rating: l.rating,
      total_reviews: l.total_reviews,
      total_orders: l.total_orders,
      distance_km: l.distance_km,
      address_text: l.address_text,
      city: l.city,
      is_verified: l.is_verified,
      services_preview: l.services.map((s) => s.category.name),
      services_count: l.services_count,
    }));

    return {
      laundries: results,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    };
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
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
