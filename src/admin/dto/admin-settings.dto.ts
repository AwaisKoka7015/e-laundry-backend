import { IsOptional, IsString, IsBoolean, IsNumber, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingDto {
  @ApiProperty({ description: 'Setting value (any JSON-compatible value)' })
  value: any;
}

export class GeneralSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  app_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  support_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  support_phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  maintenance_mode?: boolean;
}

export class PricingSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  delivery_fee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  free_delivery_threshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  express_multiplier?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  platform_commission?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  tax_percentage?: number;
}

export class DeliverySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  default_pickup_radius?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  max_pickup_radius?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  min_order_amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  standard_delivery_days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  express_delivery_days?: number;
}

export class NotificationSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notify_new_order?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notify_order_status?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notify_promotional?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notify_system?: boolean;
}

export class SecuritySettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  otp_expiry_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  max_login_attempts?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  session_timeout_hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  require_phone_verification?: boolean;
}

export class AppearanceSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primary_color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secondary_color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo_url?: string;
}

export class BulkUpdateSettingsDto {
  @ApiProperty({ description: 'Object with setting key-value pairs' })
  @IsObject()
  settings: Record<string, any>;
}
