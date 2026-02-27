import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidatePromoDto } from './dto';

@Injectable()
export class PromoService {
  constructor(private prisma: PrismaService) {}

  async getActivePromos() {
    const now = new Date();
    const promos = await this.prisma.promoCode.findMany({
      where: {
        is_active: true,
        valid_from: { lte: now },
        valid_until: { gt: now },
      },
      select: {
        code: true,
        discount_type: true,
        discount_value: true,
        max_discount: true,
        min_order_amount: true,
        valid_until: true,
        first_order_only: true,
        usage_limit: true,
        used_count: true,
        title: true,
        subtitle: true,
        banner_color: true,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    // Filter out promos that have exceeded their usage limit
    return promos.filter(
      (p) => !p.usage_limit || p.used_count < p.usage_limit,
    );
  }

  async validatePromo(customerId: string, dto: ValidatePromoDto) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: dto.code.toUpperCase() },
    });

    if (!promo) {
      throw new BadRequestException({
        message: 'Invalid promo code',
        code: 'INVALID_PROMO',
      });
    }

    if (!promo.is_active) {
      throw new BadRequestException({
        message: 'Promo code is no longer active',
        code: 'PROMO_INACTIVE',
      });
    }

    const now = new Date();
    if (now < promo.valid_from) {
      throw new BadRequestException({
        message: 'Promo code is not yet valid',
        code: 'PROMO_NOT_STARTED',
      });
    }

    if (now > promo.valid_until) {
      throw new BadRequestException({
        message: 'Promo code has expired',
        code: 'PROMO_EXPIRED',
      });
    }

    if (promo.usage_limit && promo.used_count >= promo.usage_limit) {
      throw new BadRequestException({
        message: 'Promo code usage limit reached',
        code: 'PROMO_LIMIT_REACHED',
      });
    }

    if (dto.order_amount < promo.min_order_amount) {
      throw new BadRequestException({
        message: `Minimum order amount is ₨${promo.min_order_amount}`,
        code: 'MIN_ORDER_NOT_MET',
      });
    }

    // Check first order only
    if (promo.first_order_only) {
      const previousOrders = await this.prisma.order.count({
        where: {
          customer_id: customerId,
          status: 'COMPLETED',
        },
      });

      if (previousOrders > 0) {
        throw new BadRequestException({
          message: 'This promo code is for first order only',
          code: 'FIRST_ORDER_ONLY',
        });
      }
    }

    // Check applicable laundries
    const specificLaundries = promo.specific_laundries as string[] | null;
    if (
      dto.laundry_id &&
      specificLaundries &&
      specificLaundries.length > 0 &&
      !specificLaundries.includes(dto.laundry_id)
    ) {
      throw new BadRequestException({
        message: 'Promo code is not valid for this laundry',
        code: 'LAUNDRY_NOT_APPLICABLE',
      });
    }

    // Calculate discount
    let discount = 0;
    if (promo.discount_type === 'PERCENTAGE') {
      discount = (dto.order_amount * promo.discount_value) / 100;
      if (promo.max_discount) {
        discount = Math.min(discount, promo.max_discount);
      }
    } else {
      discount = Math.min(promo.discount_value, dto.order_amount);
    }

    return {
      promo: {
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        max_discount: promo.max_discount,
        min_order_amount: promo.min_order_amount,
        valid_until: promo.valid_until,
      },
      calculated_discount: Math.round(discount),
      final_amount: Math.round(dto.order_amount - discount),
    };
  }
}
