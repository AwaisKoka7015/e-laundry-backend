import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, IsEnum, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum SortBy {
  RATING = 'rating',
  REVIEWS = 'reviews',
  ORDERS = 'orders',
  DISTANCE = 'distance',
  NEWEST = 'newest',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

// ===== PAGINATION DTO =====
export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

// ===== GET ALL LAUNDRIES DTO =====
export class GetLaundriesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Filter by minimum rating (0-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  min_rating?: number;

  @ApiPropertyOptional({ description: 'Filter by service category ID' })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({ description: 'Only verified laundries', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  is_verified?: boolean;

  @ApiPropertyOptional({ enum: SortBy, default: SortBy.RATING, description: 'Sort field' })
  @IsOptional()
  @IsEnum(SortBy)
  sort_by?: SortBy = SortBy.RATING;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC, description: 'Sort order' })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.DESC;
}

// ===== GET NEARBY LAUNDRIES DTO =====
export class GetNearbyLaundriesDto extends PaginationDto {
  @ApiProperty({ description: 'User latitude', example: 31.5204 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ description: 'User longitude', example: 74.3587 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({ description: 'Search radius in KM', default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  radius_km?: number = 10;

  @ApiPropertyOptional({ description: 'Filter by minimum rating (0-5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  min_rating?: number;

  @ApiPropertyOptional({ description: 'Filter by service category ID' })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiPropertyOptional({ enum: SortBy, default: SortBy.DISTANCE, description: 'Sort field' })
  @IsOptional()
  @IsEnum(SortBy)
  sort_by?: SortBy = SortBy.DISTANCE;
}

// ===== GET TOP RATED LAUNDRIES DTO =====
export class GetTopRatedLaundriesDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Minimum number of reviews to be considered', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_reviews?: number = 0;

  @ApiPropertyOptional({ description: 'Filter by service category ID' })
  @IsOptional()
  @IsString()
  category_id?: string;
}

// ===== RESPONSE TYPES =====
export class LaundryListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  laundry_name: string;

  @ApiPropertyOptional()
  laundry_logo: string;

  @ApiPropertyOptional()
  shop_images: string[];

  @ApiProperty()
  rating: number;

  @ApiProperty()
  total_reviews: number;

  @ApiProperty()
  total_orders: number;

  @ApiProperty()
  services_count: number;

  @ApiProperty()
  is_verified: boolean;

  @ApiPropertyOptional()
  address_text: string;

  @ApiPropertyOptional()
  city: string;

  @ApiPropertyOptional()
  distance_km?: number;

  @ApiPropertyOptional()
  services_preview?: string[];
}

export class PaginationMeta {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  total_pages: number;

  @ApiProperty()
  has_next: boolean;

  @ApiProperty()
  has_prev: boolean;
}

export class LaundryListResponseDto {
  @ApiProperty({ type: [LaundryListItemDto] })
  laundries: LaundryListItemDto[];

  @ApiProperty()
  pagination: PaginationMeta;
}
