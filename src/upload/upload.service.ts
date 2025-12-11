import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UploadService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(
    userId: string,
    role: string,
    image: string,
    type: 'avatar' | 'laundry_logo' | 'review',
  ) {
    // Validate image
    if (!image.startsWith('data:image/')) {
      throw new BadRequestException('Invalid image format. Must be base64 encoded.');
    }

    // Configure upload options based on type
    const folder = `e-laundry/${type}s`;
    const transformation = type === 'review' 
      ? [{ width: 800, height: 800, crop: 'limit' }]
      : [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }];

    try {
      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(image, {
        folder,
        transformation,
        resource_type: 'image',
      });

      const imageUrl = result.secure_url;

      // Update user/laundry profile if it's avatar or logo
      if (type === 'avatar' && role === 'CUSTOMER') {
        await this.prisma.user.update({
          where: { id: userId },
          data: { avatar: imageUrl },
        });
      } else if (type === 'laundry_logo' && role === 'LAUNDRY') {
        await this.prisma.laundry.update({
          where: { id: userId },
          data: { laundry_logo: imageUrl },
        });
      }

      return {
        url: imageUrl,
        public_id: result.public_id,
        type,
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new BadRequestException('Failed to upload image');
    }
  }

  async deleteImage(publicId: string) {
    try {
      await cloudinary.uploader.destroy(publicId);
      return { success: true };
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new BadRequestException('Failed to delete image');
    }
  }
}
