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
        requires_location: existingUser.status === 'PENDING_LOCATION',
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
        requires_location: existingLaundry.status === 'PENDING_LOCATION',
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

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { phone_number: normalizedPhone },
    });

    const existingLaundry = await this.prisma.laundry.findUnique({
      where: { phone_number: normalizedPhone },
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
        requires_location: existingUser.status === 'PENDING_LOCATION',
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
        requires_location: existingLaundry.status === 'PENDING_LOCATION',
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

    // Check if already registered
    const existingUser = await this.prisma.user.findUnique({
      where: { phone_number },
    });
    const existingLaundry = await this.prisma.laundry.findUnique({
      where: { phone_number },
    });

    if (existingUser || existingLaundry) {
      throw new ConflictException({
        message: 'Account already exists with this phone number',
        code: 'ACCOUNT_EXISTS',
      });
    }

    // Check email uniqueness if provided
    if (email) {
      const emailExists = await this.prisma.user.findUnique({
        where: { email },
      });
      if (emailExists) {
        throw new ConflictException({
          message: 'Email already in use',
          code: 'EMAIL_EXISTS',
        });
      }
    }

    // Create customer
    const customer = await this.prisma.user.create({
      data: {
        phone_number,
        name,
        email,
        status: 'PENDING_LOCATION',
      },
    });

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

    // Check if already registered
    const existingUser = await this.prisma.user.findUnique({
      where: { phone_number },
    });
    const existingLaundry = await this.prisma.laundry.findUnique({
      where: { phone_number },
    });

    if (existingUser || existingLaundry) {
      throw new ConflictException({
        message: 'Account already exists with this phone number',
        code: 'ACCOUNT_EXISTS',
      });
    }

    // Check email uniqueness if provided
    if (email) {
      const emailExists = await this.prisma.laundry.findUnique({
        where: { email },
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

    // Create laundry
    const laundry = await this.prisma.laundry.create({
      data: {
        phone_number,
        laundry_name,
        email,
        shop_images: shopImageUrls,
        status: 'PENDING_LOCATION',
      },
    });

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

    // Check if already registered
    const existingUser = await this.prisma.user.findUnique({
      where: { phone_number },
    });
    const existingLaundry = await this.prisma.laundry.findUnique({
      where: { phone_number },
    });

    if (existingUser || existingLaundry) {
      throw new ConflictException({
        message: 'Account already exists with this phone number',
        code: 'ACCOUNT_EXISTS',
      });
    }

    // Check email uniqueness if provided
    if (email) {
      const emailExistsUser = await this.prisma.user.findUnique({
        where: { email },
      });
      const emailExistsLaundry = await this.prisma.laundry.findUnique({
        where: { email },
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
      // Create customer with name and optional email
      newAccount = await this.prisma.user.create({
        data: {
          phone_number,
          name,
          email,
          status: 'PENDING_LOCATION',
        },
      });
    } else {
      // Create laundry with laundry_name, shop_images, and optional email
      newAccount = await this.prisma.laundry.create({
        data: {
          phone_number,
          laundry_name,
          email,
          shop_images: shop_images || [],
          status: 'PENDING_LOCATION',
        },
      });
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
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          latitude,
          longitude,
          city,
          address_text,
          near_landmark,
          status: 'ACTIVE',
        },
      });

      return {
        user: this.sanitizeUser(user),
      };
    } else {
      const laundry = await this.prisma.laundry.update({
        where: { id: userId },
        data: {
          latitude,
          longitude,
          city,
          address_text,
          near_landmark,
          status: 'ACTIVE',
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
}
