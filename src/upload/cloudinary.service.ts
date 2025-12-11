import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadImage(
    base64Image: string,
    folder: string,
    publicId?: string,
  ): Promise<UploadApiResponse> {
    try {
      // Ensure proper data URI format
      let imageData = base64Image;
      if (!imageData.startsWith('data:image/')) {
        imageData = `data:image/jpeg;base64,${imageData}`;
      }

      const result = await cloudinary.uploader.upload(imageData, {
        folder: `e-laundry/${folder}`,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      });

      return result;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new BadRequestException('Failed to upload image');
    }
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Cloudinary delete error:', error);
    }
  }

  getPublicIdFromUrl(url: string): string | null {
    try {
      const regex = /\/e-laundry\/([^/]+\/[^.]+)/;
      const match = url.match(regex);
      return match ? `e-laundry/${match[1]}` : null;
    } catch {
      return null;
    }
  }
}
