import { IsOptional, IsInt, Min, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum OrderStatusFilter {
  ALL = 'all',
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

export enum PaymentStatusFilter {
  ALL = 'all',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export class AdminOrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(OrderStatusFilter)
  status?: OrderStatusFilter = OrderStatusFilter.ALL;

  @IsOptional()
  @IsEnum(PaymentStatusFilter)
  payment_status?: PaymentStatusFilter = PaymentStatusFilter.ALL;

  @IsOptional()
  @IsString()
  laundry_id?: string;

  @IsOptional()
  @IsString()
  customer_id?: string;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum([
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'PICKUP_SCHEDULED',
    'PICKED_UP',
    'PROCESSING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
  ])
  status:
    | 'PENDING'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'PICKUP_SCHEDULED'
    | 'PICKED_UP'
    | 'PROCESSING'
    | 'READY'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED';

  @IsOptional()
  @IsString()
  notes?: string;
}
