import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from './prisma/prisma.module';
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LaundriesModule } from './laundries/laundries.module';
import { CategoriesModule } from './categories/categories.module';
import { ClothingItemsModule } from './clothing-items/clothing-items.module';
import { ServicesModule } from './services/services.module';
import { SearchModule } from './search/search.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PromoModule } from './promo/promo.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UploadModule } from './upload/upload.module';
import { AdminModule } from './admin/admin.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { HealthModule } from './health/health.module';
import { ContactModule } from './contact/contact.module';
import { DeliveryModule } from './delivery/delivery.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    CacheModule.register({ ttl: 300000, isGlobal: true }),
    PrismaModule,
    FirebaseModule,
    AuthModule,
    UsersModule,
    LaundriesModule,
    CategoriesModule,
    ClothingItemsModule,
    ServicesModule,
    SearchModule,
    OrdersModule,
    ReviewsModule,
    DashboardModule,
    PromoModule,
    NotificationsModule,
    UploadModule,
    AdminModule,
    SchedulerModule,
    HealthModule,
    ContactModule,
    DeliveryModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
