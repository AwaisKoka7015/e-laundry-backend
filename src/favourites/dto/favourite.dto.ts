import { IsEnum, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum FavouriteSortBy {
  MOST_ORDERED = 'most_ordered',
  TOP_RATED = 'top_rated',
  NEAREST = 'nearest',
}

export class ListFavouritesQueryDto {
  @ApiPropertyOptional({ enum: FavouriteSortBy, default: FavouriteSortBy.MOST_ORDERED })
  @IsOptional()
  @IsEnum(FavouriteSortBy)
  sort?: FavouriteSortBy = FavouriteSortBy.MOST_ORDERED;

  @ApiPropertyOptional({ description: 'User latitude for distance sorting' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  user_lat?: number;

  @ApiPropertyOptional({ description: 'User longitude for distance sorting' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  user_lng?: number;
}
