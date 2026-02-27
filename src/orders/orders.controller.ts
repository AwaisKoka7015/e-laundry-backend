import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto, CancelOrderDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, Roles, RolesGuard, PaginationQueryDto } from '../common';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ==================== CUSTOMER ENDPOINTS ====================

  @Get('orders')
  @ApiTags('Orders - Customer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List my orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200, description: 'List of orders' })
  async getCustomerOrders(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const data = await this.ordersService.getCustomerOrders(
      user.sub,
      status,
      pagination?.page,
      pagination?.limit,
    );
    return {
      success: true,
      data: { orders: data.orders },
      pagination: data.pagination,
    };
  }

  @Post('checkout')
  @ApiTags('Orders - Customer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Place new order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  async createOrder(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateOrderDto) {
    const data = await this.ordersService.createOrder(user.sub, dto);
    return {
      success: true,
      message: 'Order placed successfully',
      data,
    };
  }

  @Get('orders/:id')
  @ApiTags('Orders - Customer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get order details' })
  @ApiResponse({ status: 200, description: 'Order details' })
  async getOrderDetails(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const data = await this.ordersService.getOrderDetails(id, user.sub, user.role);
    return { success: true, data };
  }

  @Post('orders/:id/cancel')
  @ApiTags('Orders - Customer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  async cancelOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    const data = await this.ordersService.cancelOrder(id, user.sub, dto);
    return { success: true, ...data };
  }

  @Post('orders/:id/confirm-delivery')
  @ApiTags('Orders - Customer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm order delivery' })
  @ApiResponse({ status: 200, description: 'Delivery confirmed' })
  @ApiResponse({ status: 400, description: 'Order not in OUT_FOR_DELIVERY status' })
  async confirmDelivery(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const data = await this.ordersService.confirmDelivery(id, user.sub);
    return {
      success: true,
      message: 'Delivery confirmed successfully',
      data,
    };
  }

  @Get('orders/:id/timeline')
  @ApiTags('Orders - Customer')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get order timeline' })
  @ApiResponse({ status: 200, description: 'Order timeline' })
  async getOrderTimeline(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const data = await this.ordersService.getOrderTimeline(id, user.sub, user.role);
    return { success: true, data };
  }

  // ==================== LAUNDRY ENDPOINTS ====================

  @Get('laundry/orders')
  @ApiTags('Orders - Laundry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List incoming orders' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status or "active"' })
  @ApiResponse({ status: 200, description: 'List of orders' })
  async getLaundryOrders(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const data = await this.ordersService.getLaundryOrders(
      user.sub,
      status,
      pagination?.page,
      pagination?.limit,
    );
    return {
      success: true,
      data: { orders: data.orders },
      pagination: data.pagination,
    };
  }

  @Get('laundry/orders/:id')
  @ApiTags('Orders - Laundry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get order details' })
  @ApiResponse({ status: 200, description: 'Order details with customer info' })
  async getLaundryOrderDetails(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const data = await this.ordersService.getOrderDetails(id, user.sub, user.role);
    return { success: true, data };
  }

  @Put('laundry/orders/:id')
  @ApiTags('Orders - Laundry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update order status',
    description: `
Update the order status through the workflow.

**Status Flow:**
\`\`\`
PENDING → ACCEPTED/REJECTED
ACCEPTED → PICKUP_SCHEDULED
PICKUP_SCHEDULED → PICKED_UP
PICKED_UP → PROCESSING
PROCESSING → READY
READY → OUT_FOR_DELIVERY
OUT_FOR_DELIVERY → DELIVERED
DELIVERED → COMPLETED
\`\`\`

**Push Notification:**
A push notification is automatically sent to the customer when status changes.

**Special Cases:**
- \`REJECTED\`: Requires \`rejection_reason\` field
- \`COMPLETED\`: Automatically marks payment as completed
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Status updated and customer notified',
    schema: {
      example: {
        success: true,
        message: 'Order status updated successfully',
        data: { order: { id: 'uuid', status: 'ACCEPTED' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrderStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const data = await this.ordersService.updateOrderStatus(id, user.sub, dto);
    return {
      success: true,
      message: 'Order status updated successfully',
      data,
    };
  }
}
