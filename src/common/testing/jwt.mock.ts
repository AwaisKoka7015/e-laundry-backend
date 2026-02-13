import { JwtService } from '@nestjs/jwt';

export const createMockJwtService = (): Partial<JwtService> => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({
    sub: 'test-user-id',
    phone_number: '+923001234567',
    role: 'ADMIN',
    type: 'access',
  }),
  signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
  verifyAsync: jest.fn().mockResolvedValue({
    sub: 'test-user-id',
    phone_number: '+923001234567',
    role: 'ADMIN',
    type: 'access',
  }),
});
