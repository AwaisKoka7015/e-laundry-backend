import { IsOptional, IsString, IsEnum, IsArray, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common';

export enum AdminNotificationType {
  ALL = 'all',
  ORDER_UPDATE = 'ORDER_UPDATE',
  PROMO = 'PROMO',
  SYSTEM = 'SYSTEM',
  REVIEW = 'REVIEW',
  WELCOME = 'WELCOME',
}

export enum NotificationTarget {
  ALL_USERS = 'ALL_USERS',
  CUSTOMERS = 'CUSTOMERS',
  LAUNDRIES = 'LAUNDRIES',
}

export class AdminNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by title or body' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: AdminNotificationType,
    default: AdminNotificationType.ALL,
  })
  @IsOptional()
  @IsEnum(AdminNotificationType)
  type?: AdminNotificationType = AdminNotificationType.ALL;

  @ApiPropertyOptional({
    enum: NotificationTarget,
    description: 'Filter by target audience',
  })
  @IsOptional()
  @IsEnum(NotificationTarget)
  target?: NotificationTarget;
}

export class SendNotificationDto {
  @ApiProperty({ description: 'Notification title', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: 'Notification message/body', maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message: string;

  @ApiProperty({
    enum: ['ORDER_UPDATE', 'PROMO', 'SYSTEM', 'REVIEW', 'WELCOME'],
    description: 'Notification type',
  })
  @IsEnum(['ORDER_UPDATE', 'PROMO', 'SYSTEM', 'REVIEW', 'WELCOME'])
  type: 'ORDER_UPDATE' | 'PROMO' | 'SYSTEM' | 'REVIEW' | 'WELCOME';

  @ApiProperty({
    enum: NotificationTarget,
    description: 'Target audience',
  })
  @IsEnum(NotificationTarget)
  target: NotificationTarget;

  @ApiPropertyOptional({ description: 'Optional image URL' })
  @IsOptional()
  @IsString()
  image?: string;
}

export class SendBulkNotificationDto {
  @ApiProperty({ description: 'Notification title', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: 'Notification message/body', maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message: string;

  @ApiProperty({
    enum: ['ORDER_UPDATE', 'PROMO', 'SYSTEM', 'REVIEW', 'WELCOME'],
    description: 'Notification type',
  })
  @IsEnum(['ORDER_UPDATE', 'PROMO', 'SYSTEM', 'REVIEW', 'WELCOME'])
  type: 'ORDER_UPDATE' | 'PROMO' | 'SYSTEM' | 'REVIEW' | 'WELCOME';

  @ApiProperty({
    type: [String],
    description: 'Array of user IDs to send notification to',
  })
  @IsArray()
  @IsString({ each: true })
  user_ids: string[];

  @ApiPropertyOptional({ description: 'Optional image URL' })
  @IsOptional()
  @IsString()
  image?: string;
}
