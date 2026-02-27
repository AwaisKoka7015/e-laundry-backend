import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LaundriesService } from './laundries.service';
import {
  UpdateLaundryProfileDto,
  GetLaundriesDto,
  GetNearbyLaundriesDto,
  GetTopRatedLaundriesDto,
  SortBy,
  SortOrder,
  LaundryRegisterDto,
  LaundrySetupLocationDto,
  LaundrySelectServicesDto,
  LaundryUpdatePricesDto,
  SubmitVerificationDto,
  ResubmitVerificationDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, Roles, RolesGuard, Public } from '../common';

@Controller()
export class LaundriesController {
  constructor(private readonly laundriesService: LaundriesService) {}

  // ==================== LAUNDRY ONBOARDING APIs ====================

  @Public()
  @Post('laundries/register')
  @ApiTags('Laundry Onboarding')
  @ApiOperation({
    summary: 'Step 1: Register a new laundry',
    description: 'Register a new laundry with phone verification, store name, and owner name',
  })
  @ApiResponse({
    status: 201,
    description: 'Laundry registered successfully',
    schema: {
      example: {
        success: true,
        data: {
          laundry_id: 'uuid',
          access_token: 'jwt...',
          refresh_token: 'jwt...',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  @ApiResponse({ status: 409, description: 'Phone already registered' })
  async registerLaundry(@Body() dto: LaundryRegisterDto) {
    const data = await this.laundriesService.registerLaundry(dto);
    return {
      success: true,
      data,
    };
  }

  @Put('laundries/setup/location')
  @ApiTags('Laundry Onboarding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Step 2: Set laundry location',
    description: 'Set GPS coordinates, address, city, and area for the laundry',
  })
  @ApiResponse({ status: 200, description: 'Location saved' })
  async setupLocation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: LaundrySetupLocationDto,
  ) {
    const data = await this.laundriesService.setupLocation(user.sub, dto);
    return {
      success: true,
      message: 'Location saved successfully',
      data,
    };
  }

  @Post('laundries/setup/select-services')
  @ApiTags('Laundry Onboarding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Step 3: Select services to offer',
    description:
      'Select which service categories (Wash & Iron, Iron Only, Dry Clean) to offer. Auto-generates pricing from defaults.',
  })
  @ApiResponse({
    status: 200,
    description: 'Services selected and pricing generated',
    schema: {
      example: {
        success: true,
        data: {
          total_services: 3,
          total_pricing_rows: 91,
        },
      },
    },
  })
  async selectServices(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: LaundrySelectServicesDto,
  ) {
    const data = await this.laundriesService.selectServices(user.sub, dto);
    return {
      success: true,
      message: `Selected ${data.total_services} services with ${data.total_pricing_rows} pricing entries`,
      data,
    };
  }

  @Get('laundries/setup/review-prices')
  @ApiTags('Laundry Onboarding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Step 4a: Review prices',
    description:
      'Get all pricing entries for review. Prices are grouped by service → category → items.',
  })
  @ApiResponse({ status: 200, description: 'Pricing data for review' })
  async getReviewPrices(@CurrentUser() user: CurrentUserPayload) {
    const data = await this.laundriesService.getReviewPrices(user.sub);
    return {
      success: true,
      data,
    };
  }

  @Put('laundries/setup/update-prices')
  @ApiTags('Laundry Onboarding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Step 4b: Update prices',
    description: 'Update individual pricing entries. Prices must be within ±50% of default.',
  })
  @ApiResponse({ status: 200, description: 'Prices updated' })
  @ApiResponse({ status: 400, description: 'Price outside allowed range' })
  async updatePrices(@CurrentUser() user: CurrentUserPayload, @Body() dto: LaundryUpdatePricesDto) {
    const data = await this.laundriesService.updatePrices(user.sub, dto);
    return {
      success: true,
      message: `Updated ${data.updated_count} prices`,
      data,
    };
  }

