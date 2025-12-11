import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(active: boolean = true) {
    const categories = await this.prisma.serviceCategory.findMany({
      where: active ? { is_active: true } : undefined,
      orderBy: { sort_order: 'asc' },
    });

    return { categories };
  }
}
