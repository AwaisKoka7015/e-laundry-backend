import {
  Controller,
  Get,
  Put,
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
import { LaundriesService } from './laundries.service';
import { UpdateLaundryProfileDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, Roles, RolesGuard } from '../common';

@ApiTags('Profile')
@Controller()
export class LaundriesController {
  constructor(private readonly laundriesService: LaundriesService) {}

  @Put('auth/update-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('LAUNDRY')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update laundry profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateLaundryProfileDto,
  ) {
    const data = await this.laundriesService.updateProfile(user.sub, dto);
    return {
      success: true,
      message: 'Profile updated successfully',
      data,
    };
  }

  @Get('laundries/:id')
  @ApiTags('Search')
  @ApiOperation({ summary: 'Get laundry details (public)' })
  @ApiResponse({ status: 200, description: 'Laundry details' })
  @ApiResponse({ status: 404, description: 'Laundry not found' })
  async getLaundryDetails(@Param('id') id: string) {
    const laundry = await this.laundriesService.getPublicProfile(id);
    return {
      success: true,
      data: { laundry },
    };
  }
}
