import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { uploadAvatar, uploadLaundryLogo, deleteImage } from '@/lib/cloudinary';
import { uploadImageSchema } from '@/types';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
        { status: authResult.status || 401 }
      );
    }
    
    const { id, role } = authResult.user;
    
    const body = await request.json();
    
    // Validate input
    const validationResult = uploadImageSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }
    
    const { image, type } = validationResult.data;
    
    // Validate image type against role
    if (type === 'laundry_logo' && role !== 'LAUNDRY') {
      return NextResponse.json(
        {
          success: false,
          error: 'Only laundry accounts can upload laundry logos',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }
    
    let uploadResult;
    let previousImageUrl: string | null = null;
    
    // Get current image URL for deletion
    if (role === 'CUSTOMER' && type === 'avatar') {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { avatar: true },
      });
      previousImageUrl = user?.avatar || null;
    } else if (role === 'LAUNDRY') {
      const laundry = await prisma.laundry.findUnique({
        where: { id },
        select: { 
          laundry_logo: type === 'laundry_logo' ? true : false 
        },
      });
      if (type === 'laundry_logo') {
        previousImageUrl = laundry?.laundry_logo || null;
      }
    }
    
    // Upload new image
    if (type === 'avatar') {
      uploadResult = await uploadAvatar(image, id);
    } else {
      uploadResult = await uploadLaundryLogo(image, id);
    }
    
    if (!uploadResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: uploadResult.error || 'Failed to upload image',
          code: 'UPLOAD_FAILED',
        },
        { status: 500 }
      );
    }
    
    // Update user/laundry with new image URL
    if (role === 'CUSTOMER' && type === 'avatar') {
      await prisma.user.update({
        where: { id },
        data: { avatar: uploadResult.url },
      });
    } else if (role === 'LAUNDRY' && type === 'laundry_logo') {
      await prisma.laundry.update({
        where: { id },
        data: { laundry_logo: uploadResult.url },
      });
    }
    
    // Delete previous image from Cloudinary (if exists)
    if (previousImageUrl) {
      // Extract public_id from URL
      const publicIdMatch = previousImageUrl.match(/\/e-laundry\/[^/]+\/([^.]+)/);
      if (publicIdMatch) {
        await deleteImage(`e-laundry/${type === 'avatar' ? 'avatars' : 'laundry-logos'}/${publicIdMatch[1]}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: uploadResult.url,
        public_id: uploadResult.publicId,
      },
    });
    
  } catch (error) {
    console.error('Upload Image Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload image',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
