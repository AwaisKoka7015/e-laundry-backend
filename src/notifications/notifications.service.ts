import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { MarkNotificationsReadDto } from './dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private firebaseService: FirebaseService,
  ) {}

  // Get notifications for user or laundry
  async getNotifications(userId: string, role: string, page = 1, limit = 20) {
    const where: any = {};

    if (role === 'CUSTOMER') {
      where.user_id = userId;
    } else if (role === 'LAUNDRY') {
      where.laundry_id = userId;
    }

    const [notifications, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, is_read: false } }),
    ]);

    return {
      notifications,
      unread_count: unread,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    };
  }

  // Mark notifications as read
  async markAsRead(userId: string, role: string, dto: MarkNotificationsReadDto) {
    if (!dto.mark_all && (!dto.notification_ids || dto.notification_ids.length === 0)) {
      throw new BadRequestException('Either mark_all or notification_ids must be provided');
    }

    const where: any = {};

    if (role === 'CUSTOMER') {
      where.user_id = userId;
    } else if (role === 'LAUNDRY') {
      where.laundry_id = userId;
    }

    if (dto.mark_all) {
      await this.prisma.notification.updateMany({
        where: { ...where, is_read: false },
        data: { is_read: true },
      });

      return { message: 'All notifications marked as read' };
    }

    await this.prisma.notification.updateMany({
      where: {
        ...where,
        id: { in: dto.notification_ids },
      },
      data: { is_read: true },
    });

    return { message: 'Notifications marked as read' };
  }

  // Mark single notification as read
  async markSingleAsRead(notificationId: string, userId: string, role: string) {
    const where: any = { id: notificationId };

    if (role === 'CUSTOMER') {
      where.user_id = userId;
    } else if (role === 'LAUNDRY') {
      where.laundry_id = userId;
    }

    const notification = await this.prisma.notification.findFirst({ where });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { is_read: true },
    });

    return { message: 'Notification marked as read' };
  }

  // Create notification (internal use)
  async createNotification(data: {
    type: string;
    title: string;
    body: string;
    userId?: string;
    laundryId?: string;
    data?: any;
  }) {
    return this.prisma.notification.create({
      data: {
        type: data.type as any,
        title: data.title,
        body: data.body,
        user_id: data.userId,
        laundry_id: data.laundryId,
        data: data.data || {},
      },
    });
  }

  // Notify customer about order status
  async notifyCustomerOrderStatus(
    customerId: string,
    orderId: string,
    orderNumber: string,
    status: string,
  ) {
    const statusMessages: Record<string, { title: string; body: string }> = {
      ACCEPTED: {
        title: 'Order Accepted ✅',
        body: `Your order ${orderNumber} has been accepted! We'll pick up your clothes soon.`,
      },
      REJECTED: {
        title: 'Order Rejected ❌',
        body: `Sorry, your order ${orderNumber} has been rejected. Please try another laundry.`,
      },
      PICKUP_SCHEDULED: {
        title: 'Pickup Scheduled 📅',
        body: `Pickup scheduled for order ${orderNumber}. Please keep your clothes ready!`,
      },
      PICKED_UP: {
        title: 'Clothes Picked Up 🚚',
        body: `Your clothes for order ${orderNumber} have been picked up. Processing will begin soon.`,
      },
      PROCESSING: {
        title: 'Processing Started 🧺',
        body: `Your order ${orderNumber} is being cleaned and processed.`,
      },
      READY: {
        title: 'Ready for Delivery 📦',
        body: `Great news! Your order ${orderNumber} is ready and will be delivered soon.`,
      },
      OUT_FOR_DELIVERY: {
        title: 'Out for Delivery 🚗',
        body: `Your order ${orderNumber} is on the way! Get ready to receive your fresh clothes.`,
      },
      DELIVERED: {
        title: 'Delivered ✨',
        body: `Your order ${orderNumber} has been delivered! Enjoy your fresh, clean clothes.`,
      },
      COMPLETED: {
        title: 'Order Completed 🎉',
        body: `Your order ${orderNumber} is complete. Please rate your experience!`,
      },
      CANCELLED: {
        title: 'Order Cancelled',
        body: `Your order ${orderNumber} has been cancelled.`,
      },
    };

    const message = statusMessages[status];
    if (!message) return null;

    // Create notification record in database
    const notification = await this.createNotification({
      type: 'ORDER_UPDATE',
      title: message.title,
      body: message.body,
      userId: customerId,
      data: { order_id: orderId, status },
    });

    // Send push notification via FCM
    await this.sendPushToUser(customerId, message.title, message.body, {
      type: 'ORDER_UPDATE',
      order_id: orderId,
      status,
      notification_id: notification.id,
    });

    return notification;
  }

  // Send push notification to a user
  private async sendPushToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    try {
      // Get user's FCM token
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fcm_token: true, name: true },
      });

      if (!user?.fcm_token) {
        this.logger.warn(`No FCM token for user ${userId}, skipping push notification`);
        return null;
      }

      const result = await this.firebaseService.sendPushNotification(
        user.fcm_token,
        title,
        body,
        data,
      );

      if (result.success) {
        this.logger.log(`Push notification sent to user ${userId}`);

        // Update notification as sent
        if (data?.notification_id) {
          await this.prisma.notification.update({
            where: { id: data.notification_id },
            data: { is_sent: true, sent_at: new Date() },
          });
        }
      } else {
        this.logger.warn(`Failed to send push to user ${userId}: ${result.error}`);

        // If token is invalid, clear it from database
        if (result.error === 'Invalid or expired FCM token') {
          await this.prisma.user.update({
            where: { id: userId },
            data: { fcm_token: null },
          });
          this.logger.log(`Cleared invalid FCM token for user ${userId}`);
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Error sending push to user ${userId}:`, error);
      return null;
    }
  }

  // Send push notification to a laundry
  private async sendPushToLaundry(
    laundryId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    try {
      const laundry = await this.prisma.laundry.findUnique({
        where: { id: laundryId },
        select: { fcm_token: true, laundry_name: true },
      });

      if (!laundry?.fcm_token) {
        this.logger.warn(`No FCM token for laundry ${laundryId}, skipping push notification`);
        return null;
      }

      const result = await this.firebaseService.sendPushNotification(
        laundry.fcm_token,
        title,
        body,
        data,
      );

      if (result.success) {
        this.logger.log(`Push notification sent to laundry ${laundryId}`);

        if (data?.notification_id) {
          await this.prisma.notification.update({
            where: { id: data.notification_id },
            data: { is_sent: true, sent_at: new Date() },
          });
        }
      } else {
        this.logger.warn(`Failed to send push to laundry ${laundryId}: ${result.error}`);

        if (result.error === 'Invalid or expired FCM token') {
          await this.prisma.laundry.update({
            where: { id: laundryId },
            data: { fcm_token: null },
          });
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Error sending push to laundry ${laundryId}:`, error);
      return null;
    }
  }

  // Notify laundry about new order
  async notifyLaundryNewOrder(laundryId: string, orderId: string, orderNumber: string) {
    const title = 'New Order Received 🛎️';
    const body = `You have received a new order ${orderNumber}. Tap to view details.`;

    // Create notification record
    const notification = await this.createNotification({
      type: 'ORDER_UPDATE',
      title,
      body,
      laundryId,
      data: { order_id: orderId },
    });

    // Send push notification
    await this.sendPushToLaundry(laundryId, title, body, {
      type: 'NEW_ORDER',
      order_id: orderId,
      notification_id: notification.id,
    });

    return notification;
  }

  // Notify laundry about order cancellation
  async notifyLaundryCancellation(laundryId: string, orderId: string, orderNumber: string, reason: string) {
    const title = 'Order Cancelled ❌';
    const body = `Order ${orderNumber} has been cancelled by the customer.`;

    const notification = await this.createNotification({
      type: 'ORDER_UPDATE',
      title,
      body,
      laundryId,
      data: { order_id: orderId, reason },
    });

    await this.sendPushToLaundry(laundryId, title, body, {
      type: 'ORDER_CANCELLED',
      order_id: orderId,
      notification_id: notification.id,
    });

    return notification;
  }

  // Send welcome notification
  async sendWelcomeNotification(userId: string, role: string, name?: string) {
    const greeting = name ? `Welcome, ${name}!` : 'Welcome to E-Laundry!';
    const body =
      role === 'CUSTOMER'
        ? 'Find the best laundry services near you.'
        : 'Start receiving orders from customers nearby.';

    return this.createNotification({
      type: 'WELCOME',
      title: greeting,
      body,
      userId: role === 'CUSTOMER' ? userId : undefined,
      laundryId: role === 'LAUNDRY' ? userId : undefined,
    });
  }
}
