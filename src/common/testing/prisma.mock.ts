import { PrismaService } from '../../prisma/prisma.service';

export type MockPrismaService = {
  [K in keyof PrismaService]: K extends `$${string}`
    ? jest.Mock
    : Record<string, jest.Mock>;
};

export const createMockPrismaService = (): MockPrismaService => {
  const mockModel = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  });

  return {
    user: mockModel(),
    laundry: mockModel(),
    tempAccount: mockModel(),
    refreshToken: mockModel(),
    order: mockModel(),
    orderItem: mockModel(),
    orderStatusHistory: mockModel(),
    orderTimeline: mockModel(),
    payment: mockModel(),
    review: mockModel(),
    serviceCategory: mockModel(),
    clothingItem: mockModel(),
    laundryService: mockModel(),
    servicePricing: mockModel(),
    promoCode: mockModel(),
    notification: mockModel(),
    appSetting: mockModel(),
    deliveryPartner: mockModel(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: jest.fn((cb) => (typeof cb === 'function' ? cb({}) : Promise.all(cb))),
    cleanDatabase: jest.fn(),
  } as unknown as MockPrismaService;
};
