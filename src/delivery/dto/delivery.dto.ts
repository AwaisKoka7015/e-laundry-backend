import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsNumber,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export enum AssignmentType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
  BOTH = 'BOTH',
}

export enum PickupStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EN_ROUTE = 'EN_ROUTE',
  ARRIVED = 'ARRIVED',
  COMPLETED = 'COMPLETED',
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EN_ROUTE = 'EN_ROUTE',
  ARRIVED = 'ARRIVED',
  COMPLETED = 'COMPLETED',
}

export class UpdateAvailabilityDto {
  @ApiProperty({ description: 'Whether the delivery partner is available for new assignments' })
  @IsOptional()
  is_available?: boolean;

  @ApiProperty({ description: 'Whether the delivery partner is online' })
  @IsOptional()
  is_online?: boolean;
}

export class UpdateLocationDto {
  @ApiProperty({ example: 31.4697 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 74.2728 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

export class AcceptAssignmentDto {
  @ApiPropertyOptional({ description: 'Estimated time of arrival in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(180)
  eta_minutes?: number;
}

export class RejectAssignmentDto {
  @ApiProperty({ description: 'Reason for rejecting the assignment', minLength: 5 })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class UpdatePickupStatusDto {
  @ApiProperty({ enum: ['EN_ROUTE', 'ARRIVED', 'COMPLETED'] })
  @IsEnum(PickupStatus)
  status: PickupStatus;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateDeliveryStatusDto {
  @ApiProperty({ enum: ['EN_ROUTE', 'ARRIVED', 'COMPLETED'] })
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UploadProofDto {
  @ApiProperty({ description: 'URL of the proof image' })
  @IsString()
  image_url: string;

  @ApiPropertyOptional({ description: 'Additional notes about the proof' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AssignDeliveryPartnerDto {
  @ApiProperty({ description: 'ID of the delivery partner to assign' })
  @IsUUID()
  delivery_partner_id: string;

  @ApiPropertyOptional({ enum: AssignmentType, default: AssignmentType.BOTH })
  @IsOptional()
  @IsEnum(AssignmentType)
  assignment_type?: AssignmentType = AssignmentType.BOTH;

  @ApiPropertyOptional({ description: 'Earnings for this assignment' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  earnings?: number;
}
