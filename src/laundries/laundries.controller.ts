import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LaundriesService } from './laundries.service';
import {
  UpdateLaundryProfileDto,
  GetLaundriesDto,
  GetNearbyLaundriesDto,
  GetTopRatedLaundriesDto,
  SortBy,
  SortOrder,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, Roles, RolesGuard } from '../common';

@Controller()
export class LaundriesController {
  constructor(private readonly laundriesService: LaundriesService) {}

  // ==================== CUSTOMER APIs (Public) ====================

  @Get('laundries')
  @ApiTags('Laundries')
  @ApiOperation({
    summary: 'Get all laundries',
    description: 'Get paginated list of all active laundries with filters',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search by name' })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'min_rating', required: false, type: Number, example: 4 })
  @ApiQuery({ name: 'category_id', required: false, type: String })
  @ApiQuery({ name: 'is_verified', required: false, type: Boolean })
  @ApiQuery({ name: 'sort_by', required: false, enum: SortBy, example: SortBy.RATING })
  @ApiQuery({ name: 'sort_order', required: false, enum: SortOrder, example: SortOrder.DESC })
  @ApiResponse({
    status: 200,
    description: 'List of laundries',
    schema: {
      example: {
        success: true,
        data: {
          laundries: [
            {
              id: 'uuid',
              laundry_name: 'Clean & Fresh',
              laundry_logo: 'https://...',
              rating: 4.5,
              total_reviews: 120,
              total_orders: 500,
              services_count: 15,
              is_verified: true,
              address_text: 'Gulberg, Lahore',
              city: 'Lahore',
              services_preview: ['Wash & Fold', 'Dry Clean'],
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 50,
            total_pages: 5,
            has_next: true,
            has_prev: false,
          },
        },
      },
    },
  })
  async getLaundries(@Query() dto: GetLaundriesDto) {
    const data = await this.laundriesService.getLaundries(dto);
    return {
      success: true,
      data,
    };
  }

  @Get('laundries/nearby')
  @ApiTags('Laundries')
  @ApiOperation({
    summary: 'Get nearby laundries',
    description: 'Get laundries within a radius from user location, sorted by distance',
  })
  @ApiQuery({ name: 'latitude', required: true, type: Number, example: 31.5204 })
  @ApiQuery({ name: 'longitude', required: true, type: Number, example: 74.3587 })
  @ApiQuery({
    name: 'radius_km',
    required: false,
    type: Number,
    example: 10,
    description: 'Search radius in KM (default: 10)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'min_rating', required: false, type: Number })
  @ApiQuery({ name: 'category_id', required: false, type: String })
  @ApiQuery({ name: 'sort_by', required: false, enum: SortBy, example: SortBy.DISTANCE })
  @ApiResponse({
    status: 200,
    description: 'List of nearby laundries with distance',
    schema: {
      example: {
        success: true,
        data: {
          laundries: [
            {
              id: 'uuid',
              laundry_name: 'Clean & Fresh',
              rating: 4.5,
              distance_km: 1.2,
              services_preview: ['Wash & Fold'],
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 15,
            total_pages: 2,
            has_next: true,
            has_prev: false,
          },
        },
      },
    },
  })
  async getNearbyLaundries(@Query() dto: GetNearbyLaundriesDto) {
    const data = await this.laundriesService.getNearbyLaundries(dto);
    return {
      success: true,
      data,
    };
  }

  @Get('laundries/top-rated')
  @ApiTags('Laundries')
  @ApiOperation({
    summary: 'Get top rated laundries',
    description: 'Get laundries sorted by rating and reviews',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({
    name: 'min_reviews',
    required: false,
    type: Number,
    description: 'Minimum reviews to be considered',
  })
  @ApiQuery({ name: 'category_id', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of top rated laundries',
    schema: {
      example: {
        success: true,
        data: {
          laundries: [
            {
              id: 'uuid',
              laundry_name: 'Premium Laundry',
              rating: 4.9,
              total_reviews: 250,
              is_verified: true,
            },
          ],
          pagination: {
            page: 1,
            limit: 10,
            total: 20,
            total_pages: 2,
            has_next: true,
            has_prev: false,
          },
        },
      },
    },
  })
  async getTopRatedLaundries(@Query() dto: GetTopRatedLaundriesDto) {
    const data = await this.laundriesService.getTopRatedLaundries(dto);
    return {
      success: true,
      data,
    };
  }

  @Get('laundries/:id')
  @ApiTags('Laundries')
  @ApiOperation({ summary: 'Get laundry details by ID' })
  @ApiResponse({ status: 200, description: 'Laundry details' })
  @ApiResponse({ status: 404, description: 'Laundry not found' })
  async getLaundryDetails(@Param('id') id: string) {
    const laundry = await this.laundriesService.getPublicProfile(id);
    return {
      success: true,
      data: { laundry },
    };
  }

  // ==================== LAUNDRY OWNER APIs (Protected) ====================

  @Put('auth/update-profile')
  @ApiTags('Profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update laundry profile (Laundry owner only)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateLaundryProfileDto,
  ) {
    const data = await this.laundriesService.updateProfile(user.sub, dto);
    return {
      success: true,
      message: 'Profile updated successfully',
      data,
    };
  }
}
