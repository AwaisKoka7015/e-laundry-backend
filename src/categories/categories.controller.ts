import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List all service categories' })
  @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filter by active status' })
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
