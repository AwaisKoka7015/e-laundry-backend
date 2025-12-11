import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { updateLocationSchema } from '@/types';

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
    const validationResult = updateLocationSchema.safeParse(body);
    
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
    
    const { latitude, longitude, city, address_text, near_landmark } = validationResult.data;
    
    let updatedAccount;
    
    if (role === 'CUSTOMER') {
      // Update user location
      updatedAccount = await prisma.user.update({
        where: { id },
        data: {
          latitude,
          longitude,
          city,
          address_text,
          near_landmark,
          status: 'ACTIVE',
          updated_at: new Date(),
        },
      });
    } else {
      // Update laundry location
      updatedAccount = await prisma.laundry.update({
        where: { id },
        data: {
          latitude,
          longitude,
          city,
          address_text,
          near_landmark,
          status: 'ACTIVE',
          updated_at: new Date(),
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Location updated successfully. Registration complete!',
      data: {
        user: updatedAccount,
      },
    });
    
  } catch (error) {
    console.error('Update Location Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update location',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// Also support PUT method
export async function PUT(request: NextRequest) {
  return POST(request);
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
