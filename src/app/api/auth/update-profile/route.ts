import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { updateUserProfileSchema, updateLaundryProfileSchema } from '@/types';

export async function PUT(request: NextRequest) {
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
    
    let updatedUser;
    
    if (role === 'CUSTOMER') {
      // Validate user profile update
      const validationResult = updateUserProfileSchema.safeParse(body);
      
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
      
      const updateData = validationResult.data;
      
      // Check if email is already taken (if updating email)
      if (updateData.email) {
        const existingEmail = await prisma.user.findFirst({
          where: {
            email: updateData.email,
            id: { not: id },
          },
        });
        
        if (existingEmail) {
          return NextResponse.json(
            {
              success: false,
              error: 'Email already in use',
              code: 'EMAIL_EXISTS',
            },
            { status: 400 }
          );
        }
      }
      
      updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...updateData,
          updated_at: new Date(),
        },
        select: {
          id: true,
          phone_number: true,
          name: true,
          email: true,
          avatar: true,
          gender: true,
          role: true,
          status: true,
          latitude: true,
          longitude: true,
          near_landmark: true,
          address_text: true,
          city: true,
          fcm_token: true,
          created_at: true,
          updated_at: true,
        },
      });
    } else {
      // Validate laundry profile update
      const validationResult = updateLaundryProfileSchema.safeParse(body);
      
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
      
      const updateData = validationResult.data;
      
      // Check if email is already taken (if updating email)
      if (updateData.email) {
        const existingEmail = await prisma.laundry.findFirst({
          where: {
            email: updateData.email,
            id: { not: id },
          },
        });
        
        if (existingEmail) {
          return NextResponse.json(
            {
              success: false,
              error: 'Email already in use',
              code: 'EMAIL_EXISTS',
            },
            { status: 400 }
          );
        }
      }
      
      updatedUser = await prisma.laundry.update({
        where: { id },
        data: {
          ...updateData,
          updated_at: new Date(),
        },
        select: {
          id: true,
          phone_number: true,
          laundry_name: true,
          email: true,
          laundry_logo: true,
          role: true,
          status: true,
          latitude: true,
          longitude: true,
          near_landmark: true,
          address_text: true,
          city: true,
          working_hours: true,
          description: true,
          rating: true,
          total_orders: true,
          total_reviews: true,
          services_count: true,
          is_verified: true,
          fcm_token: true,
          created_at: true,
          updated_at: true,
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser,
      },
    });
    
  } catch (error) {
    console.error('Update Profile Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update profile',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// Also support PATCH method
export async function PATCH(request: NextRequest) {
  return PUT(request);
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
