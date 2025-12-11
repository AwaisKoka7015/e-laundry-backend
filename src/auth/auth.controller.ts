import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  SendOtpDto,
  VerifyOtpDto,
  SelectRoleDto,
  UpdateLocationDto,
  RefreshTokenDto,
  LogoutDto,
} from './dto';
import { JwtAuthGuard } from './guards';
import { CurrentUser, CurrentUserPayload } from '../common/decorators';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and create/login account' })
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

  @Post('select-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Select user role (CUSTOMER or LAUNDRY)' })
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
  async updateLocation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateLocationDto,
  ) {
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
  async logout(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: LogoutDto,
  ) {
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
}
