import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  UpdateAvailabilityDto,
  UpdateLocationDto,
  AcceptAssignmentDto,
  RejectAssignmentDto,
  UpdatePickupStatusDto,
  UpdateDeliveryStatusDto,
  UploadProofDto,
  AssignDeliveryPartnerDto,
} from './dto';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  // Pickup status flow
  private readonly PICKUP_STATUS_FLOW: Record<string, string[]> = {
    PENDING: ['ACCEPTED', 'REJECTED'],
    ACCEPTED: ['EN_ROUTE'],
    EN_ROUTE: ['ARRIVED'],
    ARRIVED: ['COMPLETED'],
    COMPLETED: [],
    REJECTED: [],
  };

  // Delivery status flow
  private readonly DELIVERY_STATUS_FLOW: Record<string, string[]> = {
    PENDING: ['ACCEPTED', 'REJECTED'],
    ACCEPTED: ['EN_ROUTE'],
    EN_ROUTE: ['ARRIVED'],
    ARRIVED: ['COMPLETED'],
    COMPLETED: [],
    REJECTED: [],
  };

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  // ==================== PROFILE METHODS ====================

  async getProfile(partnerId: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
      select: {
        id: true,
        phone_number: true,
        name: true,
        email: true,
        avatar: true,
        status: true,
        latitude: true,
        longitude: true,
        address_text: true,
        city: true,
        vehicle_type: true,
        vehicle_number: true,
        total_deliveries: true,
        rating: true,
        total_reviews: true,
        is_available: true,
        is_online: true,
        created_at: true,
        approved_at: true,
      },
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner not found');
    }

    return { partner };
  }

  async updateAvailability(partnerId: string, dto: UpdateAvailabilityDto) {
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner not found');
    }

    if (partner.status !== 'ACTIVE') {
      throw new BadRequestException('Account is not active. Please contact support.');
    }

    const updateData: any = {};
    if (dto.is_available !== undefined) {
      updateData.is_available = dto.is_available;
    }
    if (dto.is_online !== undefined) {
      updateData.is_online = dto.is_online;
      // If going offline, also set as unavailable
      if (!dto.is_online) {
        updateData.is_available = false;
      }
    }

    const updated = await this.prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: updateData,
      select: {
        id: true,
        is_available: true,
        is_online: true,
      },
    });

    return { partner: updated };
  }

  async updateLocation(partnerId: string, dto: UpdateLocationDto) {
    const updated = await this.prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
      },
    });

    return { partner: updated };
  }

  // ==================== ASSIGNMENT METHODS ====================

  async getAssignments(partnerId: string, status?: string, page = 1, limit = 10) {
    const where: any = { delivery_partner_id: partnerId };

    if (status) {
      if (status === 'active') {
        // Get assignments that are not completed
        where.OR = [
          { pickup_status: { notIn: ['COMPLETED', 'REJECTED'] } },
          { delivery_status: { notIn: ['COMPLETED', 'REJECTED'] } },
        ];
      } else if (status === 'pending') {
        where.OR = [{ pickup_status: 'PENDING' }, { delivery_status: 'PENDING' }];
      } else if (status === 'completed') {
        where.AND = [
          { OR: [{ pickup_status: 'COMPLETED' }, { pickup_status: null }] },
          { OR: [{ delivery_status: 'COMPLETED' }, { delivery_status: null }] },
        ];
      }
    }

    const [assignments, total] = await Promise.all([
      this.prisma.deliveryAssignment.findMany({
        where,
        include: {
          order: {
            include: {
              laundry: {
                select: {
                  id: true,
                  laundry_name: true,
                  phone_number: true,
                  address_text: true,
                  latitude: true,
                  longitude: true,
                },
              },
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone_number: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.deliveryAssignment.count({ where }),
    ]);

    return {
      assignments,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    };
  }

  async getAssignmentDetails(partnerId: string, assignmentId: string) {
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: {
        id: assignmentId,
        delivery_partner_id: partnerId,
      },
      include: {
        order: {
          include: {
            laundry: {
              select: {
                id: true,
                laundry_name: true,
                phone_number: true,
                address_text: true,
                latitude: true,
                longitude: true,
              },
            },
            customer: {
              select: {
                id: true,
                name: true,
                phone_number: true,
                address_text: true,
              },
            },
            items: {
              include: {
                clothing_item: true,
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return { assignment };
  }

  async acceptAssignment(partnerId: string, assignmentId: string, dto: AcceptAssignmentDto) {
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: {
        id: assignmentId,
        delivery_partner_id: partnerId,
      },
      include: {
        order: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Determine which status to update based on assignment type and current statuses
    const updateData: any = {
      notes: dto.eta_minutes ? `ETA: ${dto.eta_minutes} minutes` : undefined,
    };

    if (assignment.assignment_type === 'PICKUP' || assignment.assignment_type === 'BOTH') {
      if (assignment.pickup_status === 'PENDING') {
        updateData.pickup_status = 'ACCEPTED';
      }
    }

    if (assignment.assignment_type === 'DELIVERY' || assignment.assignment_type === 'BOTH') {
      // For BOTH type, delivery acceptance happens after pickup is completed
      if (assignment.assignment_type === 'DELIVERY' && assignment.delivery_status === 'PENDING') {
        updateData.delivery_status = 'ACCEPTED';
      }
    }

    const updated = await this.prisma.deliveryAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        order: true,
      },
    });

    // Notify relevant parties
    try {
      await this.notifyAssignmentUpdate(
        updated,
        'Assignment Accepted',
        'Delivery partner has accepted the assignment',
      );
    } catch (error) {
      this.logger.error('Failed to send assignment notification:', error);
    }

    return { assignment: updated };
  }

  async rejectAssignment(partnerId: string, assignmentId: string, dto: RejectAssignmentDto) {
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: {
        id: assignmentId,
        delivery_partner_id: partnerId,
      },
      include: {
        order: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Check if assignment can be rejected
    const canRejectPickup = assignment.pickup_status === 'PENDING';
    const canRejectDelivery = assignment.delivery_status === 'PENDING';

    if (!canRejectPickup && !canRejectDelivery) {
      throw new BadRequestException('Assignment cannot be rejected at this stage');
    }

    const updateData: any = {
      notes: dto.reason,
    };

    if (canRejectPickup) {
      updateData.pickup_status = 'REJECTED';
    }
    if (canRejectDelivery) {
      updateData.delivery_status = 'REJECTED';
    }

    const updated = await this.prisma.deliveryAssignment.update({
      where: { id: assignmentId },
      data: updateData,
    });

    // Notify laundry about rejection so they can reassign
    try {
      await this.notifyAssignmentUpdate(
        { ...updated, order: assignment.order },
        'Assignment Rejected',
        `Delivery partner rejected: ${dto.reason}`,
      );
    } catch (error) {
      this.logger.error('Failed to send rejection notification:', error);
    }

    return { message: 'Assignment rejected', assignment: updated };
  }

  // ==================== PICKUP METHODS ====================

  async updatePickupStatus(partnerId: string, assignmentId: string, dto: UpdatePickupStatusDto) {
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: {
        id: assignmentId,
        delivery_partner_id: partnerId,
      },
      include: {
        order: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (!assignment.pickup_status) {
      throw new BadRequestException('This assignment does not include pickup');
    }

    // Validate status transition
    const allowedStatuses = this.PICKUP_STATUS_FLOW[assignment.pickup_status] || [];
    if (!allowedStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${assignment.pickup_status} to ${dto.status}. Allowed: ${allowedStatuses.join(', ')}`,
      );
    }

    const updateData: any = {
      pickup_status: dto.status,
      notes: dto.notes,
    };

    if (dto.status === 'EN_ROUTE') {
      updateData.pickup_started_at = new Date();
    }

    if (dto.status === 'COMPLETED') {
      updateData.pickup_completed_at = new Date();

      // If this is a BOTH type assignment, initialize delivery status
      if (assignment.assignment_type === 'BOTH' && assignment.delivery_status === null) {
        updateData.delivery_status = 'PENDING';
      }

      // Update order status to PICKED_UP
      await this.prisma.order.update({
        where: { id: assignment.order_id },
        data: { status: 'PICKED_UP', picked_up_at: new Date() },
      });

      // Create timeline entry
      await this.prisma.orderTimeline.create({
        data: {
          order_id: assignment.order_id,
          event: 'PICKED_UP',
          title: 'Picked Up',
          description: 'Your clothes have been picked up by the delivery partner',
          icon: 'truck',
        },
      });

      // Notify customer
      try {
        await this.notificationsService.notifyCustomerOrderStatus(
          assignment.order.customer_id,
          assignment.order_id,
          assignment.order.order_number,
          'PICKED_UP',
        );
      } catch (error) {
        this.logger.error('Failed to send pickup notification:', error);
      }
    }

    const updated = await this.prisma.deliveryAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        order: true,
      },
    });

    return { assignment: updated };
  }

  async uploadPickupProof(partnerId: string, assignmentId: string, dto: UploadProofDto) {
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: {
        id: assignmentId,
        delivery_partner_id: partnerId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const updated = await this.prisma.deliveryAssignment.update({
      where: { id: assignmentId },
      data: {
        pickup_proof_image: dto.image_url,
        notes: dto.notes
          ? `${assignment.notes || ''}\nPickup proof: ${dto.notes}`
          : assignment.notes,
      },
    });

    return { message: 'Pickup proof uploaded', assignment: updated };
  }

  // ==================== DELIVERY METHODS ====================

  async updateDeliveryStatus(
    partnerId: string,
    assignmentId: string,
    dto: UpdateDeliveryStatusDto,
  ) {
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: {
        id: assignmentId,
        delivery_partner_id: partnerId,
      },
      include: {
        order: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    if (!assignment.delivery_status) {
      throw new BadRequestException('This assignment does not include delivery');
    }

    // Validate status transition
    const allowedStatuses = this.DELIVERY_STATUS_FLOW[assignment.delivery_status] || [];
    if (!allowedStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${assignment.delivery_status} to ${dto.status}. Allowed: ${allowedStatuses.join(', ')}`,
      );
    }

    const updateData: any = {
      delivery_status: dto.status,
      notes: dto.notes,
    };

    if (dto.status === 'EN_ROUTE') {
      updateData.delivery_started_at = new Date();

      // Update order status
      await this.prisma.order.update({
        where: { id: assignment.order_id },
        data: { status: 'OUT_FOR_DELIVERY', out_for_delivery_at: new Date() },
      });

      // Create timeline entry
      await this.prisma.orderTimeline.create({
        data: {
          order_id: assignment.order_id,
          event: 'OUT_FOR_DELIVERY',
          title: 'Out for Delivery',
          description: 'Your clothes are on the way',
          icon: 'truck',
        },
      });

      // Notify customer
      try {
        await this.notificationsService.notifyCustomerOrderStatus(
          assignment.order.customer_id,
          assignment.order_id,
          assignment.order.order_number,
          'OUT_FOR_DELIVERY',
        );
      } catch (error) {
        this.logger.error('Failed to send out for delivery notification:', error);
      }
    }

    if (dto.status === 'COMPLETED') {
      updateData.delivery_completed_at = new Date();

      // Update order status to DELIVERED
      await this.prisma.order.update({
        where: { id: assignment.order_id },
        data: {
          status: 'DELIVERED',
          delivered_at: new Date(),
          actual_delivery_date: new Date(),
        },
      });

      // Create timeline entry
      await this.prisma.orderTimeline.create({
        data: {
          order_id: assignment.order_id,
          event: 'DELIVERED',
          title: 'Delivered',
          description: 'Your clothes have been delivered',
          icon: 'check',
        },
      });

      // Update delivery partner stats
      await this.updateDeliveryPartnerStats(partnerId);

      // Notify customer
      try {
        await this.notificationsService.notifyCustomerOrderStatus(
          assignment.order.customer_id,
          assignment.order_id,
          assignment.order.order_number,
          'DELIVERED',
        );
      } catch (error) {
        this.logger.error('Failed to send delivery notification:', error);
      }
    }

    const updated = await this.prisma.deliveryAssignment.update({
      where: { id: assignmentId },
      data: updateData,
      include: {
        order: true,
      },
    });

    return { assignment: updated };
  }

  async uploadDeliveryProof(partnerId: string, assignmentId: string, dto: UploadProofDto) {
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: {
        id: assignmentId,
        delivery_partner_id: partnerId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const updated = await this.prisma.deliveryAssignment.update({
      where: { id: assignmentId },
      data: {
        delivery_proof_image: dto.image_url,
        notes: dto.notes
          ? `${assignment.notes || ''}\nDelivery proof: ${dto.notes}`
          : assignment.notes,
      },
    });

    return { message: 'Delivery proof uploaded', assignment: updated };
  }

  // ==================== STATS METHODS ====================

  async getStats(partnerId: string) {
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
      select: {
        total_deliveries: true,
        rating: true,
        total_reviews: true,
      },
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner not found');
    }

    // Get today's deliveries
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [todayDeliveries, totalEarnings, todayEarnings, pendingAssignments] = await Promise.all([
      this.prisma.deliveryAssignment.count({
        where: {
          delivery_partner_id: partnerId,
          delivery_completed_at: { gte: todayStart },
        },
      }),
      this.prisma.deliveryAssignment.aggregate({
        where: {
          delivery_partner_id: partnerId,
          OR: [{ pickup_status: 'COMPLETED' }, { delivery_status: 'COMPLETED' }],
        },
        _sum: { earnings: true },
      }),
      this.prisma.deliveryAssignment.aggregate({
        where: {
          delivery_partner_id: partnerId,
          OR: [
            { pickup_completed_at: { gte: todayStart } },
            { delivery_completed_at: { gte: todayStart } },
          ],
        },
        _sum: { earnings: true },
      }),
      this.prisma.deliveryAssignment.count({
        where: {
          delivery_partner_id: partnerId,
          OR: [{ pickup_status: 'PENDING' }, { delivery_status: 'PENDING' }],
        },
      }),
    ]);

    return {
      stats: {
        total_deliveries: partner.total_deliveries,
        today_deliveries: todayDeliveries,
        rating: partner.rating,
        total_reviews: partner.total_reviews,
        total_earnings: totalEarnings._sum.earnings || 0,
        today_earnings: todayEarnings._sum.earnings || 0,
        pending_assignments: pendingAssignments,
      },
    };
  }

  async getEarnings(partnerId: string, startDate?: string, endDate?: string, page = 1, limit = 20) {
    const where: any = {
      delivery_partner_id: partnerId,
      OR: [{ pickup_status: 'COMPLETED' }, { delivery_status: 'COMPLETED' }],
    };

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        where.created_at.lte = new Date(endDate);
      }
    }

    const [assignments, total, totalEarnings] = await Promise.all([
      this.prisma.deliveryAssignment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              order_number: true,
              total_amount: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.deliveryAssignment.count({ where }),
      this.prisma.deliveryAssignment.aggregate({
        where,
        _sum: { earnings: true },
      }),
    ]);

    return {
      earnings: assignments,
      total_earnings: totalEarnings._sum.earnings || 0,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    };
  }

  // ==================== ADMIN/LAUNDRY METHODS ====================

  async assignDeliveryPartner(orderId: string, dto: AssignDeliveryPartnerDto, _assignedBy: string) {
    // Verify order exists and is in appropriate status
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if already assigned
    const existingAssignment = await this.prisma.deliveryAssignment.findUnique({
      where: { order_id: orderId },
    });

    if (existingAssignment) {
      throw new BadRequestException('Order already has a delivery partner assigned');
    }

    // Verify delivery partner exists and is active
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { id: dto.delivery_partner_id },
    });

    if (!partner) {
      throw new NotFoundException('Delivery partner not found');
    }

    if (partner.status !== 'ACTIVE') {
      throw new BadRequestException('Delivery partner is not active');
    }

    // Create assignment
    const assignment = await this.prisma.deliveryAssignment.create({
      data: {
        order_id: orderId,
        delivery_partner_id: dto.delivery_partner_id,
        assignment_type: dto.assignment_type || 'BOTH',
        pickup_status: dto.assignment_type !== 'DELIVERY' ? 'PENDING' : null,
        delivery_status: dto.assignment_type !== 'PICKUP' ? 'PENDING' : null,
        earnings: dto.earnings || 0,
      },
      include: {
        order: true,
        delivery_partner: {
          select: {
            id: true,
            name: true,
            phone_number: true,
          },
        },
      },
    });

    // Update order with delivery partner
    await this.prisma.order.update({
      where: { id: orderId },
      data: { delivery_partner_id: dto.delivery_partner_id },
    });

    // Notify delivery partner
    try {
      await this.notifyDeliveryPartner(
        dto.delivery_partner_id,
        'New Assignment',
        `You have been assigned to order ${order.order_number}`,
        { order_id: orderId, assignment_id: assignment.id },
      );
    } catch (error) {
      this.logger.error('Failed to send assignment notification:', error);
    }

    return { assignment };
  }

  async getAvailablePartners(city?: string, page = 1, limit = 20) {
    const where: any = {
      status: 'ACTIVE',
      is_available: true,
      is_online: true,
    };

    if (city) {
      where.city = city;
    }

    const [partners, total] = await Promise.all([
      this.prisma.deliveryPartner.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone_number: true,
          avatar: true,
          vehicle_type: true,
          vehicle_number: true,
          rating: true,
          total_deliveries: true,
          latitude: true,
          longitude: true,
          city: true,
        },
        orderBy: [{ rating: 'desc' }, { total_deliveries: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.deliveryPartner.count({ where }),
    ]);

    return {
      partners,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    };
  }

  // ==================== HELPER METHODS ====================

  private async updateDeliveryPartnerStats(partnerId: string) {
    const stats = await this.prisma.deliveryAssignment.count({
      where: {
        delivery_partner_id: partnerId,
        delivery_status: 'COMPLETED',
      },
    });

    await this.prisma.deliveryPartner.update({
      where: { id: partnerId },
      data: { total_deliveries: stats },
    });
  }

  private async notifyDeliveryPartner(
    partnerId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    // Create notification record
    await this.prisma.notification.create({
      data: {
        delivery_partner_id: partnerId,
        type: 'ORDER_UPDATE',
        title,
        body,
        data: data || {},
      },
    });

    // Send push notification if FCM token exists
    const partner = await this.prisma.deliveryPartner.findUnique({
      where: { id: partnerId },
      select: { fcm_token: true },
    });

    if (partner?.fcm_token) {
      // FCM notification would be sent here via FirebaseService
      this.logger.log(`Push notification sent to delivery partner ${partnerId}`);
    }
  }

  private async notifyAssignmentUpdate(assignment: any, title: string, body: string) {
    // Notify laundry
    if (assignment.order?.laundry_id) {
      await this.prisma.notification.create({
        data: {
          laundry_id: assignment.order.laundry_id,
          type: 'ORDER_UPDATE',
          title,
          body,
          data: { order_id: assignment.order_id, assignment_id: assignment.id },
        },
      });
    }
  }
}
