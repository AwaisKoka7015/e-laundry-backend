import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsUUID, Min, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ValidatePromoDto {
  @ApiProperty({ example: 'WELCOME50' })
  @IsString()
  @MaxLength(20)
  @Transform(({ value }) => value?.toUpperCase())
  code: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  order_amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  laundry_id?: string;
}
