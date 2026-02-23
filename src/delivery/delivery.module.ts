import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Delivery Module
 *
 * This module handles delivery partner functionality including:
 * - Profile and availability management
 * - Assignment acceptance/rejection
 * - Pickup and delivery status updates
 * - Proof of pickup/delivery uploads
 * - Earnings tracking
 *
 * NOTE: Currently laundries handle their own deliveries. This module is
 * prepared for future use when delivery partner functionality is enabled.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
