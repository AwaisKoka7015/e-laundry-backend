import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }
    
    // Delete in order respecting foreign keys
    await this.$transaction([
      this.notification.deleteMany(),
      this.orderTimeline.deleteMany(),
      this.orderStatusHistory.deleteMany(),
      this.payment.deleteMany(),
      this.review.deleteMany(),
      this.orderItem.deleteMany(),
      this.order.deleteMany(),
      this.servicePricing.deleteMany(),
      this.laundryService.deleteMany(),
      this.refreshToken.deleteMany(),
      this.user.deleteMany(),
      this.laundry.deleteMany(),
      this.tempAccount.deleteMany(),
      this.clothingItem.deleteMany(),
      this.serviceCategory.deleteMany(),
      this.promoCode.deleteMany(),
      this.appSetting.deleteMany(),
    ]);
  }
}
