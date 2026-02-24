import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateLaundryProfileDto,
  GetLaundriesDto,
  GetNearbyLaundriesDto,
  GetTopRatedLaundriesDto,
  SortBy,
  SortOrder,
  PaginationMeta,
  LaundryRegisterDto,
  LaundrySetupLocationDto,
  LaundrySelectServicesDto,
  LaundryUpdatePricesDto,
  SubmitVerificationDto,
  ResubmitVerificationDto,
  VerificationStatusResponse,
} from './dto';
import { Prisma, AccountStatus, LaundryVerificationStatus } from '@prisma/client';

@Injectable()
export class LaundriesService {
  private readonly DEV_OTP = '0000';

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ==================== ONBOARDING STEP 1: REGISTER ====================
  async registerLaundry(dto: LaundryRegisterDto) {
    const { phone, otp, store_name, owner_name } = dto;

    // Verify OTP (in dev mode, accept 0000)
    const isDev = this.configService.get('NODE_ENV') === 'development';
    if (!isDev) {
      // In production, verify with temp_accounts table
      const tempAccount = await this.prisma.tempAccount.findFirst({
        where: { phone_number: phone, otp_verified: true },
        orderBy: { created_at: 'desc' },
      });
      if (!tempAccount || tempAccount.otp_code !== otp) {
        throw new BadRequestException('Invalid or expired OTP');
      }
    } else if (otp !== this.DEV_OTP) {
      throw new BadRequestException('Invalid OTP');
    }

    // Check if phone already registered
    const existing = await this.prisma.laundry.findUnique({
      where: { phone_number: phone },
    });
    if (existing) {
      throw new ConflictException('Phone number already registered as a laundry');
    }

    // Create laundry
    const laundry = await this.prisma.laundry.create({
      data: {
        phone_number: phone,
        laundry_name: store_name,
        owner_name: owner_name,
        status: AccountStatus.PENDING,
        setup_step: 1,
        setup_complete: false,
      },
    });

    // Generate tokens
    const tokens = await this.generateLaundryTokens(laundry.id, phone);

    return {
      laundry_id: laundry.id,
      ...tokens,
    };
  }

