import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Max,
  IsObject,
} from 'class-validator';

export class UpdateLaundryProfileDto {
  @ApiPropertyOptional({ example: 'Clean & Fresh Laundry' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  laundry_name?: string;

  @ApiPropertyOptional({ example: 'laundry@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Near Model Town Park' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  near_landmark?: string;

  @ApiPropertyOptional({ example: 'Shop 15, Main Boulevard, Model Town' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address_text?: string;

  @ApiPropertyOptional({ example: 'Professional laundry services since 2010' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fcm_token?: string;

  @ApiPropertyOptional({ example: 31.5204 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 74.3587 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 'Lahore' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    example: {
      monday: { open: '09:00', close: '21:00' },
      tuesday: { open: '09:00', close: '21:00' },
    },
  })
  @IsOptional()
  @IsObject()
  working_hours?: Record<string, { open: string; close: string; is_closed?: boolean }>;
}
