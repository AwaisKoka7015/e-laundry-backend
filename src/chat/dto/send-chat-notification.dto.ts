import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendChatNotificationDto {
  @ApiProperty({ description: 'Recipient user/laundry ID' })
  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @ApiProperty({ description: 'Recipient role', enum: ['CUSTOMER', 'LAUNDRY'] })
  @IsString()
  @IsIn(['CUSTOMER', 'LAUNDRY'])
  recipientRole: 'CUSTOMER' | 'LAUNDRY';

  @ApiProperty({ description: 'Sender display name' })
  @IsString()
  @IsNotEmpty()
  senderName: string;

  @ApiProperty({ description: 'Message text preview' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ description: 'Firestore chat document ID' })
  @IsString()
  @IsNotEmpty()
  chatId: string;
}
