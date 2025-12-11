import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Length,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Helper to transform Pakistani phone numbers
function transformPhoneNumber(value: string): string {
  if (!value) return value;
  let cleaned = value.replace(/[\s-]/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = '+92' + cleaned.substring(1);
  } else if (cleaned.startsWith('3')) {
    cleaned = '+92' + cleaned;
  } else if (cleaned.startsWith('92')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

export class SendOtpDto {
  @ApiProperty({ example: '+923001234567', description: 'Pakistani phone number' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => transformPhoneNumber(value))
  @Matches(/^\+92[0-9]{10}$/, {
    message: 'Invalid Pakistani phone number. Format: +923001234567 or 03001234567',
  })
  phone_number: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+923001234567' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => transformPhoneNumber(value))
  @Matches(/^\+92[0-9]{10}$/, {
    message: 'Invalid Pakistani phone number',
  })
  phone_number: string;

  @ApiProperty({ example: '0000', description: 'OTP code (4 digits)' })
  @IsString()
  @Length(4, 4, { message: 'OTP must be 4 digits' })
  otp: string;

  @ApiPropertyOptional({ example: 'iPhone 14 Pro, iOS 17.0' })
  @IsOptional()
  @IsString()
  device_info?: string;
}

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  LAUNDRY = 'LAUNDRY',
}

export class SelectRoleDto {
  @ApiProperty({ example: '+923001234567' })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => transformPhoneNumber(value))
  @Matches(/^\+92[0-9]{10}$/, {
    message: 'Invalid Pakistani phone number',
  })
  phone_number: string;

  @ApiProperty({ enum: UserRole, example: 'CUSTOMER' })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ description: 'Temporary token from verify-otp' })
  @IsOptional()
  @IsString()
  temp_token?: string;
}

export class UpdateLocationDto {
  @ApiProperty({ example: 31.5204 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 74.3587 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({ example: 'Lahore' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'House 123, Street 5, Gulberg' })
  @IsOptional()
  @IsString()
  address_text?: string;

  @ApiPropertyOptional({ example: 'Near Liberty Market' })
  @IsOptional()
  @IsString()
  near_landmark?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refresh_token: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  device_info?: string;
}

export class LogoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refresh_token?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  logout_all_devices?: boolean = false;
}

// Response DTOs
export class AuthResponseDto {
  @ApiProperty()
  is_new_user: boolean;

  @ApiProperty()
  requires_role_selection: boolean;

  @ApiProperty()
  requires_location: boolean;

  @ApiPropertyOptional()
  temp_token?: string;

  @ApiPropertyOptional()
  access_token?: string;

  @ApiPropertyOptional()
  refresh_token?: string;

  @ApiPropertyOptional()
  access_token_expires_at?: string;

  @ApiPropertyOptional()
  refresh_token_expires_at?: string;

  @ApiPropertyOptional()
  user?: any;
}