  @Post('laundries/setup/go-live')
  @ApiTags('Laundry Onboarding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Step 5: Go live',
    description:
      'Complete onboarding and make laundry visible to customers. No admin approval needed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Laundry is now live',
    schema: {
      example: {
        success: true,
        message: 'Your laundry is now live!',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Setup not complete' })
  async goLive(@CurrentUser() user: CurrentUserPayload) {
    const data = await this.laundriesService.goLive(user.sub);
    return data;
  }

  // ==================== LAUNDRY CNIC VERIFICATION APIs ====================

  @Get('laundries/verification')
  @ApiTags('Laundry Verification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get verification status',
    description: 'Get the current CNIC verification status for the authenticated laundry',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification status',
    schema: {
      example: {
        success: true,
        data: {
          verification_status: 'NOT_SUBMITTED',
          is_verified: false,
        },
      },
    },
  })
  async getVerificationStatus(@CurrentUser() user: CurrentUserPayload) {
    const data = await this.laundriesService.getVerificationStatus(user.sub);
    return {
      success: true,
      data,
    };
  }

  @Post('laundries/verification')
  @ApiTags('Laundry Verification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit CNIC documents for verification',
    description:
      'Submit CNIC number and images for verification. Uploads should be done via /upload/cnic first.',
  })
  @ApiResponse({
    status: 201,
    description: 'Verification submitted',
    schema: {
      example: {
        success: true,
        message: 'Verification documents submitted successfully',
        data: {
          verification_status: 'PENDING_REVIEW',
          verification_submitted_at: '2024-01-15T10:30:00Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Already submitted or invalid data' })
  async submitVerification(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitVerificationDto,
  ) {
    const data = await this.laundriesService.submitVerification(user.sub, dto);
    return {
      success: true,
      ...data,
    };
  }

  @Put('laundries/verification')
  @ApiTags('Laundry Verification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Resubmit CNIC documents after rejection',
    description:
      'Resubmit CNIC documents after a previous rejection. Only allowed if status is REJECTED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification resubmitted',
    schema: {
      example: {
        success: true,
        message: 'Verification documents resubmitted successfully',
        data: {
          verification_status: 'PENDING_REVIEW',
          verification_submitted_at: '2024-01-16T14:20:00Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Not in rejected state' })
  async resubmitVerification(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ResubmitVerificationDto,
  ) {
    const data = await this.laundriesService.resubmitVerification(user.sub, dto);
    return {
      success: true,
      ...data,
    };
  }

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

  @Get('laundries/:id/status')
  @ApiTags('Laundries')
  @ApiOperation({
    summary: 'Get laundry status (for Flutter app)',
    description:
      'Returns is_open and status for a specific laundry. Useful to check if laundry is currently available.',
  })
  @ApiResponse({
    status: 200,
    description: 'Laundry status',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          laundry_name: 'Clean & Fresh',
          is_open: true,
          status: 'ACTIVE',
          is_available: true,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Laundry not found' })
  async getLaundryStatus(@Param('id') id: string) {
    const data = await this.laundriesService.getLaundryStatus(id);
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

  @Get('laundries/:id/pricing')
  @ApiTags('Laundries')
  @ApiOperation({
    summary: 'Get laundry pricing',
    description:
      'Get active pricing for a laundry, grouped by service category and clothing category',
  })
  @ApiResponse({
    status: 200,
    description: 'Laundry pricing',
    schema: {
      example: {
        success: true,
        data: {
          services: [
            {
              service: {
                id: 'uuid',
                name: 'Wash & Iron',
                name_urdu: 'دھلائی اور استری',
                estimated_hours: 24,
              },
              categories: [
                {
                  category: { id: 'uuid', name: 'Men', name_urdu: 'مردانہ' },
                  items: [{ id: 'uuid', name: 'Shirt', name_urdu: 'قمیض', price: 80 }],
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Laundry not found' })
  async getLaundryPricing(@Param('id') id: string) {
    const data = await this.laundriesService.getLaundryPricing(id);
    return {
      success: true,
      data,
    };
  }

  // ==================== LAUNDRY OWNER APIs (Protected) ====================

  @Put('laundry/update-profile')
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

  @Patch('laundry/toggle-open')
  @ApiTags('Laundries')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Toggle shop open/close (Laundry owner only)',
    description:
      'Toggle the shop open/close status. Optionally pass is_open to set specific value.',
  })
  @ApiResponse({
    status: 200,
    description: 'Shop status updated',
    schema: {
      example: {
        success: true,
        data: {
          is_open: true,
          message: 'Shop is now open',
        },
      },
    },
  })
  async toggleShopOpen(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { is_open?: boolean },
  ) {
    const data = await this.laundriesService.toggleShopOpen(user.sub, body?.is_open);
    return {
      success: true,
      data,
    };
  }
}
