import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto, BulkPricingDto } from './dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  // Get all services for a laundry
  async findAll(laundryId: string) {
    const services = await this.prisma.laundryService.findMany({
      where: { laundry_id: laundryId },
      include: {
        category: true,
        pricing: {
          include: { clothing_item: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return { services };
  }

  // Get single service
  async findOne(laundryId: string, serviceId: string) {
    const service = await this.prisma.laundryService.findFirst({
      where: {
        id: serviceId,
        laundry_id: laundryId,
      },
      include: {
        category: true,
        pricing: {
          include: { clothing_item: true },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return { service };
  }

  // Create new service
  async create(laundryId: string, dto: CreateServiceDto) {
    // Check if category exists
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: dto.category_id },
    });

    if (!category) {
      throw new NotFoundException('Service category not found');
    }

    // Check for duplicate service
    const existing = await this.prisma.laundryService.findFirst({
      where: {
        laundry_id: laundryId,
        category_id: dto.category_id,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException('Service with this name already exists in this category');
    }

    const service = await this.prisma.laundryService.create({
      data: {
        laundry_id: laundryId,
        ...dto,
      },
      include: {
        category: true,
      },
    });

    // Update laundry services count
    await this.updateServicesCount(laundryId);

    return { service };
  }

  // Update service
  async update(laundryId: string, serviceId: string, dto: UpdateServiceDto) {
    const service = await this.prisma.laundryService.findFirst({
      where: {
        id: serviceId,
        laundry_id: laundryId,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const updated = await this.prisma.laundryService.update({
      where: { id: serviceId },
      data: dto,
      include: {
        category: true,
        pricing: {
          include: { clothing_item: true },
        },
      },
    });

    return { service: updated };
  }

  // Delete service
  async delete(laundryId: string, serviceId: string) {
    const service = await this.prisma.laundryService.findFirst({
      where: {
        id: serviceId,
        laundry_id: laundryId,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Check if service has any orders
    const ordersCount = await this.prisma.orderItem.count({
      where: { laundry_service_id: serviceId },
    });

    if (ordersCount > 0) {
      // Soft delete - just mark as unavailable
      await this.prisma.laundryService.update({
        where: { id: serviceId },
        data: { is_available: false },
      });

      return { message: 'Service has been deactivated (has existing orders)' };
    }

    // Hard delete
    await this.prisma.servicePricing.deleteMany({
      where: { laundry_service_id: serviceId },
    });

    await this.prisma.laundryService.delete({
      where: { id: serviceId },
    });

    await this.updateServicesCount(laundryId);

    return { message: 'Service deleted successfully' };
  }

  // Get service pricing
  async getPricing(laundryId: string, serviceId: string) {
    const service = await this.prisma.laundryService.findFirst({
      where: {
        id: serviceId,
        laundry_id: laundryId,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const pricing = await this.prisma.servicePricing.findMany({
      where: { laundry_service_id: serviceId },
      include: { clothing_item: true },
      orderBy: { clothing_item: { sort_order: 'asc' } },
    });

    return { pricing };
  }

  // Set bulk pricing
  async setBulkPricing(laundryId: string, serviceId: string, dto: BulkPricingDto) {
    const service = await this.prisma.laundryService.findFirst({
      where: {
        id: serviceId,
        laundry_id: laundryId,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Upsert pricing for each clothing item
    const results = await Promise.all(
      dto.pricing.map(async (item) => {
        return this.prisma.servicePricing.upsert({
          where: {
            laundry_service_id_clothing_item_id: {
              laundry_service_id: serviceId,
              clothing_item_id: item.clothing_item_id,
            },
          },
          update: {
            price: item.price,
            express_price: item.express_price,
            price_unit: item.price_unit || service.price_unit,
            is_available: item.is_available ?? true,
          },
          create: {
            laundry_service_id: serviceId,
            clothing_item_id: item.clothing_item_id,
            price: item.price,
            express_price: item.express_price,
            price_unit: item.price_unit || service.price_unit,
            is_available: item.is_available ?? true,
          },
          include: { clothing_item: true },
        });
      }),
    );

    return {
      message: 'Pricing updated successfully',
      pricing: results,
    };
  }

  // Get public services for a laundry
  async getPublicServices(laundryId: string) {
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: laundryId },
    });

    if (!laundry) {
      throw new NotFoundException('Laundry not found');
    }

    const services = await this.prisma.laundryService.findMany({
      where: {
        laundry_id: laundryId,
        is_available: true,
      },
      include: {
        category: true,
        pricing: {
          where: { is_available: true },
          include: { clothing_item: true },
        },
      },
      orderBy: { category: { sort_order: 'asc' } },
    });

    return { services };
  }

  // Helper: Update laundry services count
  private async updateServicesCount(laundryId: string) {
    const count = await this.prisma.laundryService.count({
      where: {
        laundry_id: laundryId,
        is_available: true,
      },
    });

    await this.prisma.laundry.update({
      where: { id: laundryId },
      data: { services_count: count },
    });
  }
}
