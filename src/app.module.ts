import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
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
  ],
})
export class AppModule {}
