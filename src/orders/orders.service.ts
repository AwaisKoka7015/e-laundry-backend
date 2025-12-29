import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto, CancelOrderDto } from './dto';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  // Order status flow
  private readonly STATUS_FLOW: Record<string, string[]> = {
    PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
    ACCEPTED: ['PICKUP_SCHEDULED', 'CANCELLED'],
    REJECTED: [],
    PICKUP_SCHEDULED: ['PICKED_UP', 'CANCELLED'],
    PICKED_UP: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['READY'],
    READY: ['OUT_FOR_DELIVERY'],
    OUT_FOR_DELIVERY: ['DELIVERED'],
    DELIVERED: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  private readonly CANCELLABLE_STATUSES = ['PENDING', 'ACCEPTED', 'PICKUP_SCHEDULED', 'PICKED_UP'];
  private readonly ACTIVE_STATUSES = [
    'PENDING',
    'ACCEPTED',
    'PICKUP_SCHEDULED',
    'PICKED_UP',
    'PROCESSING',
    'READY',
    'OUT_FOR_DELIVERY',
  ];

  // ==================== CUSTOMER METHODS ====================

  async createOrder(customerId: string, dto: CreateOrderDto) {
    // Validate laundry
    const laundry = await this.prisma.laundry.findUnique({
      where: { id: dto.laundry_id },
    });

    if (!laundry || laundry.status !== 'ACTIVE') {
      throw new NotFoundException('Laundry not found or not active');
    }

    // Validate and calculate pricing
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of dto.items) {
      const pricing = await this.prisma.servicePricing.findFirst({
        where: {
          laundry_service_id: item.service_id,
          clothing_item_id: item.clothing_item_id,
          is_available: true,
        },
        include: {
          laundry_service: true,
          clothing_item: true,
        },
      });

      if (!pricing) {
        throw new BadRequestException(
          `Pricing not found for service ${item.service_id} and item ${item.clothing_item_id}`,
        );
      }

      let itemPrice = pricing.price;
      let quantity = item.quantity || 1;

      // Handle per-kg pricing
      if (pricing.price_unit === 'PER_KG') {
        if (!item.weight_kg) {
          throw new BadRequestException('Weight is required for per-kg pricing');
        }
        itemPrice = pricing.price * item.weight_kg;
        quantity = 1;
      } else {
        itemPrice = pricing.price * quantity;
      }

      // Apply express pricing
      if (dto.order_type === 'EXPRESS' && pricing.express_price) {
        itemPrice =
          pricing.express_price *
          (pricing.price_unit === 'PER_KG' ? item.weight_kg || 1 : quantity);
      }

      subtotal += itemPrice;

      orderItems.push({
        laundry_service_id: item.service_id,
        clothing_item_id: item.clothing_item_id,
        quantity,
        weight_kg: item.weight_kg,
        unit_price: pricing.price_unit === 'PER_KG' ? pricing.price : pricing.price,
        price_unit: pricing.price_unit,
        total_price: itemPrice,
        special_notes: item.special_notes,
      });
    }

    // Calculate fees
    const deliveryFee = subtotal >= 1000 ? 0 : 100;
    const expressFee = dto.order_type === 'EXPRESS' ? subtotal * 0.5 : 0;

    // Validate and apply promo code
    let discount = 0;
    if (dto.promo_code) {
      const promoResult = await this.validatePromoCode(
        dto.promo_code,
        subtotal,
        customerId,
        dto.laundry_id,
      );
      discount = promoResult.calculated_discount;
    }

    const totalAmount = subtotal + deliveryFee + expressFee - discount;

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Calculate estimated delivery
    const estimatedHours = dto.order_type === 'EXPRESS' ? 12 : 24;
    const expectedDeliveryDate = new Date(dto.pickup_date);
    expectedDeliveryDate.setHours(expectedDeliveryDate.getHours() + estimatedHours);

    // Create order
    const order = await this.prisma.order.create({
      data: {
        order_number: orderNumber,
        customer_id: customerId,
        laundry_id: dto.laundry_id,
        status: 'PENDING',
        order_type: dto.order_type || 'STANDARD',
        pickup_address: dto.pickup_address,
        pickup_latitude: dto.pickup_latitude,
        pickup_longitude: dto.pickup_longitude,
        pickup_date: new Date(dto.pickup_date),
        pickup_time_slot: dto.pickup_time_slot,
        pickup_notes: dto.pickup_notes,
        delivery_address: dto.delivery_address || dto.pickup_address,
        delivery_latitude: dto.delivery_latitude || dto.pickup_latitude,
        delivery_longitude: dto.delivery_longitude || dto.pickup_longitude,
        delivery_notes: dto.delivery_notes,
        expected_delivery_date: expectedDeliveryDate,
        subtotal,
        delivery_fee: deliveryFee,
        express_fee: expressFee,
        discount,
        promo_code: dto.promo_code,
        total_amount: totalAmount,
        payment_method: 'COD',
        payment_status: 'PENDING',
        special_instructions: dto.special_instructions,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: {
            clothing_item: true,
            laundry_service: true,
          },
        },
        laundry: true,
      },
    });

    // Create timeline entry
    await this.createTimelineEntry(
      order.id,
      'ORDER_PLACED',
      'Order Placed',
      'Your order has been placed successfully',
    );

    // Create status history
    await this.prisma.orderStatusHistory.create({
      data: {
        order_id: order.id,
        to_status: 'PENDING',
        changed_by: customerId,
      },
    });

    // Create payment record
    await this.prisma.payment.create({
      data: {
        order_id: order.id,
        amount: totalAmount,
        payment_method: 'COD',
        payment_status: 'PENDING',
      },
    });

    return { order };
  }

  async getCustomerOrders(customerId: string, status?: string, page = 1, limit = 10) {
    const where: any = { customer_id: customerId };

    if (status) {
      if (status === 'active') {
        where.status = { in: this.ACTIVE_STATUSES };
      } else {
        where.status = status;
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: { clothing_item: true },
          },
          laundry: {
            select: {
              id: true,
              laundry_name: true,
              laundry_logo: true,
              phone_number: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    };
  }

  async getOrderDetails(orderId: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            clothing_item: true,
            laundry_service: { include: { category: true } },
          },
        },
        laundry: true,
        customer: true,
        timeline: { orderBy: { timestamp: 'desc' } },
        review: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Verify access
    if (role === 'CUSTOMER' && order.customer_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (role === 'LAUNDRY' && order.laundry_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return { order };
  }

  async cancelOrder(orderId: string, customerId: string, dto: CancelOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customer_id: customerId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!this.CANCELLABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Cannot cancel order in ${order.status} status. Cancellation is only allowed before processing starts.`,
      );
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancellation_reason: dto.reason,
        cancelled_at: new Date(),
        cancelled_by: 'CUSTOMER',
      },
    });

    await this.createTimelineEntry(orderId, 'ORDER_CANCELLED', 'Order Cancelled', dto.reason);

    await this.prisma.orderStatusHistory.create({
      data: {
        order_id: orderId,
        to_status: 'CANCELLED',
        notes: dto.reason,
        changed_by: customerId,
      },
    });

    return { message: 'Order cancelled successfully' };
  }

  async getOrderTimeline(orderId: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (role === 'CUSTOMER' && order.customer_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (role === 'LAUNDRY' && order.laundry_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const timeline = await this.prisma.orderTimeline.findMany({
      where: { order_id: orderId },
      orderBy: { timestamp: 'desc' },
    });

    return { timeline };
  }

  // ==================== LAUNDRY METHODS ====================

  async getLaundryOrders(laundryId: string, status?: string, page = 1, limit = 10) {
    const where: any = { laundry_id: laundryId };

    if (status) {
      if (status === 'active') {
        where.status = { in: this.ACTIVE_STATUSES };
      } else {
        where.status = status;
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: { clothing_item: true },
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone_number: true,
              avatar: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    };
  }

  async updateOrderStatus(orderId: string, laundryId: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        laundry_id: laundryId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate status transition
    const allowedStatuses = this.STATUS_FLOW[order.status] || [];
    if (!allowedStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${order.status} to ${dto.status}. Allowed: ${allowedStatuses.join(', ')}`,
      );
    }

    const updateData: any = {
      status: dto.status,
    };

    // Handle specific status updates
    if (dto.status === 'DELIVERED') {
      updateData.actual_delivery_date = new Date();
    }

    if (dto.status === 'COMPLETED') {
      // Update payment status
      await this.prisma.payment.updateMany({
        where: { order_id: orderId },
        data: { payment_status: 'COMPLETED', paid_at: new Date() },
      });

      // Update laundry stats
      await this.updateLaundryStats(laundryId);
    }

    if (dto.status === 'REJECTED') {
      updateData.cancellation_reason = dto.rejection_reason;
      updateData.cancelled_at = new Date();
      updateData.cancelled_by = 'LAUNDRY';
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
    });

    // Create timeline entry
    const timelineEvent = this.getTimelineEvent(dto.status);
    await this.createTimelineEntry(
      orderId,
      timelineEvent.event,
      timelineEvent.title,
      dto.notes || timelineEvent.description,
    );

    // Create status history
    await this.prisma.orderStatusHistory.create({
      data: {
        order_id: orderId,
        to_status: dto.status,
        notes: dto.notes,
        changed_by: laundryId,
      },
    });

    const updatedOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { clothing_item: true } },
        customer: true,
      },
    });

    return { order: updatedOrder };
  }

  // ==================== HELPER METHODS ====================

  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const todayStart = new Date(date.setHours(0, 0, 0, 0));
    const todayEnd = new Date(date.setHours(23, 59, 59, 999));

    const todayCount = await this.prisma.order.count({
      where: {
        created_at: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const sequence = String(todayCount + 1).padStart(4, '0');
    return `ORD-${dateStr}-${sequence}`;
  }

  private async createTimelineEntry(
    orderId: string,
    event: string,
    title: string,
    description?: string,
  ) {
    await this.prisma.orderTimeline.create({
      data: {
        order_id: orderId,
        event,
        title,
        description,
        icon: this.getStatusIcon(event),
        timestamp: new Date(),
      },
    });
  }

  private getTimelineEvent(status: string): { event: string; title: string; description: string } {
    const events: Record<string, { event: string; title: string; description: string }> = {
      ACCEPTED: {
        event: 'ORDER_ACCEPTED',
        title: 'Order Accepted',
        description: 'Your order has been accepted by the laundry',
      },
      REJECTED: {
        event: 'ORDER_REJECTED',
        title: 'Order Rejected',
        description: 'Your order has been rejected',
      },
      PICKUP_SCHEDULED: {
        event: 'PICKUP_SCHEDULED',
        title: 'Pickup Scheduled',
        description: 'Pickup has been scheduled',
      },
      PICKED_UP: {
        event: 'PICKED_UP',
        title: 'Picked Up',
        description: 'Your clothes have been picked up',
      },
      PROCESSING: {
        event: 'PROCESSING',
        title: 'Processing',
        description: 'Your clothes are being processed',
      },
      READY: { event: 'READY', title: 'Ready', description: 'Your clothes are ready for delivery' },
      OUT_FOR_DELIVERY: {
        event: 'OUT_FOR_DELIVERY',
        title: 'Out for Delivery',
        description: 'Your clothes are on the way',
      },
      DELIVERED: {
        event: 'DELIVERED',
        title: 'Delivered',
        description: 'Your clothes have been delivered',
      },
      COMPLETED: {
        event: 'COMPLETED',
        title: 'Completed',
        description: 'Order completed successfully',
      },
    };

    return events[status] || { event: status, title: status, description: '' };
  }

  private getStatusIcon(event: string): string {
    const icons: Record<string, string> = {
      ORDER_PLACED: 'clipboard-list',
      ORDER_ACCEPTED: 'check-circle',
      ORDER_REJECTED: 'x-circle',
      ORDER_CANCELLED: 'x-circle',
      PICKUP_SCHEDULED: 'calendar',
      PICKED_UP: 'truck',
      PROCESSING: 'loader',
      READY: 'package',
      OUT_FOR_DELIVERY: 'truck',
      DELIVERED: 'check',
      COMPLETED: 'check-circle',
    };

    return icons[event] || 'circle';
  }

  private async validatePromoCode(
    code: string,
    orderAmount: number,
    customerId: string,
    _laundryId: string,
  ): Promise<{ calculated_discount: number }> {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promo || !promo.is_active) {
      throw new BadRequestException('Invalid promo code');
    }

    const now = new Date();
    if (now < promo.valid_from || now > promo.valid_until) {
      throw new BadRequestException('Promo code has expired');
    }

    if (promo.usage_limit && promo.used_count >= promo.usage_limit) {
      throw new BadRequestException('Promo code usage limit reached');
    }

    if (orderAmount < promo.min_order_amount) {
      throw new BadRequestException(`Minimum order amount is ₨${promo.min_order_amount}`);
    }

    if (promo.first_order_only) {
      const previousOrders = await this.prisma.order.count({
        where: { customer_id: customerId, status: 'COMPLETED' },
      });
      if (previousOrders > 0) {
        throw new BadRequestException('This promo is for first order only');
      }
    }

    let discount = 0;
    if (promo.discount_type === 'PERCENTAGE') {
      discount = (orderAmount * promo.discount_value) / 100;
      if (promo.max_discount) {
        discount = Math.min(discount, promo.max_discount);
      }
    } else {
      discount = promo.discount_value;
    }

    return { calculated_discount: discount };
  }

  private async updateLaundryStats(laundryId: string) {
    const stats = await this.prisma.order.aggregate({
      where: {
        laundry_id: laundryId,
        status: 'COMPLETED',
      },
      _count: true,
    });

    await this.prisma.laundry.update({
      where: { id: laundryId },
      data: { total_orders: stats._count },
    });
  }
}
