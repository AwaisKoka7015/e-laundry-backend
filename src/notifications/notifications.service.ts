import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarkNotificationsReadDto } from './dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

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
        title: 'Order Accepted',
        body: `Your order ${orderNumber} has been accepted!`,
      },
      REJECTED: {
        title: 'Order Rejected',
        body: `Sorry, your order ${orderNumber} has been rejected.`,
      },
      PICKUP_SCHEDULED: {
        title: 'Pickup Scheduled',
        body: `Pickup scheduled for order ${orderNumber}`,
      },
      PICKED_UP: {
        title: 'Clothes Picked Up',
        body: `Your clothes for order ${orderNumber} have been picked up`,
      },
      PROCESSING: {
        title: 'Processing',
        body: `Your order ${orderNumber} is being processed`,
      },
      READY: {
        title: 'Ready for Delivery',
        body: `Your order ${orderNumber} is ready!`,
      },
      OUT_FOR_DELIVERY: {
        title: 'Out for Delivery',
        body: `Your order ${orderNumber} is on the way!`,
      },
      DELIVERED: {
        title: 'Delivered',
        body: `Your order ${orderNumber} has been delivered!`,
      },
      COMPLETED: {
        title: 'Order Completed',
        body: `Your order ${orderNumber} is complete. Please rate your experience!`,
      },
    };

    const message = statusMessages[status];
    if (!message) return null;

    return this.createNotification({
      type: 'ORDER_UPDATE',
      title: message.title,
      body: message.body,
      userId: customerId,
      data: { order_id: orderId, status },
    });
  }

  // Notify laundry about new order
  async notifyLaundryNewOrder(laundryId: string, orderId: string, orderNumber: string) {
    return this.createNotification({
      type: 'ORDER_UPDATE',
      title: 'New Order Received',
      body: `You have received a new order ${orderNumber}`,
      laundryId,
      data: { order_id: orderId },
    });
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
