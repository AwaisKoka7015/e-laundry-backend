import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ReplyReviewDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, Roles, RolesGuard, PaginationQueryDto } from '../common';

@Controller()
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // ==================== CUSTOMER ENDPOINTS ====================

  @Post('orders/:id/review')
  @ApiTags('Reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit review for order' })
  @ApiResponse({ status: 201, description: 'Review submitted' })
  async createReview(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') orderId: string,
    @Body() dto: CreateReviewDto,
  ) {
    const data = await this.reviewsService.createReview(orderId, user.sub, dto);
    return {
      success: true,
      message: 'Review submitted successfully',
      data,
    };
  }

  @Get('orders/:id/review')
  @ApiTags('Reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get review for order' })
  @ApiResponse({ status: 200, description: 'Order review' })
  async getOrderReview(@CurrentUser() user: CurrentUserPayload, @Param('id') orderId: string) {
    const data = await this.reviewsService.getOrderReview(orderId, user.sub);
    return { success: true, data };
  }

  // ==================== PUBLIC ENDPOINTS ====================

  @Get('laundries/:id/reviews')
  @ApiTags('Search')
  @ApiOperation({ summary: 'Get laundry reviews (public)' })
  @ApiResponse({ status: 200, description: 'Laundry reviews' })
  async getLaundryReviews(
    @Param('id') laundryId: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const data = await this.reviewsService.getLaundryReviews(
      laundryId,
      pagination?.page,
      pagination?.limit,
    );
    return {
      success: true,
      data: { reviews: data.reviews, summary: data.summary },
      pagination: data.pagination,
    };
  }

  // ==================== LAUNDRY ENDPOINTS ====================

  @Get('laundry/reviews')
  @ApiTags('Reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get my reviews' })
  @ApiResponse({ status: 200, description: 'My reviews' })
  async getMyReviews(
    @CurrentUser() user: CurrentUserPayload,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const data = await this.reviewsService.getMyReviews(
      user.sub,
      pagination?.page,
      pagination?.limit,
    );
    return {
      success: true,
      data: { reviews: data.reviews, unreplied_count: data.unreplied_count },
      pagination: data.pagination,
    };
  }

  @Post('laundry/reviews/:id')
  @ApiTags('Reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reply to review' })
  @ApiResponse({ status: 200, description: 'Reply submitted' })
  async replyToReview(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') reviewId: string,
    @Body() dto: ReplyReviewDto,
  ) {
    const data = await this.reviewsService.replyToReview(reviewId, user.sub, dto);
    return {
      success: true,
      message: 'Reply submitted successfully',
      data,
    };
  }
}