  // ==================== ONBOARDING STEP 2: LOCATION ====================
  async setupLocation(laundryId: string, dto: LaundrySetupLocationDto) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    await this.prisma.laundry.update({
      where: { id: laundryId },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        address_text: dto.address,
        city: dto.city,
        area: dto.area,
        setup_step: Math.max(laundry.setup_step, 2),
      },
    });

    return { success: true };
  }

  // ==================== ONBOARDING STEP 3: SELECT SERVICES ====================
  async selectServices(laundryId: string, dto: LaundrySelectServicesDto) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    const { service_category_ids } = dto;

    // Validate service category IDs
    const serviceCategories = await this.prisma.serviceCategory.findMany({
      where: { id: { in: service_category_ids }, is_active: true },
    });

    if (serviceCategories.length !== service_category_ids.length) {
      throw new BadRequestException('Invalid service category IDs');
    }

    // Get all default prices for selected services
    const defaultPrices = await this.prisma.defaultPrice.findMany({
      where: { service_category_id: { in: service_category_ids } },
      include: {
        clothing_item: true,
      },
    });

    // Delete existing pricing for this laundry (in case of re-selection)
    await this.prisma.laundryPricing.deleteMany({
      where: { laundry_id: laundryId },
    });

    // Create laundry pricing entries from default prices
    // Popular items are auto-enabled, others disabled by default
    const pricingData = defaultPrices.map((dp) => ({
      laundry_id: laundryId,
      service_category_id: dp.service_category_id,
      clothing_item_id: dp.clothing_item_id,
      price: dp.price,
      is_active: dp.clothing_item.is_popular,
    }));

    await this.prisma.laundryPricing.createMany({
      data: pricingData,
    });

    // Update setup step
    await this.prisma.laundry.update({
      where: { id: laundryId },
      data: {
        setup_step: Math.max(laundry.setup_step, 3),
      },
    });

    return {
      total_services: serviceCategories.length,
      total_pricing_rows: pricingData.length,
    };
  }

  // ==================== ONBOARDING STEP 4: REVIEW PRICES (READ) ====================
  async getReviewPrices(laundryId: string) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    // Get all pricing entries for this laundry
    const pricingEntries = await this.prisma.laundryPricing.findMany({
      where: { laundry_id: laundryId },
      include: {
        service_category: true,
        clothing_item: {
          include: {
            clothing_category: true,
          },
        },
      },
      orderBy: [
        { service_category: { sort_order: 'asc' } },
        { clothing_item: { clothing_category: { sort_order: 'asc' } } },
        { clothing_item: { sort_order: 'asc' } },
      ],
    });

    // Get default prices for min/max calculation
    const defaultPrices = await this.prisma.defaultPrice.findMany({
      where: {
        clothing_item_id: { in: pricingEntries.map((p) => p.clothing_item_id) },
        service_category_id: { in: pricingEntries.map((p) => p.service_category_id) },
      },
    });

    const defaultPriceMap = new Map(
      defaultPrices.map((dp) => [`${dp.clothing_item_id}-${dp.service_category_id}`, dp.price]),
    );

    // Group by service → category → items
    const servicesMap = new Map<
      string,
      {
        service: { id: string; name: string; name_urdu: string | null };
        categoriesMap: Map<
          string,
          {
            category: { id: string; name: string; name_urdu: string };
            items: any[];
          }
        >;
      }
    >();

    for (const entry of pricingEntries) {
      const serviceKey = entry.service_category_id;
      const categoryKey = entry.clothing_item.clothing_category_id || 'uncategorized';

      if (!servicesMap.has(serviceKey)) {
        servicesMap.set(serviceKey, {
          service: {
            id: entry.service_category.id,
            name: entry.service_category.name,
            name_urdu: entry.service_category.name_urdu,
          },
          categoriesMap: new Map(),
        });
      }

      const serviceEntry = servicesMap.get(serviceKey)!;
      if (!serviceEntry.categoriesMap.has(categoryKey)) {
        serviceEntry.categoriesMap.set(categoryKey, {
          category: {
            id: entry.clothing_item.clothing_category?.id || '',
            name: entry.clothing_item.clothing_category?.name || 'Other',
            name_urdu: entry.clothing_item.clothing_category?.name_urdu || 'دیگر',
          },
          items: [],
        });
      }

      const defaultPrice =
        defaultPriceMap.get(`${entry.clothing_item_id}-${entry.service_category_id}`) ||
        entry.price;

      serviceEntry.categoriesMap.get(categoryKey)!.items.push({
        laundry_pricing_id: entry.id,
        clothing_item: {
          id: entry.clothing_item.id,
          name: entry.clothing_item.name,
          name_urdu: entry.clothing_item.name_urdu,
          is_popular: entry.clothing_item.is_popular,
        },
        price: entry.price,
        is_active: entry.is_active,
        default_price: defaultPrice,
        min_price: Math.round(defaultPrice * 0.5),
        max_price: Math.round(defaultPrice * 1.5),
      });
    }

    // Convert to array format
    const services = Array.from(servicesMap.values()).map((s) => ({
      service: s.service,
      categories: Array.from(s.categoriesMap.values()).map((c) => ({
        category: c.category,
        items: c.items.sort((a, b) => {
          // Popular items first
          if (a.clothing_item.is_popular !== b.clothing_item.is_popular) {
            return a.clothing_item.is_popular ? -1 : 1;
          }
          return 0;
        }),
      })),
    }));

    return { services };
  }

  // ==================== ONBOARDING STEP 4: UPDATE PRICES (WRITE) ====================
  async updatePrices(laundryId: string, dto: LaundryUpdatePricesDto) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    // Validate all pricing IDs belong to this laundry
    const pricingIds = dto.prices.map((p) => p.laundry_pricing_id);
    const existingPricing = await this.prisma.laundryPricing.findMany({
      where: { id: { in: pricingIds }, laundry_id: laundryId },
    });

    if (existingPricing.length !== pricingIds.length) {
      throw new BadRequestException('Invalid pricing IDs');
    }

    // Get default prices for validation
    const defaultPrices = await this.prisma.defaultPrice.findMany({
      where: {
        clothing_item_id: { in: existingPricing.map((p) => p.clothing_item_id) },
        service_category_id: { in: existingPricing.map((p) => p.service_category_id) },
      },
    });

    const defaultPriceMap = new Map(
      defaultPrices.map((dp) => [`${dp.clothing_item_id}-${dp.service_category_id}`, dp.price]),
    );

    // Validate prices are within ±50% of default
    for (const update of dto.prices) {
      const existing = existingPricing.find((p) => p.id === update.laundry_pricing_id);
      if (!existing) continue;

      const defaultPrice =
        defaultPriceMap.get(`${existing.clothing_item_id}-${existing.service_category_id}`) ||
        existing.price;
      const minPrice = defaultPrice * 0.5;
      const maxPrice = defaultPrice * 1.5;

      if (update.price < minPrice || update.price > maxPrice) {
        throw new BadRequestException(
          `Price ${update.price} is outside allowed range (${Math.round(minPrice)}-${Math.round(maxPrice)})`,
        );
      }
    }

    // Update all prices
    for (const update of dto.prices) {
      await this.prisma.laundryPricing.update({
        where: { id: update.laundry_pricing_id },
        data: {
          price: update.price,
          is_active: update.is_active,
        },
      });
    }

    // Update setup step
    await this.prisma.laundry.update({
      where: { id: laundryId },
      data: {
        setup_step: Math.max(laundry.setup_step, 4),
      },
    });

    return { success: true, updated_count: dto.prices.length };
  }

  // ==================== ONBOARDING STEP 5: GO LIVE ====================
  async goLive(laundryId: string) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    if (laundry.setup_step < 4) {
      throw new BadRequestException('Please complete all setup steps before going live');
    }

    // Count active pricing entries
    const activePricingCount = await this.prisma.laundryPricing.count({
      where: { laundry_id: laundryId, is_active: true },
    });

    // Update laundry status
    await this.prisma.laundry.update({
      where: { id: laundryId },
      data: {
        setup_step: 5,
        setup_complete: true,
        status: AccountStatus.ACTIVE,
        is_open: true,
        services_count: activePricingCount,
      },
    });

    return {
      success: true,
      message: 'Your laundry is now live!',
    };
  }

  // ==================== GET LAUNDRY PRICING (PUBLIC) ====================
  async getLaundryPricing(laundryId: string) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    // Get active pricing entries only
    const pricingEntries = await this.prisma.laundryPricing.findMany({
      where: { laundry_id: laundryId, is_active: true },
      include: {
        service_category: true,
        clothing_item: {
          include: {
            clothing_category: true,
          },
        },
      },
      orderBy: [
        { service_category: { sort_order: 'asc' } },
        { clothing_item: { clothing_category: { sort_order: 'asc' } } },
        { clothing_item: { sort_order: 'asc' } },
      ],
    });

    // Group by service → category → items
    const servicesMap = new Map<
      string,
      {
        service: { id: string; name: string; name_urdu: string | null; estimated_hours: number };
        categoriesMap: Map<
          string,
          {
            category: { id: string; name: string; name_urdu: string };
            items: any[];
          }
        >;
      }
    >();

    for (const entry of pricingEntries) {
      const serviceKey = entry.service_category_id;
      const categoryKey = entry.clothing_item.clothing_category_id || 'uncategorized';

      if (!servicesMap.has(serviceKey)) {
        servicesMap.set(serviceKey, {
          service: {
            id: entry.service_category.id,
            name: entry.service_category.name,
            name_urdu: entry.service_category.name_urdu,
            estimated_hours: entry.service_category.estimated_hours,
          },
          categoriesMap: new Map(),
        });
      }

      const serviceEntry = servicesMap.get(serviceKey)!;
      if (!serviceEntry.categoriesMap.has(categoryKey)) {
        serviceEntry.categoriesMap.set(categoryKey, {
          category: {
            id: entry.clothing_item.clothing_category?.id || '',
            name: entry.clothing_item.clothing_category?.name || 'Other',
            name_urdu: entry.clothing_item.clothing_category?.name_urdu || 'دیگر',
          },
          items: [],
        });
      }

      serviceEntry.categoriesMap.get(categoryKey)!.items.push({
        id: entry.clothing_item.id,
        name: entry.clothing_item.name,
        name_urdu: entry.clothing_item.name_urdu,
        price: entry.price,
      });
    }

    // Convert to array format
    const services = Array.from(servicesMap.values()).map((s) => ({
      service: s.service,
      categories: Array.from(s.categoriesMap.values()),
    }));

    return { services };
  }

  // ==================== HELPER: GENERATE LAUNDRY TOKENS ====================
  private async generateLaundryTokens(laundryId: string, phone: string) {
    const accessPayload = {
      sub: laundryId,
      phone_number: phone,
      role: 'LAUNDRY',
      type: 'access',
    };

    const refreshPayload = {
      sub: laundryId,
      phone_number: phone,
      role: 'LAUNDRY',
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') || '15m',
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        laundry_id: laundryId,
        expires_at: expiresAt,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

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

  // ==================== CNIC VERIFICATION ====================

  async getVerificationStatus(laundryId: string): Promise<VerificationStatusResponse> {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
      select: {
        verification_status: true,
        cnic_number: true,
        cnic_front_image: true,
        cnic_back_image: true,
        verification_submitted_at: true,
        verification_reviewed_at: true,
        verification_rejection_reason: true,
        is_verified: true,
      },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    return {
      verification_status: laundry.verification_status,
      cnic_number: laundry.cnic_number || undefined,
      cnic_front_image: laundry.cnic_front_image || undefined,
      cnic_back_image: laundry.cnic_back_image || undefined,
      verification_submitted_at: laundry.verification_submitted_at || undefined,
      verification_reviewed_at: laundry.verification_reviewed_at || undefined,
      verification_rejection_reason: laundry.verification_rejection_reason || undefined,
      is_verified: laundry.is_verified,
    };
  }

  async submitVerification(laundryId: string, dto: SubmitVerificationDto) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    // Check if already submitted or approved
    if (laundry.verification_status === LaundryVerificationStatus.PENDING_REVIEW) {
      throw new BadRequestException('Verification already submitted and pending review');
    }

    if (laundry.verification_status === LaundryVerificationStatus.APPROVED) {
      throw new BadRequestException('Laundry is already verified');
    }

    const updated = await this.prisma.laundry.update({
      where: { id: laundryId },
      data: {
        cnic_number: dto.cnic_number,
        cnic_front_image: dto.cnic_front_image,
        cnic_back_image: dto.cnic_back_image,
        verification_status: LaundryVerificationStatus.PENDING_REVIEW,
        verification_submitted_at: new Date(),
        verification_rejection_reason: null,
        verification_reviewed_at: null,
      },
      select: {
        verification_status: true,
        verification_submitted_at: true,
      },
    });

    return {
      message: 'Verification documents submitted successfully',
      verification_status: updated.verification_status,
      verification_submitted_at: updated.verification_submitted_at,
    };
  }

  async resubmitVerification(laundryId: string, dto: ResubmitVerificationDto) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    // Only allow resubmission if previously rejected
    if (laundry.verification_status !== LaundryVerificationStatus.REJECTED) {
      throw new BadRequestException(
        'Resubmission is only allowed for rejected verifications. Use POST to submit for the first time.',
      );
    }

    const updated = await this.prisma.laundry.update({
      where: { id: laundryId },
      data: {
        cnic_number: dto.cnic_number,
        cnic_front_image: dto.cnic_front_image,
        cnic_back_image: dto.cnic_back_image,
        verification_status: LaundryVerificationStatus.PENDING_REVIEW,
        verification_submitted_at: new Date(),
        verification_rejection_reason: null,
        verification_reviewed_at: null,
      },
      select: {
        verification_status: true,
        verification_submitted_at: true,
      },
    });

    return {
      message: 'Verification documents resubmitted successfully',
      verification_status: updated.verification_status,
      verification_submitted_at: updated.verification_submitted_at,
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
