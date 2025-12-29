import { IsOptional, IsString, IsInt, Min, Max, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common';

export enum RatingFilter {
  ALL = 'all',
  FIVE = '5',
  FOUR = '4',
  THREE = '3',
  TWO = '2',
  ONE = '1',
}

export enum VisibilityFilter {
  ALL = 'all',
  VISIBLE = 'visible',
  HIDDEN = 'hidden',
}

export enum ReplyFilter {
  ALL = 'all',
  REPLIED = 'replied',
  PENDING = 'pending',
}

export class AdminReviewsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by customer name, laundry name, or comment' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: RatingFilter, default: RatingFilter.ALL })
  @IsOptional()
  @IsEnum(RatingFilter)
  rating?: RatingFilter = RatingFilter.ALL;

  @ApiPropertyOptional({ enum: VisibilityFilter, default: VisibilityFilter.ALL })
  @IsOptional()
  @IsEnum(VisibilityFilter)
  visibility?: VisibilityFilter = VisibilityFilter.ALL;

  @ApiPropertyOptional({ enum: ReplyFilter, default: ReplyFilter.ALL })
  @IsOptional()
  @IsEnum(ReplyFilter)
  reply_status?: ReplyFilter = ReplyFilter.ALL;

  @ApiPropertyOptional({ description: 'Filter by laundry ID' })
  @IsOptional()
  @IsString()
  laundry_id?: string;

  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsOptional()
  @IsString()
  customer_id?: string;
}

export class UpdateReviewVisibilityDto {
  @ApiPropertyOptional({ description: 'Whether the review is visible' })
  @IsBoolean()
  is_visible: boolean;
}
