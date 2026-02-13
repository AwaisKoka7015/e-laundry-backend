import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @ApiOperation({ summary: 'List all service categories' })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async findAll(@Query('active') active?: string) {
    const isActive = active === undefined ? true : active === 'true';
    const data = await this.categoriesService.findAll(isActive);
    return {
      success: true,
      data,
    };
  }
}
