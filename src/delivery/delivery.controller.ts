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
import { DeliveryService } from './delivery.service';
import {
  UpdateAvailabilityDto,
  UpdateLocationDto,
  AcceptAssignmentDto,
  RejectAssignmentDto,
  UpdatePickupStatusDto,
  UpdateDeliveryStatusDto,
  UploadProofDto,
  AssignDeliveryPartnerDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, Roles, RolesGuard, PaginationQueryDto } from '../common';

/**
 * Delivery Partner Module
 *
 * NOTE: This module is prepared for future use. Currently, laundries handle
 * their own pickup and delivery. This module will be activated when delivery
 * partner functionality is enabled.
 */
@Controller()
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  // ==================== DELIVERY PARTNER ENDPOINTS ====================

  @Get('delivery/profile')
  @ApiTags('Delivery Partner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get delivery partner profile' })
  @ApiResponse({ status: 200, description: 'Profile details' })
  async getProfile(@CurrentUser() user: CurrentUserPayload) {
    const data = await this.deliveryService.getProfile(user.sub);
    return { success: true, data };
  }

  @Put('delivery/availability')
  @ApiTags('Delivery Partner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update availability status' })
  @ApiResponse({ status: 200, description: 'Availability updated' })
  async updateAvailability(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    const data = await this.deliveryService.updateAvailability(user.sub, dto);
    return { success: true, message: 'Availability updated', data };
  }

  @Put('delivery/location')
  @ApiTags('Delivery Partner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update current location' })
  @ApiResponse({ status: 200, description: 'Location updated' })
  async updateLocation(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateLocationDto) {
    const data = await this.deliveryService.updateLocation(user.sub, dto);
    return { success: true, message: 'Location updated', data };
  }

  @Get('delivery/stats')
  @ApiTags('Delivery Partner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get delivery statistics' })
  @ApiResponse({ status: 200, description: 'Statistics' })
  async getStats(@CurrentUser() user: CurrentUserPayload) {
    const data = await this.deliveryService.getStats(user.sub);
    return { success: true, data };
  }

  @Get('delivery/earnings')
  @ApiTags('Delivery Partner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get earnings history' })
  @ApiQuery({ name: 'start_date', required: false })
  @ApiQuery({ name: 'end_date', required: false })
  @ApiResponse({ status: 200, description: 'Earnings list' })
  async getEarnings(
    @CurrentUser() user: CurrentUserPayload,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const data = await this.deliveryService.getEarnings(
      user.sub,
      startDate,
      endDate,
      pagination?.page,
      pagination?.limit,
    );
    return { success: true, data };
  }

  // ==================== ASSIGNMENT ENDPOINTS ====================

  @Get('delivery/assignments')
  @ApiTags('Delivery Partner - Assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List my assignments' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter: active, pending, completed' })
  @ApiResponse({ status: 200, description: 'List of assignments' })
  async getAssignments(
    @CurrentUser() user: CurrentUserPayload,
    @Query('status') status?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const data = await this.deliveryService.getAssignments(
      user.sub,
      status,
      pagination?.page,
      pagination?.limit,
    );
    return {
      success: true,
      data: { assignments: data.assignments },
      pagination: data.pagination,
    };
  }

  @Get('delivery/assignments/:id')
  @ApiTags('Delivery Partner - Assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get assignment details' })
  @ApiResponse({ status: 200, description: 'Assignment details' })
  async getAssignmentDetails(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const data = await this.deliveryService.getAssignmentDetails(user.sub, id);
    return { success: true, data };
  }

  @Post('delivery/assignments/:id/accept')
  @ApiTags('Delivery Partner - Assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an assignment' })
  @ApiResponse({ status: 200, description: 'Assignment accepted' })
  async acceptAssignment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: AcceptAssignmentDto,
  ) {
    const data = await this.deliveryService.acceptAssignment(user.sub, id, dto);
    return { success: true, message: 'Assignment accepted', data };
  }

  @Post('delivery/assignments/:id/reject')
  @ApiTags('Delivery Partner - Assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject an assignment' })
  @ApiResponse({ status: 200, description: 'Assignment rejected' })
  async rejectAssignment(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: RejectAssignmentDto,
  ) {
    const data = await this.deliveryService.rejectAssignment(user.sub, id, dto);
    return { success: true, ...data };
  }

  // ==================== PICKUP ENDPOINTS ====================

  @Put('delivery/assignments/:id/pickup/status')
  @ApiTags('Delivery Partner - Pickup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update pickup status',
    description: `
Update the pickup status through the workflow.

**Status Flow:**
\`\`\`
PENDING → ACCEPTED → EN_ROUTE → ARRIVED → COMPLETED
            ↓
         REJECTED
\`\`\`
    `,
  })
  @ApiResponse({ status: 200, description: 'Pickup status updated' })
  async updatePickupStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePickupStatusDto,
  ) {
    const data = await this.deliveryService.updatePickupStatus(user.sub, id, dto);
    return { success: true, message: 'Pickup status updated', data };
  }

  @Post('delivery/assignments/:id/pickup/proof')
  @ApiTags('Delivery Partner - Pickup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Upload pickup proof image' })
  @ApiResponse({ status: 201, description: 'Proof uploaded' })
  async uploadPickupProof(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UploadProofDto,
  ) {
    const data = await this.deliveryService.uploadPickupProof(user.sub, id, dto);
    return { success: true, ...data };
  }

  // ==================== DELIVERY ENDPOINTS ====================

  @Put('delivery/assignments/:id/delivery/status')
  @ApiTags('Delivery Partner - Delivery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update delivery status',
    description: `
Update the delivery status through the workflow.

**Status Flow:**
\`\`\`
PENDING → ACCEPTED → EN_ROUTE → ARRIVED → COMPLETED
            ↓
         REJECTED
\`\`\`
    `,
  })
  @ApiResponse({ status: 200, description: 'Delivery status updated' })
  async updateDeliveryStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    const data = await this.deliveryService.updateDeliveryStatus(user.sub, id, dto);
    return { success: true, message: 'Delivery status updated', data };
  }

  @Post('delivery/assignments/:id/delivery/proof')
  @ApiTags('Delivery Partner - Delivery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DELIVERY_PARTNER')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Upload delivery proof image' })
  @ApiResponse({ status: 201, description: 'Proof uploaded' })
  async uploadDeliveryProof(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UploadProofDto,
  ) {
    const data = await this.deliveryService.uploadDeliveryProof(user.sub, id, dto);
    return { success: true, ...data };
  }

  // ==================== LAUNDRY/ADMIN ENDPOINTS ====================

  @Get('laundry/delivery-partners')
  @ApiTags('Delivery Partner - Admin/Laundry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get available delivery partners' })
  @ApiQuery({ name: 'city', required: false })
  @ApiResponse({ status: 200, description: 'List of available partners' })
  async getAvailablePartners(
    @Query('city') city?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const data = await this.deliveryService.getAvailablePartners(
      city,
      pagination?.page,
      pagination?.limit,
    );
    return {
      success: true,
      data: { partners: data.partners },
      pagination: data.pagination,
    };
  }

  @Post('laundry/orders/:orderId/assign-delivery')
  @ApiTags('Delivery Partner - Admin/Laundry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Assign a delivery partner to an order' })
  @ApiResponse({ status: 201, description: 'Delivery partner assigned' })
  async assignDeliveryPartner(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orderId') orderId: string,
    @Body() dto: AssignDeliveryPartnerDto,
  ) {
    const data = await this.deliveryService.assignDeliveryPartner(orderId, dto, user.sub);
    return { success: true, message: 'Delivery partner assigned', data };
  }
}
