import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-middleware';
import { revokeRefreshToken, revokeAllTokens } from '@/lib/jwt';
import { logoutSchema } from '@/types';

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
    
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional for logout
    }
    
    // Validate input
    const validationResult = logoutSchema.safeParse(body);
    const { refresh_token, logout_all_devices } = validationResult.success 
      ? validationResult.data 
      : { refresh_token: undefined, logout_all_devices: false };
    
    if (logout_all_devices) {
      // Revoke all refresh tokens for this user
      await revokeAllTokens(id, role);
      
      return NextResponse.json({
        success: true,
        message: 'Logged out from all devices successfully',
      });
    }
    
    if (refresh_token) {
      // Revoke specific refresh token
      await revokeRefreshToken(refresh_token);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
    
  } catch (error) {
    console.error('Logout Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to logout',
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
