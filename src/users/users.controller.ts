import {
  Controller,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserProfileDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, Roles, RolesGuard } from '../common';

@ApiTags('Profile')
@Controller('auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Put('update-profile')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Update customer profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateUserProfileDto,
  ) {
    const data = await this.usersService.updateProfile(user.sub, dto);
    return {
      success: true,
      message: 'Profile updated successfully',
      data,
    };
  }
}
