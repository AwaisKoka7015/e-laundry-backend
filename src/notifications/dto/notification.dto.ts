import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsArray, IsUUID } from 'class-validator';

export class MarkNotificationsReadDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  notification_ids?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  mark_all?: boolean = false;
}
