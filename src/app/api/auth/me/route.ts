import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
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
    
    let user;
    
    if (role === 'CUSTOMER') {
      user = await prisma.user.findUnique({
        where: { id },
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
          last_login: true,
        },
      });
    } else {
      user = await prisma.laundry.findUnique({
        where: { id },
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
          last_login: true,
        },
      });
    }
    
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        user,
      },
    });
    
  } catch (error) {
    console.error('Get Me Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get user profile',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
