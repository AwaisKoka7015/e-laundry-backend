import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PriceUnit {
  PER_PIECE = 'PER_PIECE',
  PER_KG = 'PER_KG',
}

export class CreateServiceDto {
  @ApiProperty({ example: 'uuid-of-category' })
  @IsUUID()
  category_id: string;

  @ApiProperty({ example: 'Premium Wash' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Our premium washing service with special care' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 50, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  base_price?: number = 0;

  @ApiPropertyOptional({ enum: PriceUnit, default: PriceUnit.PER_PIECE })
  @IsOptional()
  @IsEnum(PriceUnit)
  price_unit?: PriceUnit = PriceUnit.PER_PIECE;

  @ApiPropertyOptional({ example: 24, default: 24 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  estimated_hours?: number = 24;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean = true;
}

export class UpdateServiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  base_price?: number;

  @ApiPropertyOptional({ enum: PriceUnit })
  @IsOptional()
  @IsEnum(PriceUnit)
  price_unit?: PriceUnit;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  estimated_hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}

export class ServicePricingItemDto {
  @ApiProperty()
  @IsUUID()
  clothing_item_id: string;

  @ApiProperty({ example: 50 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 75 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  express_price?: number;

  @ApiPropertyOptional({ enum: PriceUnit })
  @IsOptional()
  @IsEnum(PriceUnit)
  price_unit?: PriceUnit;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean = true;
}

export class BulkPricingDto {
  @ApiProperty({ type: [ServicePricingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServicePricingItemDto)
  pricing: ServicePricingItemDto[];
}
