import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

export interface CloudinaryUploadOptions {
  folder?: string;
  transformation?: object[];
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  format?: string;
  quality?: string | number;
}

/**
 * Upload image to Cloudinary from base64 string
 */
export async function uploadImage(
  base64Data: string,
  options: CloudinaryUploadOptions = {}
): Promise<UploadResult> {
  try {
    const {
      folder = 'e-laundry',
      transformation = [],
      resourceType = 'image',
      format = 'webp',
      quality = 'auto',
    } = options;

    // Default transformations for optimization
    const defaultTransformations = [
      { quality },
      { fetch_format: format },
    ];

    const result: UploadApiResponse = await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: resourceType,
      transformation: [...defaultTransformations, ...transformation],
    });

    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    const uploadError = error as UploadApiErrorResponse;
    return {
      success: false,
      error: uploadError.message || 'Failed to upload image',
    };
  }
}

/**
 * Upload user avatar with specific transformations
 */
export async function uploadAvatar(base64Data: string, userId: string): Promise<UploadResult> {
  return uploadImage(base64Data, {
    folder: 'e-laundry/avatars',
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
    ],
  });
}

/**
 * Upload laundry logo with specific transformations
 */
export async function uploadLaundryLogo(base64Data: string, laundryId: string): Promise<UploadResult> {
  return uploadImage(base64Data, {
    folder: 'e-laundry/laundry-logos',
    transformation: [
      { width: 500, height: 500, crop: 'fit' },
    ],
  });
}

/**
 * Delete image from Cloudinary
 */
export async function deleteImage(publicId: string): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error) {
    console.error('Failed to delete image:', error);
    return false;
  }
}

/**
 * Get optimized URL for an image
 */
export function getOptimizedUrl(publicId: string, options: { width?: number; height?: number } = {}): string {
  const { width = 400, height = 400 } = options;
  
  return cloudinary.url(publicId, {
    transformation: [
      { width, height, crop: 'fill' },
      { quality: 'auto' },
      { fetch_format: 'auto' },
    ],
  });
}

export default cloudinary;
