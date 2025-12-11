import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, Roles, RolesGuard } from '../common';

@ApiTags('Dashboard')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('customer/dashboard')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Get customer dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getCustomerDashboard(@CurrentUser() user: CurrentUserPayload) {
    const data = await this.dashboardService.getCustomerDashboard(user.sub);
    return { success: true, data };
  }

  @Get('laundry/dashboard')
  @Roles('LAUNDRY')
  @ApiOperation({ summary: 'Get laundry dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getLaundryDashboard(@CurrentUser() user: CurrentUserPayload) {
    const data = await this.dashboardService.getLaundryDashboard(user.sub);
    return { success: true, data };
  }
}
