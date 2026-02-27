import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  SelectRoleDto,
  RegisterCustomerDto,
  RegisterLaundryDto,
  UpdateProfileLocationDto,
  RefreshTokenDto,
  LogoutDto,
  FirebaseAuthDto,
  RegisterDeviceDto,
} from './dto';
import { JwtAuthGuard } from './guards';
import { CurrentUser, CurrentUserPayload } from '../common/decorators';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to phone number' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid phone number' })
  @ApiResponse({ status: 429, description: 'Too many OTP requests' })
  async sendOtp(@Body() dto: SendOtpDto) {
    const data = await this.authService.sendOtp(dto);
    return {
      success: true,
      message: 'OTP sent successfully',
      data,
    };
  }

  @Post('verify-otp')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[DEV ONLY] Verify OTP and create/login account' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const data = await this.authService.verifyOtp(dto);
    return {
      success: true,
      message: 'OTP verified successfully',
      data,
    };
  }

  // ===== FIREBASE AUTH (PRODUCTION) =====

  @Post('firebase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[PRODUCTION] Authenticate with Firebase phone verification',
    description: `
      Use this endpoint in production. The mobile app should:
      1. Use Firebase Phone Auth to verify the user's phone number
      2. Get the Firebase ID token after successful verification
      3. Send the ID token to this endpoint
      4. Receive either JWT tokens (existing user) or temp_token (new user)
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    schema: {
      example: {
        success: true,
        message: 'Authentication successful',
        data: {
          is_new_user: false,
          requires_role_selection: false,
          requires_location: false,
          access_token: 'eyJ...',
          refresh_token: 'eyJ...',
          user: { id: '...', phone_number: '+923001234567', role: 'CUSTOMER' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired Firebase token' })
  async firebaseAuth(@Body() dto: FirebaseAuthDto) {
    const data = await this.authService.firebaseAuth(dto);
    return {
      success: true,
      message: data.is_new_user ? 'Please complete registration' : 'Authentication successful',
      data,
    };
  }

  // ===== REGISTRATION ENDPOINTS =====

  @Post('register/customer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register as a customer' })
  @ApiResponse({ status: 201, description: 'Customer registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 409, description: 'Account already exists' })
  async registerCustomer(@Body() dto: RegisterCustomerDto) {
    const data = await this.authService.registerCustomer(dto);
    return {
      success: true,
      message: 'Customer registered successfully',
      data,
    };
  }

  @Post('register/laundry')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('shop_images', 10)) // Max 10 images
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Register as a laundry (with shop images)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['temp_token', 'laundry_name', 'shop_images'],
      properties: {
        temp_token: {
          type: 'string',
          description: 'Temporary token from verify-otp (contains phone_number)',
        },
        laundry_name: { type: 'string', example: 'Clean & Fresh Laundry' },
        email: { type: 'string', example: 'shop@example.com' },
        shop_images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Shop images (at least 1 required, max 10)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Laundry registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or missing images' })
  @ApiResponse({ status: 409, description: 'Account already exists' })
  async registerLaundry(
    @Body() dto: RegisterLaundryDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one shop image is required');
    }
    const data = await this.authService.registerLaundry(dto, files);
    return {
      success: true,
      message: 'Laundry registered successfully',
      data,
    };
  }

  // ===== LEGACY ENDPOINT (for backward compatibility) =====
  @Post('select-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[DEPRECATED] Select user role - Use /register/customer or /register/laundry instead',
  })
  @ApiResponse({ status: 200, description: 'Role selected successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 409, description: 'Account already exists' })
  async selectRole(@Body() dto: SelectRoleDto) {
    const data = await this.authService.selectRole(dto);
    return {
      success: true,
      message: 'Role selected successfully',
      data,
    };
  }

  @Post('update-location')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user location' })
  @ApiResponse({ status: 200, description: 'Location updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateLocation(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateProfileLocationDto) {
    const data = await this.authService.updateLocation(user.sub, user.role, dto);
    return {
      success: true,
      message: 'Location updated successfully',
      data,
    };
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    const data = await this.authService.refreshToken(dto);
    return {
      success: true,
      message: 'Token refreshed successfully',
      data,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@CurrentUser() user: CurrentUserPayload, @Body() dto: LogoutDto) {
    const data = await this.authService.logout(user.sub, user.role, dto);
    return {
      success: true,
      ...data,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    const data = await this.authService.getMe(user.sub, user.role);
    return {
      success: true,
      data,
    };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get account status',
    description: 'Lightweight endpoint to check account status (for Android app)',
  })
  @ApiResponse({
    status: 200,
    description: 'Account status retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          phone_number: '+923001234567',
          role: 'LAUNDRY',
          status: 'ACTIVE',
          is_active: true,
          is_verified: true,
          requires_location: false,
          is_suspended: false,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStatus(@CurrentUser() user: CurrentUserPayload) {
    const data = await this.authService.getStatus(user.sub, user.role);
    return {
      success: true,
      data,
    };
  }

  @Post('register-device')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Register device for push notifications',
    description: `
Register the device's FCM token to receive push notifications.

**When to call:**
- After successful login
- When FCM token is refreshed by Firebase SDK
- When user re-enables notifications

**Push notification triggers:**
- Order status changes (ACCEPTED, PROCESSING, READY, etc.)
- New orders (for laundries)
- Promotional messages
- System announcements
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Device registered successfully',
    schema: {
      example: {
        success: true,
        message: 'Device registered for push notifications',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'FCM token is required' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async registerDevice(@CurrentUser() user: CurrentUserPayload, @Body() dto: RegisterDeviceDto) {
    await this.authService.registerFcmToken(user.sub, user.role, dto.fcm_token);
    return {
      success: true,
      message: 'Device registered for push notifications',
    };
  }

  @Post('unregister-device')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Unregister device from push notifications',
    description: `
Remove the FCM token to stop receiving push notifications.

**When to call:**
- User logs out
- User disables notifications in app settings
- Before registering a new device token
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Device unregistered successfully',
    schema: {
      example: {
        success: true,
        message: 'Device unregistered from push notifications',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unregisterDevice(@CurrentUser() user: CurrentUserPayload) {
    await this.authService.removeFcmToken(user.sub, user.role);
    return {
      success: true,
      message: 'Device unregistered from push notifications',
    };
  }
}
