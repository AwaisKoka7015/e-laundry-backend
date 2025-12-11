import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  MinLength,
  MaxLength,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderType {
  STANDARD = 'STANDARD',
  EXPRESS = 'EXPRESS',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PICKUP_SCHEDULED = 'PICKUP_SCHEDULED',
  PICKED_UP = 'PICKED_UP',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class OrderItemDto {
  @ApiProperty()
  @IsUUID()
  service_id: string;

  @ApiProperty()
  @IsUUID()
  clothing_item_id: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number = 1;

  @ApiPropertyOptional({ description: 'For PER_KG pricing' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  weight_kg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  special_notes?: string;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsUUID()
  laundry_id: string;

  @ApiPropertyOptional({ enum: OrderType, default: OrderType.STANDARD })
  @IsOptional()
  @IsEnum(OrderType)
  order_type?: OrderType = OrderType.STANDARD;

  @ApiProperty({ example: 'House 123, Street 5, DHA Phase 6, Lahore' })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  pickup_address: string;

  @ApiProperty({ example: 31.4697 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  pickup_latitude: number;

  @ApiProperty({ example: 74.2728 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  pickup_longitude: number;

  @ApiProperty()
  @IsDateString()
  pickup_date: string;

  @ApiPropertyOptional({ example: '09:00-11:00' })
  @IsOptional()
  @IsString()
  pickup_time_slot?: string;

  @ApiPropertyOptional({ example: 'Ring doorbell twice' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickup_notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  delivery_address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  delivery_latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  delivery_longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  delivery_notes?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({ example: 'WELCOME50' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  promo_code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  special_instructions?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'] })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduled_pickup_time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejection_reason?: string;
}

export class CancelOrderDto {
  @ApiProperty({ example: 'Changed my mind about the service', minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason: string;
}
