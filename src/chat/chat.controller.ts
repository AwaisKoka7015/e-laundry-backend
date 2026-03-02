import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards';
import { ChatService } from './chat.service';
import { SendChatNotificationDto } from './dto/send-chat-notification.dto';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('notify')
  @ApiOperation({ summary: 'Send push notification for a chat message' })
  async sendChatNotification(@Body() dto: SendChatNotificationDto) {
    const result = await this.chatService.sendChatNotification(dto);
    return result;
  }
}
