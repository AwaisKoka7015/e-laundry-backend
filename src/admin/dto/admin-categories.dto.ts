import {
  IsOptional,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Category name in Urdu' })
  @IsOptional()
  @IsString()
  name_urdu?: string;

  @ApiPropertyOptional({ description: 'Icon identifier' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Category description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Sort order', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({ description: 'Is category active', default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Category name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Category name in Urdu' })
  @IsOptional()
  @IsString()
  name_urdu?: string;

  @ApiPropertyOptional({ description: 'Icon identifier' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: 'Category description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @ApiPropertyOptional({ description: 'Is category active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ReorderCategoryDto {
  @ApiProperty({ description: 'Category ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'New sort order' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({
    type: [ReorderCategoryDto],
    description: 'Array of categories with new sort orders',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderCategoryDto)
  items: ReorderCategoryDto[];
}
