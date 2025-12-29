import {
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common';

export enum PromoStatusFilter {
  ALL = 'all',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  USED_UP = 'used_up',
}

export enum PromoTypeFilter {
  ALL = 'all',
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export class AdminPromoCodesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by promo code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: PromoStatusFilter,
    default: PromoStatusFilter.ALL,
  })
  @IsOptional()
  @IsEnum(PromoStatusFilter)
  status?: PromoStatusFilter = PromoStatusFilter.ALL;

  @ApiPropertyOptional({ enum: PromoTypeFilter, default: PromoTypeFilter.ALL })
  @IsOptional()
  @IsEnum(PromoTypeFilter)
  type?: PromoTypeFilter = PromoTypeFilter.ALL;
}

export class CreatePromoCodeDto {
  @ApiProperty({ description: 'Promo code (uppercase)' })
  @IsString()
  code: string;

  @ApiProperty({
    enum: ['PERCENTAGE', 'FIXED'],
    description: 'Discount type',
  })
  @IsEnum(['PERCENTAGE', 'FIXED'])
  discount_type: 'PERCENTAGE' | 'FIXED';

  @ApiProperty({ description: 'Discount value' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount_value: number;

  @ApiPropertyOptional({ description: 'Maximum discount amount (for percentage type)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_discount?: number;

  @ApiPropertyOptional({ description: 'Minimum order amount', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_order_amount?: number;

  @ApiProperty({ description: 'Valid from date' })
  @IsDateString()
  valid_from: string;

  @ApiProperty({ description: 'Valid until date' })
  @IsDateString()
  valid_until: string;

  @ApiPropertyOptional({ description: 'Usage limit (null for unlimited)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  usage_limit?: number;

  @ApiPropertyOptional({ description: 'First order only', default: false })
  @IsOptional()
  @IsBoolean()
  first_order_only?: boolean;

  @ApiPropertyOptional({ description: 'Is active', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdatePromoCodeDto {
  @ApiPropertyOptional({ description: 'Promo code (uppercase)' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({
    enum: ['PERCENTAGE', 'FIXED'],
    description: 'Discount type',
  })
  @IsOptional()
  @IsEnum(['PERCENTAGE', 'FIXED'])
  discount_type?: 'PERCENTAGE' | 'FIXED';

  @ApiPropertyOptional({ description: 'Discount value' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount_value?: number;

  @ApiPropertyOptional({ description: 'Maximum discount amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_discount?: number;

  @ApiPropertyOptional({ description: 'Minimum order amount' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_order_amount?: number;

  @ApiPropertyOptional({ description: 'Valid from date' })
  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @ApiPropertyOptional({ description: 'Valid until date' })
  @IsOptional()
  @IsDateString()
  valid_until?: string;

  @ApiPropertyOptional({ description: 'Usage limit' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  usage_limit?: number;

  @ApiPropertyOptional({ description: 'First order only' })
  @IsOptional()
  @IsBoolean()
  first_order_only?: boolean;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class PromoUsageQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by customer name or order number' })
  @IsOptional()
  @IsString()
  search?: string;
}
