import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, Matches } from 'class-validator';

export enum ImageType {
  AVATAR = 'avatar',
  LAUNDRY_LOGO = 'laundry_logo',
  REVIEW = 'review',
}

export class UploadImageDto {
  @ApiProperty({
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
    description: 'Base64 encoded image',
  })
  @IsString()
  @Matches(/^data:image\/(jpeg|jpg|png|gif|webp);base64,|^[A-Za-z0-9+/]+=*$/, {
    message: 'Invalid base64 image format',
  })
  image: string;

  @ApiProperty({ enum: ImageType, example: 'avatar' })
  @IsEnum(ImageType)
  type: ImageType;
}
