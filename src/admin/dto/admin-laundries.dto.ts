import {
  IsOptional,
  IsString,
  IsEnum,
  IsEmail,
  IsNumber,
  IsObject,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common';

export enum VerificationAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export enum LaundryStatusFilter {
  ALL = 'all',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

export enum LaundryVerifiedFilter {
  ALL = 'all',
  VERIFIED = 'verified',
  UNVERIFIED = 'unverified',
}

export class AdminLaundriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by laundry name or phone number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: LaundryStatusFilter, default: LaundryStatusFilter.ALL })
  @IsOptional()
  @IsEnum(LaundryStatusFilter)
  status?: LaundryStatusFilter = LaundryStatusFilter.ALL;

  @ApiPropertyOptional({ enum: LaundryVerifiedFilter, default: LaundryVerifiedFilter.ALL })
  @IsOptional()
  @IsEnum(LaundryVerifiedFilter)
  verified?: LaundryVerifiedFilter = LaundryVerifiedFilter.ALL;

  @ApiPropertyOptional({ description: 'Filter by city' })
  @IsOptional()
  @IsString()
  city?: string;
}

export class UpdateLaundryStatusDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'BLOCKED'] })
  @IsEnum(['ACTIVE', 'BLOCKED'])
  status: 'ACTIVE' | 'BLOCKED';
}

export class PendingSetupLaundriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by laundry name or phone number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by city' })
  @IsOptional()
  @IsString()
  city?: string;
}

export class UpdateLaundryDto {
  @ApiPropertyOptional({ description: 'Laundry shop name' })
  @IsOptional()
  @IsString()
  laundry_name?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({ description: 'Description of the laundry' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Full address text' })
  @IsOptional()
  @IsString()
  address_text?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Nearby landmark' })
  @IsOptional()
  @IsString()
  near_landmark?: string;

  @ApiPropertyOptional({ description: 'Latitude coordinate' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude coordinate' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Working hours JSON object' })
  @IsOptional()
  @IsObject()
  working_hours?: Record<string, any>;
}

export class PendingVerificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by laundry name or phone number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by city' })
  @IsOptional()
  @IsString()
  city?: string;
}

export class AdminReviewVerificationDto {
  @ApiProperty({
    enum: VerificationAction,
    example: VerificationAction.APPROVE,
    description: 'Action to take: APPROVE or REJECT',
  })
  @IsEnum(VerificationAction)
  action: VerificationAction;

  @ApiPropertyOptional({
    example: 'CNIC image is blurry, please upload a clearer image',
    description: 'Reason for rejection (required if action is REJECT)',
  })
  @ValidateIf((o) => o.action === VerificationAction.REJECT)
  @IsString()
  rejection_reason?: string;
}
