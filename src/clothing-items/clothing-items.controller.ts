import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ClothingItemsService } from './clothing-items.service';

@ApiTags('Clothing Items')
@Controller('clothing-items')
export class ClothingItemsController {
  constructor(private readonly clothingItemsService: ClothingItemsService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300000)
  @ApiOperation({ summary: 'List all clothing items' })
  @ApiQuery({ name: 'type', required: false, enum: ['MEN', 'WOMEN', 'KIDS', 'HOME'] })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of clothing items' })
  async findAll(@Query('type') type?: string, @Query('active') active?: string) {
    const isActive = active === undefined ? true : active === 'true';
    const data = await this.clothingItemsService.findAll(type, isActive);
    return {
      success: true,
      data,
    };
  }
}
