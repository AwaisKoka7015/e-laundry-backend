import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLaundryProfileDto } from './dto';

@Injectable()
export class LaundriesService {
  constructor(private prisma: PrismaService) {}

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
      latitude: laundry.latitude,
      longitude: laundry.longitude,
      address_text: laundry.address_text,
      city: laundry.city,
      near_landmark: laundry.near_landmark,
      working_hours: laundry.working_hours,
      services: laundry.services,
    };
  }
}
