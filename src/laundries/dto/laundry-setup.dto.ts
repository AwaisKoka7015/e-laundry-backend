import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

// ==================== STEP 1: REGISTER ====================

export class LaundryRegisterDto {
  @ApiProperty({ description: 'Phone number with country code', example: '+923001234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: 'OTP code for verification', example: '0000' })
  @IsString()
  @IsNotEmpty()
  otp: string;

  @ApiProperty({ description: 'Store/Laundry name', example: 'Clean & Fresh Laundry' })
  @IsString()
  @IsNotEmpty()
  store_name: string;

  @ApiProperty({ description: 'Owner name', example: 'Ahmed Khan' })
  @IsString()
  @IsNotEmpty()
  owner_name: string;
}

// ==================== STEP 2: LOCATION ====================

export class LaundrySetupLocationDto {
  @ApiProperty({ description: 'Latitude', example: 31.5204 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ description: 'Longitude', example: 74.3587 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({ description: 'Full address text', example: 'Shop 5, Main Boulevard, Gulberg III' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'City name', example: 'Lahore' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ description: 'Area/Locality name', example: 'Gulberg III' })
  @IsString()
  @IsOptional()
  area?: string;
}

// ==================== STEP 3: SELECT SERVICES ====================

export class LaundrySelectServicesDto {
  @ApiProperty({
    description: 'List of service category IDs to offer',
    example: ['uuid1', 'uuid2'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  service_category_ids: string[];
}

// ==================== STEP 4: UPDATE PRICES ====================

export class PriceUpdateItem {
  @ApiProperty({ description: 'LaundryPricing ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  laundry_pricing_id: string;

  @ApiProperty({ description: 'New price in PKR', example: 85 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Whether this item is active/offered', example: true })
  @IsBoolean()
  is_active: boolean;
}

export class LaundryUpdatePricesDto {
  @ApiProperty({
    description: 'List of price updates',
    type: [PriceUpdateItem],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceUpdateItem)
  prices: PriceUpdateItem[];
}

// ==================== RESPONSE DTOs ====================

export class LaundryRegisterResponseDto {
  @ApiProperty()
  laundry_id: string;

  @ApiProperty()
  access_token: string;

  @ApiProperty()
  refresh_token: string;
}

export class SetupLocationResponseDto {
  @ApiProperty()
  success: boolean;
}

export class SelectServicesResponseDto {
  @ApiProperty({ description: 'Number of services selected' })
  total_services: number;

  @ApiProperty({ description: 'Number of pricing rows created' })
  total_pricing_rows: number;
}

export class PricingItemDto {
  @ApiProperty()
  laundry_pricing_id: string;

  @ApiProperty()
  clothing_item: {
    id: string;
    name: string;
    name_urdu: string;
    is_popular: boolean;
  };

  @ApiProperty()
  price: number;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  default_price: number;

  @ApiProperty()
  min_price: number;

  @ApiProperty()
  max_price: number;
}

export class CategoryPricingDto {
  @ApiProperty()
  category: {
    id: string;
    name: string;
    name_urdu: string;
  };

  @ApiProperty({ type: [PricingItemDto] })
  items: PricingItemDto[];
}

export class ServicePricingDto {
  @ApiProperty()
  service: {
    id: string;
    name: string;
    name_urdu: string;
  };

  @ApiProperty({ type: [CategoryPricingDto] })
  categories: CategoryPricingDto[];
}

export class ReviewPricesResponseDto {
  @ApiProperty({ type: [ServicePricingDto] })
  services: ServicePricingDto[];
}

export class GoLiveResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}
