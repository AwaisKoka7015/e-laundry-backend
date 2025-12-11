import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto, ReplyReviewDto } from './dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  // Customer: Create review for an order
  async createReview(orderId: string, customerId: string, dto: CreateReviewDto) {
    // Get order
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customer_id: customerId,
      },
      include: { review: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'COMPLETED' && order.status !== 'DELIVERED') {
      throw new BadRequestException('Can only review completed orders');
    }

    if (order.review) {
      throw new ConflictException('Order already has a review');
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        order_id: orderId,
        customer_id: customerId,
        laundry_id: order.laundry_id,
        rating: dto.rating,
        comment: dto.comment,
        service_rating: dto.service_rating,
        delivery_rating: dto.delivery_rating,
        value_rating: dto.value_rating,
        images: dto.images || [],
      },
      include: {
        customer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Update laundry rating
    await this.updateLaundryRating(order.laundry_id);

    return { review };
  }

  // Customer: Get review for an order
  async getOrderReview(orderId: string, customerId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customer_id: customerId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const review = await this.prisma.review.findUnique({
      where: { order_id: orderId },
      include: {
        customer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    return { review, can_review: !review && (order.status === 'COMPLETED' || order.status === 'DELIVERED') };
  }

  // Public: Get laundry reviews
  async getLaundryReviews(laundryId: string, page = 1, limit = 10) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: {
          laundry_id: laundryId,
          is_visible: true,
        },
        include: {
          customer: {
            select: { id: true, name: true, avatar: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({
        where: { laundry_id: laundryId, is_visible: true },
      }),
    ]);

    // Calculate rating distribution
    const ratingDistribution = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { laundry_id: laundryId, is_visible: true },
      _count: true,
    });

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingDistribution.forEach((r) => {
      distribution[Math.round(r.rating)] = r._count;
    });

    return {
      reviews,
      summary: {
        average_rating: laundry.rating,
        total_reviews: laundry.total_reviews,
        distribution,
      },
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    };
  }

  // Laundry: Get my reviews
  async getMyReviews(laundryId: string, page = 1, limit = 10) {
    const [reviews, total, unreplied] = await Promise.all([
      this.prisma.review.findMany({
        where: { laundry_id: laundryId },
        include: {
          customer: {
            select: { id: true, name: true, avatar: true },
          },
          order: {
            select: { order_number: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where: { laundry_id: laundryId } }),
      this.prisma.review.count({
        where: { laundry_id: laundryId, laundry_reply: null },
      }),
    ]);

    return {
      reviews,
      unreplied_count: unreplied,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    };
  }

  // Laundry: Reply to review
  async replyToReview(reviewId: string, laundryId: string, dto: ReplyReviewDto) {
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        laundry_id: laundryId,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.laundry_reply) {
      throw new ConflictException('Already replied to this review');
    }

    const updated = await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        laundry_reply: dto.reply,
        replied_at: new Date(),
      },
      include: {
        customer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    return { review: updated };
  }

  // Helper: Update laundry rating
  private async updateLaundryRating(laundryId: string) {
    const stats = await this.prisma.review.aggregate({
      where: {
        laundry_id: laundryId,
        is_visible: true,
      },
      _avg: { rating: true },
      _count: true,
    });

    await this.prisma.laundry.update({
      where: { id: laundryId },
      data: {
        rating: stats._avg.rating || 0,
        total_reviews: stats._count,
      },
    });
  }
}
