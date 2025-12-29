import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { UploadImageDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser, CurrentUserPayload } from '../common';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload image (avatar, logo, or review)' })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid image' })
  async uploadImage(@CurrentUser() user: CurrentUserPayload, @Body() dto: UploadImageDto) {
    const data = await this.uploadService.uploadImage(user.sub, user.role, dto.image, dto.type);
    return {
      success: true,
      message: 'Image uploaded successfully',
      data,
    };
  }
}
