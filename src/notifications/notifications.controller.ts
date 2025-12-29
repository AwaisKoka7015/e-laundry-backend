import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { MarkNotificationsReadDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload, PaginationQueryDto } from '../common';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get my notifications' })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  async getNotifications(
    @CurrentUser() user: CurrentUserPayload,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const data = await this.notificationsService.getNotifications(
      user.sub,
      user.role,
      pagination?.page,
      pagination?.limit,
    );
    return {
      success: true,
      data: {
        notifications: data.notifications,
        unread_count: data.unread_count,
      },
      pagination: data.pagination,
    };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiResponse({ status: 200, description: 'Notifications marked as read' })
  async markAsRead(@CurrentUser() user: CurrentUserPayload, @Body() dto: MarkNotificationsReadDto) {
    const data = await this.notificationsService.markAsRead(user.sub, user.role, dto);
    return { success: true, ...data };
  }

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark single notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markSingleAsRead(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const data = await this.notificationsService.markSingleAsRead(id, user.sub, user.role);
    return { success: true, ...data };
  }
}
