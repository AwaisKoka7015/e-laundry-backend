import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FavouriteSortBy } from './dto';

@Injectable()
export class FavouritesService {
  private readonly logger = new Logger(FavouritesService.name);

  constructor(private prisma: PrismaService) {}

  async addFavourite(userId: string, laundryId: string) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    if (laundry.status !== 'ACTIVE') {
      throw new BadRequestException('Laundry is not active');
    }

    const favourite = await this.prisma.favourite.upsert({
      where: {
        user_id_laundry_id: { user_id: userId, laundry_id: laundryId },
      },
      update: {},
      create: {
        user_id: userId,
        laundry_id: laundryId,
      },
    });

    return { favourite };
  }

  async removeFavourite(userId: string, laundryId: string) {
    await this.prisma.favourite.deleteMany({
      where: { user_id: userId, laundry_id: laundryId },
    });

    return { removed: true };
  }

  async listFavourites(
    userId: string,
    sort: FavouriteSortBy = FavouriteSortBy.MOST_ORDERED,
    userLat?: number,
    userLng?: number,
  ) {
    const favourites = await this.prisma.favourite.findMany({
      where: { user_id: userId },
      include: {
        laundry: {
          include: {
            services: {
              include: { category: true },
            },
          },
        },
      },
    });

    // Enrich each favourite with order stats
    const enriched = await Promise.all(
      favourites.map(async (fav) => {
        const [orderCount, lastOrder] = await Promise.all([
          this.prisma.order.count({
            where: { customer_id: userId, laundry_id: fav.laundry_id },
          }),
          this.prisma.order.findFirst({
            where: { customer_id: userId, laundry_id: fav.laundry_id },
            orderBy: { created_at: 'desc' },
            select: { created_at: true },
          }),
        ]);

        const serviceNames = [...new Set(fav.laundry.services.map((s) => s.category.name))];

        let distanceKm: number | null = null;
        if (
          userLat != null &&
          userLng != null &&
          fav.laundry.latitude != null &&
          fav.laundry.longitude != null
        ) {
          distanceKm = this.haversine(
            userLat,
            userLng,
            fav.laundry.latitude,
            fav.laundry.longitude,
          );
        }

        return {
          id: fav.id,
          laundry_id: fav.laundry_id,
          laundry_name: fav.laundry.laundry_name,
          laundry_logo: fav.laundry.laundry_logo,
          rating: fav.laundry.rating,
          total_reviews: fav.laundry.total_reviews,
          is_verified: fav.laundry.is_verified,
          is_open: fav.laundry.is_open,
          address: fav.laundry.address_text,
          latitude: fav.laundry.latitude,
          longitude: fav.laundry.longitude,
          delivery_fee: fav.laundry.delivery_fee,
          free_pickup_delivery: fav.laundry.free_pickup_delivery,
          services: serviceNames,
          order_count: orderCount,
          last_order_date: lastOrder?.created_at || null,
          distance_km: distanceKm != null ? Math.round(distanceKm * 10) / 10 : null,
          favourited_at: fav.created_at,
        };
      }),
    );

    // Sort
    switch (sort) {
      case FavouriteSortBy.TOP_RATED:
        enriched.sort((a, b) => b.rating - a.rating);
        break;
      case FavouriteSortBy.NEAREST:
        enriched.sort((a, b) => {
          if (a.distance_km == null && b.distance_km == null) return 0;
          if (a.distance_km == null) return 1;
          if (b.distance_km == null) return -1;
          return a.distance_km - b.distance_km;
        });
        break;
      case FavouriteSortBy.MOST_ORDERED:
      default:
        enriched.sort((a, b) => b.order_count - a.order_count);
        break;
    }

    return { favourites: enriched, total: enriched.length };
  }

  async checkIsFavourite(userId: string, laundryId: string) {
    const favourite = await this.prisma.favourite.findUnique({
      where: {
        user_id_laundry_id: { user_id: userId, laundry_id: laundryId },
      },
    });

    return { is_favourite: !!favourite };
  }

  async getCombos(userId: string) {
    // Get completed orders with items grouped by laundry
    const orders = await this.prisma.order.findMany({
      where: {
        customer_id: userId,
        status: 'COMPLETED',
      },
      include: {
        laundry: true,
        items: {
          include: {
            clothing_item: true,
            service_category: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    // Group by laundry + service category combination (combo pattern)
    const comboMap = new Map<
      string,
      {
        laundry_id: string;
        laundry_name: string;
        laundry_logo: string | null;
        service_name: string;
        items: Map<string, { name: string; icon: string | null; total_qty: number; count: number }>;
        order_count: number;
        total_spent: number;
        last_ordered: Date;
      }
    >();

    for (const order of orders) {
      // Group items by service category within this order
      const serviceGroups = new Map<string, typeof order.items>();
      for (const item of order.items) {
        const key = item.service_category_id;
        if (!serviceGroups.has(key)) {
          serviceGroups.set(key, []);
        }
        serviceGroups.get(key)!.push(item);
      }

      for (const [serviceCatId, items] of serviceGroups) {
        const comboKey = `${order.laundry_id}_${serviceCatId}`;
        const serviceName = items[0].service_category.name;

        if (!comboMap.has(comboKey)) {
          comboMap.set(comboKey, {
            laundry_id: order.laundry_id,
            laundry_name: order.laundry.laundry_name || 'Unknown',
            laundry_logo: order.laundry.laundry_logo,
            service_name: serviceName,
            items: new Map(),
            order_count: 0,
            total_spent: 0,
            last_ordered: order.created_at,
          });
        }

        const combo = comboMap.get(comboKey)!;
        combo.order_count++;
        combo.total_spent += items.reduce((sum, i) => sum + i.total_price, 0);

        if (order.created_at > combo.last_ordered) {
          combo.last_ordered = order.created_at;
        }

        for (const item of items) {
          const itemKey = item.clothing_item_id;
          if (!combo.items.has(itemKey)) {
            combo.items.set(itemKey, {
              name: item.clothing_item.name,
              icon: item.clothing_item.icon,
              total_qty: 0,
              count: 0,
            });
          }
          const existing = combo.items.get(itemKey)!;
          existing.total_qty += item.quantity;
          existing.count++;
        }
      }
    }

    // Convert to array and compute averages
    const combos = Array.from(comboMap.values())
      .filter((c) => c.order_count >= 1)
      .map((c) => ({
        laundry_id: c.laundry_id,
        laundry_name: c.laundry_name,
        laundry_logo: c.laundry_logo,
        service_name: c.service_name,
        combo_name: `${c.service_name} at ${c.laundry_name}`,
        items: Array.from(c.items.values()).map((item) => ({
          name: item.name,
          icon: item.icon,
          avg_quantity: Math.round(item.total_qty / item.count),
        })),
        order_count: c.order_count,
        avg_price: Math.round((c.total_spent / c.order_count) * 100) / 100,
        last_ordered: c.last_ordered,
      }))
      .sort((a, b) => b.order_count - a.order_count)
      .slice(0, 10);

    return { combos };
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
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
