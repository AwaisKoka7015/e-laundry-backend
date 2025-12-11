import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('laundries')
  @ApiOperation({ summary: 'Search nearby laundries' })
  @ApiQuery({ name: 'latitude', required: true, type: Number })
  @ApiQuery({ name: 'longitude', required: true, type: Number })
  @ApiQuery({ name: 'radius_km', required: false, type: Number })
  @ApiQuery({ name: 'category_id', required: false })
  @ApiQuery({ name: 'min_rating', required: false, type: Number })
  @ApiQuery({ name: 'sort_by', required: false, enum: ['distance', 'rating', 'orders'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchLaundries(
    @Query('latitude') latitude: number,
    @Query('longitude') longitude: number,
    @Query('radius_km') radiusKm?: number,
    @Query('category_id') categoryId?: string,
    @Query('min_rating') minRating?: number,
    @Query('sort_by') sortBy?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const data = await this.searchService.searchLaundries(
      +latitude,
      +longitude,
      radiusKm ? +radiusKm : 5,
      categoryId,
      minRating ? +minRating : undefined,
      sortBy || 'distance',
      page ? +page : 1,
      limit ? +limit : 10,
    );
    return {
      success: true,
      data: { laundries: data.laundries },
      pagination: data.pagination,
    };
  }
}
