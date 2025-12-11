import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClothingItemsService {
  constructor(private prisma: PrismaService) {}

  async findAll(type?: string, active: boolean = true) {
    const where: any = active ? { is_active: true } : {};
    
    if (type) {
      where.type = type;
    }

    const items = await this.prisma.clothingItem.findMany({
      where,
      orderBy: [{ type: 'asc' }, { sort_order: 'asc' }],
    });

    // If no type filter, group by type
    if (!type) {
      const grouped = {
        MEN: items.filter((i) => i.type === 'MEN'),
        WOMEN: items.filter((i) => i.type === 'WOMEN'),
        KIDS: items.filter((i) => i.type === 'KIDS'),
        HOME: items.filter((i) => i.type === 'HOME'),
      };

      return {
        items: grouped,
        total: items.length,
      };
    }

    return {
      items,
      total: items.length,
    };
  }
}
