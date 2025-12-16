import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../prisma/prisma.service';

export type UploadFolder =
  | 'avatars'
  | 'laundry_logos'
  | 'shop_images'
  | 'reviews'
  | 'cnic'
  | 'general';

export interface UploadOptions {
  width?: number;
  height?: number;
  crop?: string;
  gravity?: string;
}

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

  // ===== GENERIC UPLOAD METHOD =====
  async uploadToFolder(
    folderName: UploadFolder,
    image: string,
    options?: UploadOptions,
  ): Promise<{ url: string; public_id: string }> {
    // Validate image
    if (!image.startsWith('data:image/')) {
      throw new BadRequestException(
        'Invalid image format. Must be base64 encoded.',
      );
    }

    // Default transformations based on folder
    const defaultOptions = this.getDefaultOptions(folderName);
    const transformation = [{ ...defaultOptions, ...options }];

    try {
      const result = await cloudinary.uploader.upload(image, {
        folder: `e-laundry/${folderName}`,
        transformation,
        resource_type: 'image',
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new BadRequestException('Failed to upload image');
    }
  }

  // ===== BULK UPLOAD METHOD =====
  async uploadMultipleToFolder(
    folderName: UploadFolder,
    images: string[],
    options?: UploadOptions,
  ): Promise<{ urls: string[]; public_ids: string[] }> {
    const results = await Promise.all(
      images.map((image) => this.uploadToFolder(folderName, image, options)),
    );

    return {
      urls: results.map((r) => r.url),
      public_ids: results.map((r) => r.public_id),
    };
  }

  // ===== LEGACY METHOD (for backward compatibility) =====
  async uploadImage(
    userId: string,
    role: string,
    image: string,
    type: 'avatar' | 'laundry_logo' | 'review',
  ) {
    const folderMap: Record<string, UploadFolder> = {
      avatar: 'avatars',
      laundry_logo: 'laundry_logos',
      review: 'reviews',
    };

    const result = await this.uploadToFolder(folderMap[type], image);

    // Update user/laundry profile if it's avatar or logo
    if (type === 'avatar' && role === 'CUSTOMER') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatar: result.url },
      });
    } else if (type === 'laundry_logo' && role === 'LAUNDRY') {
      await this.prisma.laundry.update({
        where: { id: userId },
        data: { laundry_logo: result.url },
      });
    }

    return {
      url: result.url,
      public_id: result.public_id,
      type,
    };
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

  async deleteMultipleImages(publicIds: string[]) {
    try {
      await cloudinary.api.delete_resources(publicIds);
      return { success: true, deleted: publicIds.length };
    } catch (error) {
      console.error('Cloudinary bulk delete error:', error);
      throw new BadRequestException('Failed to delete images');
    }
  }

  private getDefaultOptions(folderName: UploadFolder): UploadOptions {
    const defaults: Record<UploadFolder, UploadOptions> = {
      avatars: { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      laundry_logos: { width: 400, height: 400, crop: 'fill' },
      shop_images: { width: 800, height: 600, crop: 'limit' },
      reviews: { width: 800, height: 800, crop: 'limit' },
      cnic: { width: 1200, height: 800, crop: 'limit' },
      general: { width: 1000, height: 1000, crop: 'limit' },
    };

    return defaults[folderName] || defaults.general;
  }
}
