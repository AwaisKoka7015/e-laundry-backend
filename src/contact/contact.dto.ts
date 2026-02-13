import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ContactFormDto {
  @ApiProperty({ example: 'Ahmed Khan' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ahmed@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+92 300 1234567' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'Lahore' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'general' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'I have a question about your services.' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
