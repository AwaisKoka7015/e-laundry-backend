import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Matches,
  IsUrl,
  IsOptional,
  IsEnum,
} from 'class-validator';

// CNIC format: XXXXX-XXXXXXX-X (13 digits with dashes)
const CNIC_REGEX = /^\d{5}-\d{7}-\d{1}$/;

export class SubmitVerificationDto {
  @ApiProperty({
    example: '35201-1234567-1',
    description: 'CNIC number in format XXXXX-XXXXXXX-X',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(CNIC_REGEX, {
    message: 'CNIC must be in format XXXXX-XXXXXXX-X (e.g., 35201-1234567-1)',
  })
  cnic_number: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/.../cnic_front.jpg',
    description: 'URL of the CNIC front image',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  cnic_front_image: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/.../cnic_back.jpg',
    description: 'URL of the CNIC back image',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  cnic_back_image: string;
}

export class ResubmitVerificationDto extends SubmitVerificationDto {}

export enum VerificationAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class AdminReviewVerificationDto {
  @ApiProperty({
    enum: VerificationAction,
    example: VerificationAction.APPROVE,
    description: 'Action to take: APPROVE or REJECT',
  })
  @IsEnum(VerificationAction)
  action: VerificationAction;

  @ApiPropertyOptional({
    example: 'CNIC image is blurry, please upload a clearer image',
    description: 'Reason for rejection (required if action is REJECT)',
  })
  @IsOptional()
  @IsString()
  rejection_reason?: string;
}

// Response DTOs
export class VerificationStatusResponse {
  verification_status: string;
  cnic_number?: string;
  cnic_front_image?: string;
  cnic_back_image?: string;
  verification_submitted_at?: Date;
  verification_reviewed_at?: Date;
  verification_rejection_reason?: string;
  is_verified: boolean;
}

export class PendingVerificationLaundry {
  id: string;
  laundry_name: string;
  owner_name: string;
  phone_number: string;
  city?: string;
  cnic_number: string;
  cnic_front_image: string;
  cnic_back_image: string;
  verification_submitted_at: Date;
}
