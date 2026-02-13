import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { FirebaseService } from '../firebase/firebase.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  SelectRoleDto,
  RegisterCustomerDto,
  RegisterLaundryDto,
  UpdateLocationDto,
  RefreshTokenDto,
  LogoutDto,
  FirebaseAuthDto,
  UserRole,
} from './dto';
import { AccountStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly DEV_OTP = '0000';
  private readonly OTP_EXPIRY_MINUTES = 5;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private uploadService: UploadService,
    private firebaseService: FirebaseService,
  ) {}

  // ==================== SEND OTP ====================
  async sendOtp(dto: SendOtpDto) {
    const { phone_number } = dto;

    // Check rate limiting (max 5 OTPs per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentOtps = await this.prisma.tempAccount.count({
      where: {
        phone_number,
        created_at: { gte: oneHourAgo },
      },
    });

    if (recentOtps >= 5) {
      throw new BadRequestException({
        message: 'Too many OTP requests. Please try again later.',
        code: 'OTP_RATE_LIMIT',
      });
    }

    // Delete old temp accounts for this phone
    await this.prisma.tempAccount.deleteMany({
      where: { phone_number },
    });

    // Create new temp account with OTP
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.tempAccount.create({
      data: {
        phone_number,
        otp_code: this.DEV_OTP, // In production, generate random OTP
        expires_at: expiresAt,
      },
    });

    // In production: Send OTP via SMS service
    // await this.smsService.sendOtp(phone_number, otp);

    return {
      phone_number,
      expires_in: this.OTP_EXPIRY_MINUTES * 60,
      ...(this.configService.get('NODE_ENV') === 'development' && {
        dev_otp: this.DEV_OTP,
      }),
    };
  }

  // ==================== VERIFY OTP ====================
  async verifyOtp(dto: VerifyOtpDto) {
    const { phone_number, otp, device_info } = dto;

    // Check temp account
    const tempAccount = await this.prisma.tempAccount.findFirst({
      where: { phone_number },
      orderBy: { created_at: 'desc' },
    });

    if (!tempAccount) {
      throw new BadRequestException({
        message: 'No OTP request found. Please request OTP first.',
        code: 'OTP_NOT_FOUND',
      });
    }

    if (tempAccount.otp_code !== otp) {
      throw new BadRequestException({
        message: 'Invalid OTP',
        code: 'INVALID_OTP',
      });
    }

    if (new Date() > tempAccount.expires_at) {
      throw new BadRequestException({
        message: 'OTP has expired. Please request a new one.',
        code: 'OTP_EXPIRED',
      });
    }

    // Mark OTP as verified
    await this.prisma.tempAccount.update({
      where: { id: tempAccount.id },
      data: { otp_verified: true },
    });

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { phone_number },
    });

    const existingLaundry = await this.prisma.laundry.findUnique({
      where: { phone_number },
    });

    // Existing user login
    if (existingUser) {
      const tokens = await this.generateTokens(
        existingUser.id,
        phone_number,
        'CUSTOMER',
        device_info,
      );

      return {
        is_new_user: false,
        requires_role_selection: false,
        requires_location: existingUser.status === AccountStatus.PENDING_LOCATION,
        ...tokens,
        user: this.sanitizeUser(existingUser),
      };
    }

    // Existing laundry login
    if (existingLaundry) {
      const tokens = await this.generateTokens(
        existingLaundry.id,
        phone_number,
        'LAUNDRY',
        device_info,
      );

      return {
        is_new_user: false,
        requires_role_selection: false,
        requires_location: existingLaundry.status === AccountStatus.PENDING_LOCATION,
        ...tokens,
        user: this.sanitizeLaundry(existingLaundry),
      };
    }

    // New user - needs role selection
    const tempToken = this.jwtService.sign({ phone_number, type: 'temp' }, { expiresIn: '30m' });

    return {
      is_new_user: true,
      requires_role_selection: true,
      requires_location: false,
      temp_token: tempToken,
    };
  }

  // ==================== FIREBASE AUTH (PRODUCTION) ====================
  /**
   * Authenticate user with Firebase ID token
   * This is the production method - Firebase handles OTP sending/verification
   * Mobile app sends Firebase ID token after successful phone verification
   */
  async firebaseAuth(dto: FirebaseAuthDto) {
    const { firebase_token, device_info } = dto;

    // Verify Firebase token and extract phone number
    let firebaseUser: { uid: string; phone_number: string };
    try {
      firebaseUser = await this.firebaseService.verifyIdToken(firebase_token);
    } catch (error) {
      this.logger.error('Firebase token verification failed:', error);
      throw new UnauthorizedException({
        message: 'Invalid or expired Firebase token',
        code: 'INVALID_FIREBASE_TOKEN',
      });
    }

    const { phone_number } = firebaseUser;

    // Normalize phone number to Pakistani format if needed
    const normalizedPhone = this.normalizePhoneNumber(phone_number);

    // Check if user already exists (exclude DELETED accounts)
    const existingUser = await this.prisma.user.findFirst({
      where: {
        phone_number: normalizedPhone,
        status: { not: AccountStatus.DELETED },
      },
    });

    const existingLaundry = await this.prisma.laundry.findFirst({
      where: {
        phone_number: normalizedPhone,
        status: { not: AccountStatus.DELETED },
      },
    });

    // Existing customer login
    if (existingUser) {
      const tokens = await this.generateTokens(
        existingUser.id,
        normalizedPhone,
        'CUSTOMER',
        device_info,
      );

      this.logger.log(`Customer login: ${normalizedPhone}`);

      return {
        is_new_user: false,
        requires_role_selection: false,
        requires_location: existingUser.status === AccountStatus.PENDING_LOCATION,
        ...tokens,
        user: this.sanitizeUser(existingUser),
      };
    }

    // Existing laundry login
    if (existingLaundry) {
      const tokens = await this.generateTokens(
        existingLaundry.id,
        normalizedPhone,
        'LAUNDRY',
        device_info,
      );

      this.logger.log(`Laundry login: ${normalizedPhone}`);

      return {
        is_new_user: false,
        requires_role_selection: false,
        requires_location: existingLaundry.status === AccountStatus.PENDING_LOCATION,
        ...tokens,
        user: this.sanitizeLaundry(existingLaundry),
      };
    }

    // New user - create temp record and return temp token for registration
    // Store verified phone in temp account (Firebase already verified it)
    await this.prisma.tempAccount.deleteMany({
      where: { phone_number: normalizedPhone },
    });

    await this.prisma.tempAccount.create({
      data: {
        phone_number: normalizedPhone,
        otp_code: 'FIREBASE', // Marker that this was Firebase verified
        otp_verified: true,
        expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
    });

    const tempToken = this.jwtService.sign(
      { phone_number: normalizedPhone, type: 'temp', firebase_uid: firebaseUser.uid },
      { expiresIn: '30m' },
    );

    this.logger.log(`New user registration started: ${normalizedPhone}`);

    return {
      is_new_user: true,
      requires_role_selection: true,
      requires_location: false,
      temp_token: tempToken,
    };
  }

  /**
   * Normalize phone number to Pakistani format (+92...)
   */
  private normalizePhoneNumber(phone: string): string {
    if (!phone) return phone;

    let cleaned = phone.replace(/[\s-]/g, '');

    // Already in correct format
    if (cleaned.match(/^\+92[0-9]{10}$/)) {
      return cleaned;
    }

    // Handle various formats
    if (cleaned.startsWith('0')) {
      cleaned = '+92' + cleaned.substring(1);
    } else if (cleaned.startsWith('3')) {
      cleaned = '+92' + cleaned;
    } else if (cleaned.startsWith('92')) {
      cleaned = '+' + cleaned;
    }

    return cleaned;
  }

  // ==================== REGISTER CUSTOMER ====================
  async registerCustomer(dto: RegisterCustomerDto) {
    const { temp_token, name, email } = dto;

    // Verify temp token and extract phone_number
    let phone_number: string;
    try {
      const payload = this.jwtService.verify(temp_token);
      if (payload.type !== 'temp' || !payload.phone_number) {
        throw new UnauthorizedException('Invalid temp token');
      }
      phone_number = payload.phone_number;
    } catch {
      throw new UnauthorizedException('Invalid or expired temp token');
    }

    // Check if OTP was verified
    const tempAccount = await this.prisma.tempAccount.findFirst({
      where: {
        phone_number,
        otp_verified: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!tempAccount) {
      throw new BadRequestException({
        message: 'Please verify OTP first',
        code: 'OTP_NOT_VERIFIED',
      });
    }

    // Check if already registered (exclude DELETED accounts)
    const existingUser = await this.prisma.user.findFirst({
      where: { phone_number, status: { not: AccountStatus.DELETED } },
    });
    const existingLaundry = await this.prisma.laundry.findFirst({
      where: { phone_number, status: { not: AccountStatus.DELETED } },
    });

    if (existingUser || existingLaundry) {
      throw new ConflictException({
        message: 'Account already exists with this phone number',
        code: 'ACCOUNT_EXISTS',
      });
    }

    // Check email uniqueness if provided (exclude DELETED accounts)
    if (email) {
      const emailExists = await this.prisma.user.findFirst({
        where: { email, status: { not: AccountStatus.DELETED } },
      });
      if (emailExists) {
        throw new ConflictException({
          message: 'Email already in use',
          code: 'EMAIL_EXISTS',
        });
      }
    }

    // Check if there's a DELETED record with this phone number (for re-registration)
    const deletedUser = await this.prisma.user.findFirst({
      where: { phone_number, status: AccountStatus.DELETED },
    });

    let customer;
    if (deletedUser) {
      // Re-activate the deleted account with new data
      customer = await this.prisma.user.update({
        where: { id: deletedUser.id },
        data: {
          name,
          email,
          status: AccountStatus.PENDING_LOCATION,
          // Reset location fields
          latitude: null,
          longitude: null,
          city: null,
          address_text: null,
          near_landmark: null,
        },
      });
      this.logger.log(`Customer re-registered (was deleted): ${phone_number}`);
    } else {
      // Create new customer
      customer = await this.prisma.user.create({
        data: {
          phone_number,
          name,
          email,
          status: AccountStatus.PENDING_LOCATION,
        },
      });
    }

    // Clean up temp account
    await this.prisma.tempAccount.deleteMany({
      where: { phone_number },
    });

    // Generate tokens for the new user
    const tokens = await this.generateTokens(customer.id, phone_number, 'CUSTOMER');

    this.logger.log(`Customer registered: ${phone_number}`);

    return {
      ...tokens,
      user: this.sanitizeUser(customer),
      requires_location: true,
    };
  }

  // ==================== REGISTER LAUNDRY ====================
  async registerLaundry(dto: RegisterLaundryDto, files: Express.Multer.File[]) {
    const { temp_token, laundry_name, email } = dto;

    // Verify temp token and extract phone_number
    let phone_number: string;
    try {
      const payload = this.jwtService.verify(temp_token);
      if (payload.type !== 'temp' || !payload.phone_number) {
        throw new UnauthorizedException('Invalid temp token');
      }
      phone_number = payload.phone_number;
    } catch {
      throw new UnauthorizedException('Invalid or expired temp token');
    }

    // Check if OTP was verified
    const tempAccount = await this.prisma.tempAccount.findFirst({
      where: {
        phone_number,
        otp_verified: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!tempAccount) {
      throw new BadRequestException({
        message: 'Please verify OTP first',
        code: 'OTP_NOT_VERIFIED',
      });
    }

    // Check if already registered (exclude DELETED accounts)
    const existingUser = await this.prisma.user.findFirst({
      where: { phone_number, status: { not: AccountStatus.DELETED } },
    });
    const existingLaundry = await this.prisma.laundry.findFirst({
      where: { phone_number, status: { not: AccountStatus.DELETED } },
    });

    if (existingUser || existingLaundry) {
      throw new ConflictException({
        message: 'Account already exists with this phone number',
        code: 'ACCOUNT_EXISTS',
      });
    }

    // Check email uniqueness if provided (exclude DELETED accounts)
    if (email) {
      const emailExists = await this.prisma.laundry.findFirst({
        where: { email, status: { not: AccountStatus.DELETED } },
      });
      if (emailExists) {
        throw new ConflictException({
          message: 'Email already in use',
          code: 'EMAIL_EXISTS',
        });
      }
    }

    // Upload shop images to Cloudinary
    const shopImageUrls: string[] = [];
    for (const file of files) {
      // Convert file buffer to base64
      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      const uploadResult = await this.uploadService.uploadToFolder('shop_images', base64Image);
      shopImageUrls.push(uploadResult.url);
    }

    // Check if there's a DELETED record with this phone number (for re-registration)
    const deletedLaundry = await this.prisma.laundry.findFirst({
      where: { phone_number, status: AccountStatus.DELETED },
    });

    let laundry;
    if (deletedLaundry) {
      // Re-activate the deleted account with new data
      laundry = await this.prisma.laundry.update({
        where: { id: deletedLaundry.id },
        data: {
          laundry_name,
          email,
          shop_images: shopImageUrls,
          status: AccountStatus.PENDING_LOCATION,
          // Reset other fields
          is_verified: false,
          is_open: false,
          rating: 0,
          total_orders: 0,
          total_reviews: 0,
          services_count: 0,
          setup_at: null,
          setup_by: null,
          approved_at: null,
        },
      });
      this.logger.log(`Laundry re-registered (was deleted): ${phone_number}`);
    } else {
      // Create new laundry
      laundry = await this.prisma.laundry.create({
        data: {
          phone_number,
          laundry_name,
          email,
          shop_images: shopImageUrls,
          status: AccountStatus.PENDING_LOCATION,
        },
      });
    }

    // Clean up temp account
    await this.prisma.tempAccount.deleteMany({
      where: { phone_number },
    });

    // Generate tokens for the new laundry
    const tokens = await this.generateTokens(laundry.id, phone_number, 'LAUNDRY');

    this.logger.log(`Laundry registered: ${phone_number}`);

    return {
      ...tokens,
      user: this.sanitizeLaundry(laundry),
      requires_location: true,
    };
  }

  // ==================== SELECT ROLE (LEGACY) ====================
  async selectRole(dto: SelectRoleDto) {
    const { phone_number, role, temp_token, name, laundry_name, shop_images, email } = dto;

    // Verify temp token if provided
    if (temp_token) {
      try {
        const payload = this.jwtService.verify(temp_token);
        if (payload.phone_number !== phone_number || payload.type !== 'temp') {
          throw new UnauthorizedException('Invalid temp token');
        }
      } catch {
        throw new UnauthorizedException('Invalid or expired temp token');
      }
    }

    // Check if OTP was verified
    const tempAccount = await this.prisma.tempAccount.findFirst({
      where: {
        phone_number,
        otp_verified: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!tempAccount) {
      throw new BadRequestException({
        message: 'Please verify OTP first',
        code: 'OTP_NOT_VERIFIED',
      });
    }

    // Check if already registered (exclude DELETED accounts)
    const existingUser = await this.prisma.user.findFirst({
      where: { phone_number, status: { not: AccountStatus.DELETED } },
    });
    const existingLaundry = await this.prisma.laundry.findFirst({
      where: { phone_number, status: { not: AccountStatus.DELETED } },
    });

    if (existingUser || existingLaundry) {
      throw new ConflictException({
        message: 'Account already exists with this phone number',
        code: 'ACCOUNT_EXISTS',
      });
    }

    // Check email uniqueness if provided (exclude DELETED accounts)
    if (email) {
      const emailExistsUser = await this.prisma.user.findFirst({
        where: { email, status: { not: AccountStatus.DELETED } },
      });
      const emailExistsLaundry = await this.prisma.laundry.findFirst({
        where: { email, status: { not: AccountStatus.DELETED } },
      });
      if (emailExistsUser || emailExistsLaundry) {
        throw new ConflictException({
          message: 'Email already in use',
          code: 'EMAIL_EXISTS',
        });
      }
    }

    let newAccount: any;

    if (role === UserRole.CUSTOMER) {
      // Check if there's a DELETED user with this phone number
      const deletedUser = await this.prisma.user.findFirst({
        where: { phone_number, status: AccountStatus.DELETED },
      });

      if (deletedUser) {
        // Re-activate deleted account
        newAccount = await this.prisma.user.update({
          where: { id: deletedUser.id },
          data: {
            name,
            email,
            status: AccountStatus.PENDING_LOCATION,
            latitude: null,
            longitude: null,
            city: null,
            address_text: null,
            near_landmark: null,
          },
        });
      } else {
        // Create new customer
        newAccount = await this.prisma.user.create({
          data: {
            phone_number,
            name,
            email,
            status: AccountStatus.PENDING_LOCATION,
          },
        });
      }
    } else {
      // Check if there's a DELETED laundry with this phone number
      const deletedLaundry = await this.prisma.laundry.findFirst({
        where: { phone_number, status: AccountStatus.DELETED },
      });

      if (deletedLaundry) {
        // Re-activate deleted account
        newAccount = await this.prisma.laundry.update({
          where: { id: deletedLaundry.id },
          data: {
            laundry_name,
            email,
            shop_images: shop_images || [],
            status: AccountStatus.PENDING_LOCATION,
            is_verified: false,
            is_open: false,
            rating: 0,
            total_orders: 0,
            total_reviews: 0,
            services_count: 0,
            setup_at: null,
            setup_by: null,
            approved_at: null,
          },
        });
      } else {
        // Create new laundry
        newAccount = await this.prisma.laundry.create({
          data: {
            phone_number,
            laundry_name,
            email,
            shop_images: shop_images || [],
            status: AccountStatus.PENDING_LOCATION,
          },
        });
      }
    }

    // Clean up temp account
    await this.prisma.tempAccount.deleteMany({
      where: { phone_number },
    });

    return {
      user:
        role === UserRole.CUSTOMER
          ? this.sanitizeUser(newAccount)
          : this.sanitizeLaundry(newAccount),
      requires_location: true,
    };
  }

  // ==================== UPDATE LOCATION ====================
  async updateLocation(userId: string, role: string, dto: UpdateLocationDto) {
    const { latitude, longitude, city, address_text, near_landmark } = dto;

    if (role === 'CUSTOMER') {
      // Customer already ACTIVE, just update location
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          latitude,
          longitude,
          city,
          address_text,
          near_landmark,
          status: AccountStatus.ACTIVE,
        },
      });

      return {
        user: this.sanitizeUser(user),
      };
    } else {
      // Laundry stays PENDING until admin approves, just update location
      const laundry = await this.prisma.laundry.update({
        where: { id: userId },
        data: {
          latitude,
          longitude,
          city,
          address_text,
          near_landmark,
          status: AccountStatus.PENDING, // Stay PENDING until admin approves
        },
      });

      return {
        user: this.sanitizeLaundry(laundry),
      };
    }
  }

  // ==================== REFRESH TOKEN ====================
  async refreshToken(dto: RefreshTokenDto) {
    const { refresh_token, device_info } = dto;

    let payload: any;
    try {
      payload = this.jwtService.verify(refresh_token);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Verify refresh token exists in database
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        token: refresh_token,
        is_revoked: false,
        expires_at: { gt: new Date() },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token not found or revoked');
    }

    // Revoke old refresh token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { is_revoked: true },
    });

    // Generate new tokens
    return this.generateTokens(payload.sub, payload.phone_number, payload.role, device_info);
  }

  // ==================== LOGOUT ====================
  async logout(userId: string, role: string, dto: LogoutDto) {
    const { refresh_token, logout_all_devices } = dto;

    if (logout_all_devices) {
      // Revoke all refresh tokens
      if (role === 'CUSTOMER') {
        await this.prisma.refreshToken.updateMany({
          where: { user_id: userId },
          data: { is_revoked: true },
        });
      } else if (role === 'LAUNDRY') {
        await this.prisma.refreshToken.updateMany({
          where: { laundry_id: userId },
          data: { is_revoked: true },
        });
      }
    } else if (refresh_token) {
      // Revoke specific refresh token
      await this.prisma.refreshToken.updateMany({
        where: { token: refresh_token },
        data: { is_revoked: true },
      });
    }

    return { message: 'Logged out successfully' };
  }

  // ==================== GET ME ====================
  async getMe(userId: string, role: string) {
    if (role === 'CUSTOMER') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return { user: this.sanitizeUser(user) };
    } else if (role === 'LAUNDRY') {
      const laundry = await this.prisma.laundry.findUnique({
        where: { id: userId },
      });
      if (!laundry) {
        throw new UnauthorizedException('Laundry not found');
      }
      return { user: this.sanitizeLaundry(laundry) };
    }

    throw new UnauthorizedException('Invalid role');
  }

  // ==================== GET STATUS ====================
  async getStatus(userId: string, role: string) {
    if (role === 'CUSTOMER') {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          phone_number: true,
        },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return {
        id: user.id,
        phone_number: user.phone_number,
        role: 'CUSTOMER',
        status: user.status,
        is_active: user.status === AccountStatus.ACTIVE,
        requires_location: user.status === AccountStatus.PENDING_LOCATION,
        is_suspended: user.status === AccountStatus.SUSPENDED,
      };
    } else if (role === 'LAUNDRY') {
      const laundry = await this.prisma.laundry.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          phone_number: true,
          is_verified: true,
          is_open: true,
          setup_at: true,
          approved_at: true,
          services_count: true,
        },
      });
      if (!laundry) {
        throw new UnauthorizedException('Laundry not found');
      }

      // Calculate remaining time for auto-approval (2 hours after setup)
      const autoApproveMinutes = parseInt(
        this.configService.get('LAUNDRY_AUTO_APPROVE_MINUTES', '5'),
        10,
      );

      let approvalInfo: {
        is_pending_approval: boolean;
        is_setup_complete: boolean;
        setup_at: Date | null;
        approved_at: Date | null;
        approval_remaining_seconds: number;
        estimated_approval_at: Date | null;
      } = {
        is_pending_approval: false,
        is_setup_complete: !!laundry.setup_at,
        setup_at: laundry.setup_at,
        approved_at: laundry.approved_at,
        approval_remaining_seconds: 0,
        estimated_approval_at: null,
      };

      // Check if laundry is pending approval (set up but not yet approved)
      if (laundry.setup_at && !laundry.approved_at && laundry.status !== AccountStatus.ACTIVE) {
        approvalInfo.is_pending_approval = true;

        // Calculate estimated approval time
        const setupTime = new Date(laundry.setup_at).getTime();
        const approvalTime = setupTime + (autoApproveMinutes * 60 * 1000);
        const now = Date.now();
        const remainingMs = approvalTime - now;

        approvalInfo.estimated_approval_at = new Date(approvalTime);
        approvalInfo.approval_remaining_seconds = Math.max(0, Math.floor(remainingMs / 1000));
      }

      return {
        id: laundry.id,
        phone_number: laundry.phone_number,
        role: 'LAUNDRY',
        status: laundry.status,
        is_active: laundry.status === AccountStatus.ACTIVE,
        is_verified: laundry.is_verified,
        is_open: laundry.is_open,
        services_count: laundry.services_count,
        requires_location: laundry.status === AccountStatus.PENDING_LOCATION,
        is_suspended: laundry.status === AccountStatus.SUSPENDED,
        ...approvalInfo,
      };
    }

    throw new UnauthorizedException('Invalid role');
  }

  // ==================== HELPER METHODS ====================
  private async generateTokens(
    userId: string,
    phone_number: string,
    role: 'CUSTOMER' | 'LAUNDRY' | 'DELIVERY_PARTNER',
    device_info?: string,
  ) {
    const accessPayload = {
      sub: userId,
      phone_number,
      role,
      type: 'access',
    };

    const refreshPayload = {
      sub: userId,
      phone_number,
      role,
      type: 'refresh',
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') || '15m',
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    // Store refresh token
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const refreshTokenData: any = {
      token: refreshToken,
      device_info,
      expires_at: expiresAt,
    };

    if (role === 'CUSTOMER') {
      refreshTokenData.user_id = userId;
    } else if (role === 'LAUNDRY') {
      refreshTokenData.laundry_id = userId;
    } else {
      refreshTokenData.delivery_partner_id = userId;
    }

    await this.prisma.refreshToken.create({
      data: refreshTokenData,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      access_token_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      refresh_token_expires_at: expiresAt.toISOString(),
    };
  }

  private sanitizeUser(user: any) {
    const { ...sanitized } = user;
    return {
      ...sanitized,
      role: 'CUSTOMER',
    };
  }

  private sanitizeLaundry(laundry: any) {
    const { ...sanitized } = laundry;
    return {
      ...sanitized,
      role: 'LAUNDRY',
    };
  }

  // ==================== FCM TOKEN MANAGEMENT ====================

  async registerFcmToken(userId: string, role: string, fcmToken: string) {
    if (role === 'CUSTOMER') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { fcm_token: fcmToken },
      });
    } else if (role === 'LAUNDRY') {
      await this.prisma.laundry.update({
        where: { id: userId },
        data: { fcm_token: fcmToken },
      });
    } else if (role === 'DELIVERY_PARTNER') {
      await this.prisma.deliveryPartner.update({
        where: { id: userId },
        data: { fcm_token: fcmToken },
      });
    }
  }

  async removeFcmToken(userId: string, role: string) {
    if (role === 'CUSTOMER') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { fcm_token: null },
      });
    } else if (role === 'LAUNDRY') {
      await this.prisma.laundry.update({
        where: { id: userId },
        data: { fcm_token: null },
      });
    } else if (role === 'DELIVERY_PARTNER') {
      await this.prisma.deliveryPartner.update({
        where: { id: userId },
        data: { fcm_token: null },
      });
    }
  }
}
