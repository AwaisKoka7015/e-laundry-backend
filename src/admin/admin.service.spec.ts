import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService } from '../common/testing/prisma.mock';
import { createMockJwtService } from '../common/testing/jwt.mock';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let jwtService: ReturnType<typeof createMockJwtService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    jwtService = createMockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('adminLogin', () => {
    const mockAdmin = {
      id: 'admin-id',
      email: 'admin@elaundry.pk',
      password: '$2b$10$hashedpassword',
      phone_number: '+920000000000',
      name: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      avatar: null,
    };

    it('should return tokens on valid credentials', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockAdmin);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
      (prisma.user.update as jest.Mock).mockResolvedValue(mockAdmin);

      const result = await service.adminLogin('admin@elaundry.pk', 'admin123');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.email).toBe('admin@elaundry.pk');
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'admin@elaundry.pk', role: 'ADMIN' },
      });
    });

    it('should throw UnauthorizedException on invalid email', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.adminLogin('wrong@email.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockAdmin);
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

      await expect(service.adminLogin('admin@elaundry.pk', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for suspended admin', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        ...mockAdmin,
        status: 'SUSPENDED',
      });
      jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

      await expect(service.adminLogin('admin@elaundry.pk', 'admin123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getAdminProfile', () => {
    it('should return admin profile', async () => {
      const mockProfile = {
        id: 'admin-id',
        name: 'Admin',
        email: 'admin@elaundry.pk',
        role: 'ADMIN',
        avatar: null,
        phone_number: '+920000000000',
        created_at: new Date(),
        last_login: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.getAdminProfile('admin-id');
      expect(result.email).toBe('admin@elaundry.pk');
    });

    it('should throw NotFoundException for non-admin user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-id',
        role: 'CUSTOMER',
      });

      await expect(service.getAdminProfile('user-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getAdminProfile('fake-id')).rejects.toThrow(NotFoundException);
    });
  });
});
