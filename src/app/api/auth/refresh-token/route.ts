import { NextRequest, NextResponse } from 'next/server';
import { refreshTokenPair } from '@/lib/jwt';
import { refreshTokenSchema } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = refreshTokenSchema.safeParse(body);
    
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
    
    const { refresh_token, device_info } = validationResult.data;
    
    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    
    // Refresh tokens
    const tokens = await refreshTokenPair(refresh_token, device_info, ipAddress);
    
    if (!tokens) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired refresh token. Please login again.',
          code: 'INVALID_REFRESH_TOKEN',
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        access_token_expires_at: tokens.accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: tokens.refreshTokenExpiresAt.toISOString(),
      },
    });
    
  } catch (error) {
    console.error('Refresh Token Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh tokens',
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
