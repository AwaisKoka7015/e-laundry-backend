import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import {
  AdminUsersQueryDto,
  UpdateUserStatusDto,
  AdminLaundriesQueryDto,
  UpdateLaundryStatusDto,
  AdminOrdersQueryDto,
  UpdateOrderStatusDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  ReorderCategoriesDto,
  ClothingItemsQueryDto,
  CreateClothingItemDto,
  UpdateClothingItemDto,
  AdminReviewsQueryDto,
  UpdateReviewVisibilityDto,
  AdminPromoCodesQueryDto,
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  PromoUsageQueryDto,
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
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['all', 'ACTIVE', 'SUSPENDED', 'PENDING_LOCATION'],
  })
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
  async updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
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
    console.log('AdminController -> getLaundries -> data', data);
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
  async updateLaundryStatus(@Param('id') id: string, @Body() dto: UpdateLaundryStatusDto) {
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

  // ==================== ORDERS ====================

  @Get('orders')
  @ApiOperation({ summary: 'Get all orders with filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'all',
      'PENDING',
      'ACCEPTED',
      'REJECTED',
      'PICKUP_SCHEDULED',
      'PICKED_UP',
      'PROCESSING',
      'READY',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
    ],
  })
  @ApiQuery({
    name: 'payment_status',
    required: false,
    enum: ['all', 'PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
  })
  @ApiQuery({ name: 'laundry_id', required: false, type: String })
  @ApiQuery({ name: 'customer_id', required: false, type: String })
  @ApiQuery({ name: 'date_from', required: false, type: String })
  @ApiQuery({ name: 'date_to', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of orders' })
  async getOrders(@Query() query: AdminOrdersQueryDto) {
    const data = await this.adminService.getOrders(query);
    return {
      success: true,
      data: { orders: data.orders },
      pagination: data.pagination,
    };
  }

  @Get('orders/stats')
  @ApiOperation({ summary: 'Get order statistics' })
  @ApiResponse({ status: 200, description: 'Order stats' })
  async getOrderStats() {
    const data = await this.adminService.getOrderStats();
    return {
      success: true,
      data,
    };
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order details' })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(@Param('id') id: string) {
    const data = await this.adminService.getOrderById(id);
    return {
      success: true,
      data,
    };
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const data = await this.adminService.updateOrderStatus(
      id,
      dto.status,
      dto.notes,
    );
    return {
      success: true,
      message: `Order status updated to ${dto.status}`,
      data,
    };
  }

  // ==================== CATEGORIES ====================

  @Get('categories')
  @ApiOperation({ summary: 'Get all service categories' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async getCategories() {
    const data = await this.adminService.getCategories();
    return {
      success: true,
      data,
    };
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Get category details' })
  @ApiResponse({ status: 200, description: 'Category details' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategoryById(@Param('id') id: string) {
    const data = await this.adminService.getCategoryById(id);
    return {
      success: true,
      data,
    };
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiResponse({ status: 409, description: 'Category name already exists' })
  async createCategory(@Body() dto: CreateCategoryDto) {
    const data = await this.adminService.createCategory(dto);
    return {
      success: true,
      message: 'Category created successfully',
      data,
    };
  }

  @Put('categories/:id')
  @ApiOperation({ summary: 'Update category' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category name already exists' })
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    const data = await this.adminService.updateCategory(id, dto);
    return {
      success: true,
      message: 'Category updated successfully',
      data,
    };
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete category' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category has services' })
  async deleteCategory(@Param('id') id: string) {
    const data = await this.adminService.deleteCategory(id);
    return {
      success: true,
      ...data,
    };
  }

  @Patch('categories/reorder')
  @ApiOperation({ summary: 'Reorder categories' })
  @ApiResponse({ status: 200, description: 'Categories reordered' })
  async reorderCategories(@Body() dto: ReorderCategoriesDto) {
    const data = await this.adminService.reorderCategories(dto);
    return {
      success: true,
      ...data,
    };
  }

  @Patch('categories/:id/toggle')
  @ApiOperation({ summary: 'Toggle category active status' })
  @ApiResponse({ status: 200, description: 'Category status toggled' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async toggleCategoryStatus(@Param('id') id: string) {
    const data = await this.adminService.toggleCategoryStatus(id);
    return {
      success: true,
      message: `Category ${data.is_active ? 'activated' : 'deactivated'} successfully`,
      data,
    };
  }

  // ==================== CLOTHING ITEMS ====================

  @Get('clothing-items')
  @ApiOperation({ summary: 'Get all clothing items with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: ['all', 'MEN', 'WOMEN', 'KIDS', 'HOME'] })
  @ApiResponse({ status: 200, description: 'List of clothing items' })
  async getClothingItems(@Query() query: ClothingItemsQueryDto) {
    const data = await this.adminService.getClothingItems(query);
    return {
      success: true,
      data: { items: data.items },
      pagination: data.pagination,
    };
  }

  @Get('clothing-items/stats')
  @ApiOperation({ summary: 'Get clothing items statistics' })
  @ApiResponse({ status: 200, description: 'Clothing items stats' })
  async getClothingItemStats() {
    const data = await this.adminService.getClothingItemStats();
    return {
      success: true,
      data,
    };
  }

  @Get('clothing-items/:id')
  @ApiOperation({ summary: 'Get clothing item details' })
  @ApiResponse({ status: 200, description: 'Clothing item details' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async getClothingItemById(@Param('id') id: string) {
    const data = await this.adminService.getClothingItemById(id);
    return {
      success: true,
      data,
    };
  }

  @Post('clothing-items')
  @ApiOperation({ summary: 'Create a new clothing item' })
  @ApiResponse({ status: 201, description: 'Item created' })
  @ApiResponse({ status: 409, description: 'Item already exists' })
  async createClothingItem(@Body() dto: CreateClothingItemDto) {
    const data = await this.adminService.createClothingItem(dto);
    return {
      success: true,
      message: 'Clothing item created successfully',
      data,
    };
  }

  @Put('clothing-items/:id')
  @ApiOperation({ summary: 'Update clothing item' })
  @ApiResponse({ status: 200, description: 'Item updated' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 409, description: 'Item name already exists' })
  async updateClothingItem(@Param('id') id: string, @Body() dto: UpdateClothingItemDto) {
    const data = await this.adminService.updateClothingItem(id, dto);
    return {
      success: true,
      message: 'Clothing item updated successfully',
      data,
    };
  }

  @Delete('clothing-items/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete clothing item' })
  @ApiResponse({ status: 200, description: 'Item deleted' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 409, description: 'Item in use' })
  async deleteClothingItem(@Param('id') id: string) {
    const data = await this.adminService.deleteClothingItem(id);
    return {
      success: true,
      ...data,
    };
  }

  @Patch('clothing-items/:id/toggle')
  @ApiOperation({ summary: 'Toggle clothing item active status' })
  @ApiResponse({ status: 200, description: 'Item status toggled' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async toggleClothingItemStatus(@Param('id') id: string) {
    const data = await this.adminService.toggleClothingItemStatus(id);
    return {
      success: true,
      message: `Item ${data.is_active ? 'activated' : 'deactivated'} successfully`,
      data,
    };
  }

  // ==================== REVIEWS ====================

  @Get('reviews')
  @ApiOperation({ summary: 'Get all reviews with filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'rating', required: false, enum: ['all', '5', '4', '3', '2', '1'] })
  @ApiQuery({ name: 'visibility', required: false, enum: ['all', 'visible', 'hidden'] })
  @ApiQuery({ name: 'reply_status', required: false, enum: ['all', 'replied', 'pending'] })
  @ApiQuery({ name: 'laundry_id', required: false, type: String })
  @ApiQuery({ name: 'customer_id', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of reviews' })
  async getReviews(@Query() query: AdminReviewsQueryDto) {
    const data = await this.adminService.getReviews(query);
    return {
      success: true,
      data: { reviews: data.reviews },
      pagination: data.pagination,
    };
  }

  @Get('reviews/stats')
  @ApiOperation({ summary: 'Get review statistics' })
  @ApiResponse({ status: 200, description: 'Review stats' })
  async getReviewStats() {
    const data = await this.adminService.getReviewStats();
    return {
      success: true,
      data,
    };
  }

  @Get('reviews/:id')
  @ApiOperation({ summary: 'Get review details' })
  @ApiResponse({ status: 200, description: 'Review details' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async getReviewById(@Param('id') id: string) {
    const data = await this.adminService.getReviewById(id);
    return {
      success: true,
      data,
    };
  }

  @Patch('reviews/:id/visibility')
  @ApiOperation({ summary: 'Update review visibility' })
  @ApiResponse({ status: 200, description: 'Visibility updated' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async updateReviewVisibility(
    @Param('id') id: string,
    @Body() dto: UpdateReviewVisibilityDto,
  ) {
    const data = await this.adminService.updateReviewVisibility(id, dto.is_visible);
    return {
      success: true,
      message: `Review ${dto.is_visible ? 'shown' : 'hidden'} successfully`,
      data,
    };
  }

  @Delete('reviews/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete review' })
  @ApiResponse({ status: 200, description: 'Review deleted' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async deleteReview(@Param('id') id: string) {
    const data = await this.adminService.deleteReview(id);
    return {
      success: true,
      ...data,
    };
  }

  // ==================== PROMO CODES ====================

  @Get('promo-codes')
  @ApiOperation({ summary: 'Get all promo codes with filters and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['all', 'active', 'inactive', 'expired', 'used_up'] })
  @ApiQuery({ name: 'type', required: false, enum: ['all', 'PERCENTAGE', 'FIXED'] })
  @ApiResponse({ status: 200, description: 'List of promo codes' })
  async getPromoCodes(@Query() query: AdminPromoCodesQueryDto) {
    const result = await this.adminService.getPromoCodes(query);
    return {
      success: true,
      ...result,
    };
  }

  @Get('promo-codes/stats')
  @ApiOperation({ summary: 'Get promo codes statistics' })
  @ApiResponse({ status: 200, description: 'Promo codes stats' })
  async getPromoCodeStats() {
    const data = await this.adminService.getPromoCodeStats();
    return {
      success: true,
      data,
    };
  }

  @Get('promo-codes/:id')
  @ApiOperation({ summary: 'Get promo code details' })
  @ApiResponse({ status: 200, description: 'Promo code details' })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  async getPromoCodeById(@Param('id') id: string) {
    const data = await this.adminService.getPromoCodeById(id);
    return {
      success: true,
      data,
    };
  }

  @Get('promo-codes/:id/usage')
  @ApiOperation({ summary: 'Get promo code usage history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Promo code usage history' })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  async getPromoCodeUsage(@Param('id') id: string, @Query() query: PromoUsageQueryDto) {
    const data = await this.adminService.getPromoCodeUsage(id, query);
    return {
      success: true,
      ...data,
    };
  }

  @Post('promo-codes')
  @ApiOperation({ summary: 'Create a new promo code' })
  @ApiResponse({ status: 201, description: 'Promo code created' })
  @ApiResponse({ status: 409, description: 'Promo code already exists' })
  async createPromoCode(@Body() dto: CreatePromoCodeDto) {
    const data = await this.adminService.createPromoCode(dto);
    return {
      success: true,
      message: 'Promo code created successfully',
      data,
    };
  }

  @Put('promo-codes/:id')
  @ApiOperation({ summary: 'Update promo code' })
  @ApiResponse({ status: 200, description: 'Promo code updated' })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  @ApiResponse({ status: 409, description: 'Promo code already exists' })
  async updatePromoCode(@Param('id') id: string, @Body() dto: UpdatePromoCodeDto) {
    const data = await this.adminService.updatePromoCode(id, dto);
    return {
      success: true,
      message: 'Promo code updated successfully',
      data,
    };
  }

  @Delete('promo-codes/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete promo code' })
  @ApiResponse({ status: 200, description: 'Promo code deleted' })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  @ApiResponse({ status: 409, description: 'Promo code has been used' })
  async deletePromoCode(@Param('id') id: string) {
    const data = await this.adminService.deletePromoCode(id);
    return {
      success: true,
      ...data,
    };
  }

  @Patch('promo-codes/:id/toggle')
  @ApiOperation({ summary: 'Toggle promo code active status' })
  @ApiResponse({ status: 200, description: 'Promo code status toggled' })
  @ApiResponse({ status: 404, description: 'Promo code not found' })
  async togglePromoCodeStatus(@Param('id') id: string) {
    const data = await this.adminService.togglePromoCodeStatus(id);
    return {
      success: true,
      message: `Promo code ${data.is_active ? 'activated' : 'deactivated'} successfully`,
      data,
    };
  }
}
