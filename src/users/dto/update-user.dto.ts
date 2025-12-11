import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ example: 'Ahmad Ali' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'ahmad@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: 'Near Liberty Market' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  near_landmark?: string;

  @ApiPropertyOptional({ example: 'House 123, Street 5, Gulberg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address_text?: string;

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
}
