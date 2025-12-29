import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import {
  AdminUsersQueryDto,
  UpdateUserStatusDto,
  AdminLaundriesQueryDto,
  UpdateLaundryStatusDto,
} from './dto';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ==================== USERS (CUSTOMERS) ====================

  @Get('users')
  @ApiOperation({ summary: 'Get all customers with filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'ACTIVE', 'SUSPENDED', 'PENDING_LOCATION'] })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of customers' })
  async getUsers(@Query() query: AdminUsersQueryDto) {
    const data = await this.adminService.getUsers(query);
    return {
      success: true,
      data: { users: data.users },
      pagination: data.pagination,
    };
  }

  @Get('users/stats')
  @ApiOperation({ summary: 'Get customer statistics' })
  @ApiResponse({ status: 200, description: 'Customer stats' })
  async getUserStats() {
    const data = await this.adminService.getUserStats();
    return {
      success: true,
      data,
    };
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get customer details' })
  @ApiResponse({ status: 200, description: 'Customer details' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getUserById(@Param('id') id: string) {
    const data = await this.adminService.getUserById(id);
    return {
      success: true,
      data,
    };
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update customer status (suspend/activate)' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const data = await this.adminService.updateUserStatus(id, dto.status);
    return {
      success: true,
      message: `Customer ${dto.status === 'SUSPENDED' ? 'suspended' : 'activated'} successfully`,
      data,
    };
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete customer (soft delete)' })
  @ApiResponse({ status: 200, description: 'Customer deleted' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async deleteUser(@Param('id') id: string) {
    const data = await this.adminService.deleteUser(id);
    return {
      success: true,
      ...data,
    };
  }

  @Get('users/:id/orders')
  @ApiOperation({ summary: 'Get customer order history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Customer orders' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async getUserOrders(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const data = await this.adminService.getUserOrders(id, page, limit);
    return {
      success: true,
      data: { orders: data.orders },
      pagination: data.pagination,
    };
  }

  // ==================== LAUNDRIES ====================

  @Get('laundries')
  @ApiOperation({ summary: 'Get all laundries with filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'ACTIVE', 'SUSPENDED', 'PENDING_LOCATION'],
  })
  @ApiQuery({
    name: 'verified',
    required: false,
    enum: ['all', 'verified', 'unverified'],
  })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of laundries' })
  async getLaundries(@Query() query: AdminLaundriesQueryDto) {
    const data = await this.adminService.getLaundries(query);
    return {
      success: true,
      data: { laundries: data.laundries },
      pagination: data.pagination,
    };
  }

  @Get('laundries/stats')
  @ApiOperation({ summary: 'Get laundry statistics' })
  @ApiResponse({ status: 200, description: 'Laundry stats' })
  async getLaundryStats() {
    const data = await this.adminService.getLaundryStats();
    return {
      success: true,
      data,
    };
  }

  @Get('laundries/:id')
  @ApiOperation({ summary: 'Get laundry details' })
  @ApiResponse({ status: 200, description: 'Laundry details' })
  @ApiResponse({ status: 404, description: 'Laundry not found' })
  async getLaundryById(@Param('id') id: string) {
    const data = await this.adminService.getLaundryById(id);
    return {
      success: true,
      data,
    };
  }

  @Patch('laundries/:id/status')
  @ApiOperation({ summary: 'Update laundry status (suspend/activate)' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 404, description: 'Laundry not found' })
  async updateLaundryStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLaundryStatusDto,
  ) {
    const data = await this.adminService.updateLaundryStatus(id, dto.status);
    return {
      success: true,
      message: `Laundry ${dto.status === 'SUSPENDED' ? 'suspended' : 'activated'} successfully`,
      data,
    };
  }

  @Patch('laundries/:id/verify')
  @ApiOperation({ summary: 'Toggle laundry verification status' })
  @ApiResponse({ status: 200, description: 'Verification status toggled' })
  @ApiResponse({ status: 404, description: 'Laundry not found' })
  async verifyLaundry(@Param('id') id: string) {
    const data = await this.adminService.verifyLaundry(id);
    return {
      success: true,
      message: `Laundry ${data.is_verified ? 'verified' : 'unverified'} successfully`,
      data,
    };
  }

  @Patch('laundries/:id/activate')
  @ApiOperation({ summary: 'Activate pending laundry (approve new listing)' })
  @ApiResponse({ status: 200, description: 'Laundry activated and verified' })
  @ApiResponse({ status: 404, description: 'Laundry not found' })
  async activateLaundry(@Param('id') id: string) {
    const data = await this.adminService.activateLaundry(id);
    return {
      success: true,
      message: 'Laundry activated and verified successfully',
      data,
    };
  }

  @Delete('laundries/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete laundry (soft delete)' })
  @ApiResponse({ status: 200, description: 'Laundry deleted' })
  @ApiResponse({ status: 404, description: 'Laundry not found' })
  async deleteLaundry(@Param('id') id: string) {
    const data = await this.adminService.deleteLaundry(id);
    return {
      success: true,
      ...data,
    };
  }

  @Get('laundries/:id/orders')
  @ApiOperation({ summary: 'Get laundry order history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Laundry orders' })
  @ApiResponse({ status: 404, description: 'Laundry not found' })
  async getLaundryOrders(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const data = await this.adminService.getLaundryOrders(id, page, limit);
    return {
      success: true,
      data: { orders: data.orders },
      pagination: data.pagination,
    };
  }
}
