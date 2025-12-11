import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto, BulkPricingDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, Roles, RolesGuard } from '../common';

@Controller()
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  // ==================== LAUNDRY OWNER ENDPOINTS ====================

  @Get('laundry/services')
  @ApiTags('Laundry Services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get my services' })
  @ApiResponse({ status: 200, description: 'List of services' })
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    const data = await this.servicesService.findAll(user.sub);
    return { success: true, data };
  }

  @Post('laundry/services')
  @ApiTags('Laundry Services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create new service' })
  @ApiResponse({ status: 201, description: 'Service created' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateServiceDto,
  ) {
    const data = await this.servicesService.create(user.sub, dto);
    return {
      success: true,
      message: 'Service created successfully',
      data,
    };
  }

  @Get('laundry/services/:id')
  @ApiTags('Laundry Services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get service details' })
  @ApiResponse({ status: 200, description: 'Service details' })
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const data = await this.servicesService.findOne(user.sub, id);
    return { success: true, data };
  }

  @Put('laundry/services/:id')
  @ApiTags('Laundry Services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update service' })
  @ApiResponse({ status: 200, description: 'Service updated' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    const data = await this.servicesService.update(user.sub, id, dto);
    return {
      success: true,
      message: 'Service updated successfully',
      data,
    };
  }

  @Delete('laundry/services/:id')
  @ApiTags('Laundry Services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete service' })
  @ApiResponse({ status: 200, description: 'Service deleted' })
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const data = await this.servicesService.delete(user.sub, id);
    return { success: true, ...data };
  }

  @Get('laundry/services/:id/pricing')
  @ApiTags('Laundry Services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get service pricing' })
  @ApiResponse({ status: 200, description: 'Service pricing' })
  async getPricing(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const data = await this.servicesService.getPricing(user.sub, id);
    return { success: true, data };
  }

  @Post('laundry/services/:id/pricing')
  @ApiTags('Laundry Services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Set bulk pricing' })
  @ApiResponse({ status: 200, description: 'Pricing updated' })
  async setBulkPricing(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: BulkPricingDto,
  ) {
    const data = await this.servicesService.setBulkPricing(user.sub, id, dto);
    return { success: true, ...data };
  }

  // ==================== PUBLIC ENDPOINTS ====================

  @Get('laundries/:id/services')
  @ApiTags('Search')
  @ApiOperation({ summary: 'Get laundry services (public)' })
  @ApiResponse({ status: 200, description: 'Laundry services with pricing' })
  async getPublicServices(@Param('id') id: string) {
    const data = await this.servicesService.getPublicServices(id);
    return { success: true, data };
  }
}
