import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { FirebaseService } from '../firebase/firebase.service';
import { createMockPrismaService } from '../common/testing/prisma.mock';
import { createMockJwtService } from '../common/testing/jwt.mock';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let jwtService: ReturnType<typeof createMockJwtService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    jwtService = createMockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                NODE_ENV: 'development',
                JWT_ACCESS_SECRET: 'test-secret',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return config[key];
            }),
          },
        },
        {
          provide: UploadService,
          useValue: {
            uploadToFolder: jest.fn().mockResolvedValue({
              url: 'https://example.com/image.jpg',
              public_id: 'test-id',
            }),
          },
        },
        {
          provide: FirebaseService,
          useValue: {
            verifyIdToken: jest.fn(),
            sendPushNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('sendOtp', () => {
    it('should send OTP successfully', async () => {
      (prisma.tempAccount.count as jest.Mock).mockResolvedValue(0);
      (prisma.tempAccount.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.tempAccount.create as jest.Mock).mockResolvedValue({
        id: 'temp-id',
        phone_number: '+923001234567',
        otp_code: '0000',
      });

      const result = await service.sendOtp({ phone_number: '+923001234567' });

      expect(result.phone_number).toBe('+923001234567');
      expect(result.expires_in).toBe(300);
      expect(result.dev_otp).toBe('0000');
    });

    it('should throw BadRequestException on rate limit', async () => {
      (prisma.tempAccount.count as jest.Mock).mockResolvedValue(5);

      await expect(service.sendOtp({ phone_number: '+923001234567' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyOtp', () => {
    it('should throw BadRequestException for non-existent temp account', async () => {
      (prisma.tempAccount.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.verifyOtp({ phone_number: '+923001234567', otp: '0000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid OTP', async () => {
      (prisma.tempAccount.findFirst as jest.Mock).mockResolvedValue({
        id: 'temp-id',
        phone_number: '+923001234567',
        otp_code: '0000',
        otp_verified: false,
        expires_at: new Date(Date.now() + 300000),
      });

      await expect(
        service.verifyOtp({ phone_number: '+923001234567', otp: '1234' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for expired OTP', async () => {
      (prisma.tempAccount.findFirst as jest.Mock).mockResolvedValue({
        id: 'temp-id',
        phone_number: '+923001234567',
        otp_code: '0000',
        otp_verified: false,
        expires_at: new Date(Date.now() - 1000), // expired
      });

      await expect(
        service.verifyOtp({ phone_number: '+923001234567', otp: '0000' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refreshToken', () => {
    it('should throw UnauthorizedException for invalid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refreshToken({ refresh_token: 'invalid-token' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
