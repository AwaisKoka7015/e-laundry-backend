import { IsOptional, IsString, IsBoolean, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common';

export enum ClothingTypeFilter {
  ALL = 'all',
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  KIDS = 'KIDS',
  HOME = 'HOME',
}

export class ClothingItemsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by item name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ClothingTypeFilter, default: ClothingTypeFilter.ALL })
  @IsOptional()
  @IsEnum(ClothingTypeFilter)
  type?: ClothingTypeFilter = ClothingTypeFilter.ALL;
}

export class CreateClothingItemDto {
  @ApiProperty({ description: 'Item name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Item name in Urdu' })
  @IsOptional()
  @IsString()
  name_urdu?: string;

  @ApiProperty({ enum: ['MEN', 'WOMEN', 'KIDS', 'HOME'], description: 'Clothing type' })
  @IsEnum(['MEN', 'WOMEN', 'KIDS', 'HOME'])
  type: 'MEN' | 'WOMEN' | 'KIDS' | 'HOME';

  @ApiPropertyOptional({ description: 'Icon identifier' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Item description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Sort order', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({ description: 'Is item active', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateClothingItemDto {
  @ApiPropertyOptional({ description: 'Item name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Item name in Urdu' })
  @IsOptional()
  @IsString()
  name_urdu?: string;

  @ApiPropertyOptional({ enum: ['MEN', 'WOMEN', 'KIDS', 'HOME'], description: 'Clothing type' })
  @IsOptional()
  @IsEnum(['MEN', 'WOMEN', 'KIDS', 'HOME'])
  type?: 'MEN' | 'WOMEN' | 'KIDS' | 'HOME';

  @ApiPropertyOptional({ description: 'Icon identifier' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Item description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({ description: 'Is item active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
