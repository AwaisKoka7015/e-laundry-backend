import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common';

export enum LaundryStatusFilter {
  ALL = 'all',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_LOCATION = 'PENDING_LOCATION',
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
  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsEnum(['ACTIVE', 'SUSPENDED'])
  status: 'ACTIVE' | 'SUSPENDED';
}
