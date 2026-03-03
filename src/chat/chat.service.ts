import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { FirebaseService } from '@/firebase/firebase.service';
import { SendChatNotificationDto } from './dto/send-chat-notification.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async sendChatNotification(dto: SendChatNotificationDto) {
    const { recipientId, recipientRole, senderName, message, chatId } = dto;

    let fcmToken: string | null = null;

    if (recipientRole === 'CUSTOMER') {
      const user = await this.prisma.user.findUnique({
        where: { id: recipientId },
        select: { fcm_token: true },
      });
      fcmToken = user?.fcm_token ?? null;
    } else if (recipientRole === 'LAUNDRY') {
      const laundry = await this.prisma.laundry.findUnique({
        where: { id: recipientId },
        select: { fcm_token: true },
      });
      fcmToken = laundry?.fcm_token ?? null;
    }

    if (!fcmToken) {
      this.logger.warn(
        `No FCM token for ${recipientRole} ${recipientId}, skipping chat notification`,
      );
      return { sent: false, reason: 'No FCM token' };
    }

    const result = await this.firebaseService.sendPushNotification(
      fcmToken,
      `Message from ${senderName}`,
      message.length > 100 ? `${message.substring(0, 97)}...` : message,
      {
        type: 'CHAT_MESSAGE',
        chat_id: chatId,
        sender_name: senderName,
      },
    );

    if (result.success) {
      this.logger.log(`Chat notification sent to ${recipientRole} ${recipientId}`);
    } else {
      this.logger.warn(`Failed to send chat notification: ${result.error}`);

      // Clear invalid token
      if (result.error === 'Invalid or expired FCM token') {
        if (recipientRole === 'CUSTOMER') {
          await this.prisma.user.update({
            where: { id: recipientId },
            data: { fcm_token: null },
          });
        } else {
          await this.prisma.laundry.update({
            where: { id: recipientId },
            data: { fcm_token: null },
          });
        }
      }
    }

    return { sent: result.success };
  }
}
