import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateTokenPair } from '@/lib/jwt';
import { selectRoleSchema } from '@/types';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = selectRoleSchema.safeParse(body);
    
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
    
    const { phone_number, role, temp_token } = validationResult.data;
    
    // Verify temp token if provided
    if (temp_token) {
      try {
        const decoded = jwt.verify(
          temp_token,
          process.env.JWT_ACCESS_SECRET || 'temp-secret'
        ) as { phone_number: string; type: string };
        
        if (decoded.phone_number !== phone_number || decoded.type !== 'temp') {
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid temporary token',
              code: 'INVALID_TOKEN',
            },
            { status: 401 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: 'Temporary token expired. Please verify OTP again.',
            code: 'TOKEN_EXPIRED',
          },
          { status: 401 }
        );
      }
    }
    
    // Check if temp account exists and is verified
    const tempAccount = await prisma.tempAccount.findUnique({
      where: { phone_number },
    });
    
    if (!tempAccount || !tempAccount.otp_verified) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please verify OTP first before selecting role',
          code: 'OTP_NOT_VERIFIED',
        },
        { status: 400 }
      );
    }
    
    // Check if user/laundry already exists
    const existingUser = await prisma.user.findUnique({ where: { phone_number } });
    const existingLaundry = await prisma.laundry.findUnique({ where: { phone_number } });
    
    if (existingUser || existingLaundry) {
      return NextResponse.json(
        {
          success: false,
          error: 'Account already exists with this phone number',
          code: 'ACCOUNT_EXISTS',
        },
        { status: 400 }
      );
    }
    
    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    const deviceInfo = body.device_info;
    
    let newAccount;
    let tokens;
    
    if (role === 'CUSTOMER') {
      // Create new user (customer)
      newAccount = await prisma.user.create({
        data: {
          phone_number,
          role: 'CUSTOMER',
          status: 'PENDING_LOCATION',
        },
      });
      
      // Generate tokens
      tokens = await generateTokenPair(
        {
          id: newAccount.id,
          phone_number: newAccount.phone_number,
          role: 'CUSTOMER',
        },
        deviceInfo,
        ipAddress
      );
    } else {
      // Create new laundry
      newAccount = await prisma.laundry.create({
        data: {
          phone_number,
          role: 'LAUNDRY',
          status: 'PENDING_LOCATION',
        },
      });
      
      // Generate tokens
      tokens = await generateTokenPair(
        {
          id: newAccount.id,
          phone_number: newAccount.phone_number,
          role: 'LAUNDRY',
        },
        deviceInfo,
        ipAddress
      );
    }
    
    // Delete temp account
    await prisma.tempAccount.delete({
      where: { phone_number },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Role selected successfully. Please update your location.',
      data: {
        requires_location: true,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        access_token_expires_at: tokens.accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: tokens.refreshTokenExpiresAt.toISOString(),
        user: newAccount,
      },
    });
    
  } catch (error) {
    console.error('Select Role Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to select role',
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
