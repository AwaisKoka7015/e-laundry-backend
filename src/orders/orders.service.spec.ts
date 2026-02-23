import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { createMockPrismaService } from '../common/testing/prisma.mock';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: NotificationsService,
          useValue: {
            sendOrderNotification: jest.fn(),
            createNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('createOrder', () => {
    it('should throw NotFoundException for non-existent laundry', async () => {
      (prisma.laundry.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createOrder('customer-id', {
          laundry_id: 'fake-laundry',
          items: [{ clothing_item_id: 'item-1', service_id: 'svc-1', quantity: 1 }],
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for inactive laundry', async () => {
      (prisma.laundry.findUnique as jest.Mock).mockResolvedValue({
        id: 'laundry-id',
        status: 'BLOCKED',
      });

      await expect(
        service.createOrder('customer-id', {
          laundry_id: 'laundry-id',
          items: [{ clothing_item_id: 'item-1', service_id: 'svc-1', quantity: 1 }],
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCustomerOrders', () => {
    it('should return paginated orders', async () => {
      const mockOrders = [{ id: 'order-1', order_number: 'ORD-001', status: 'PENDING' }];

      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);
      (prisma.order.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getCustomerOrders('customer-id', undefined, 1, 10);

      expect(result.orders).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('status transitions', () => {
    const mockOrder = {
      id: 'order-id',
      order_number: 'ORD-001',
      customer_id: 'customer-id',
      laundry_id: 'laundry-id',
      status: 'PENDING',
      items: [],
      customer: { id: 'customer-id', fcm_token: null },
      laundry: { id: 'laundry-id', fcm_token: null },
    };

    it('should allow PENDING -> ACCEPTED', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'ACCEPTED',
      });
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'ACCEPTED',
      });
      (prisma.orderStatusHistory.create as jest.Mock).mockResolvedValue({});
      (prisma.orderTimeline.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateOrderStatus('order-id', 'laundry-id', {
        status: 'ACCEPTED',
      } as any);

      expect(result.order!.status).toBe('ACCEPTED');
    });

    it('should reject invalid status transition', async () => {
      (prisma.order.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
      });

      await expect(
        service.updateOrderStatus('order-id', 'laundry-id', {
          status: 'PENDING',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
