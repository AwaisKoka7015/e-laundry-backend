import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { generateTokenPair } from '@/lib/jwt';
import { verifyOtpSchema } from '@/types';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = verifyOtpSchema.safeParse(body);
    
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
    
    const { phone_number, otp, device_info } = validationResult.data;
    
    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    
    // Find temp account
    const tempAccount = await prisma.tempAccount.findUnique({
      where: { phone_number },
    });
    
    if (!tempAccount) {
      return NextResponse.json(
        {
          success: false,
          error: 'No OTP request found for this phone number. Please request OTP first.',
          code: 'OTP_NOT_FOUND',
        },
        { status: 400 }
      );
    }
    
    // Check if OTP is expired
    if (new Date() > tempAccount.expires_at) {
      return NextResponse.json(
        {
          success: false,
          error: 'OTP has expired. Please request a new OTP.',
          code: 'OTP_EXPIRED',
        },
        { status: 400 }
      );
    }
    
    // Verify OTP
    if (tempAccount.otp_code !== otp) {
      // Log failed attempt
      await prisma.otpLog.updateMany({
        where: {
          phone_number,
          is_verified: false,
        },
        data: {
          attempts: { increment: 1 },
        },
      });
      
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid OTP. Please try again.',
          code: 'INVALID_OTP',
        },
        { status: 400 }
      );
    }
    
    // Mark OTP as verified
    await prisma.tempAccount.update({
      where: { phone_number },
      data: { otp_verified: true },
    });
    
    // Update OTP log
    await prisma.otpLog.updateMany({
      where: {
        phone_number,
        is_verified: false,
      },
      data: {
        is_verified: true,
        verified_at: new Date(),
      },
    });
    
    // Check if user already exists as Customer
    const existingUser = await prisma.user.findUnique({
      where: { phone_number },
    });
    
    if (existingUser) {
      // Update last login
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { last_login: new Date() },
      });
      
      // Generate tokens for existing user
      const tokens = await generateTokenPair(
        {
          id: existingUser.id,
          phone_number: existingUser.phone_number,
          role: 'CUSTOMER',
        },
        device_info,
        ipAddress
      );
      
      // Delete temp account
      await prisma.tempAccount.delete({
        where: { phone_number },
      });
      
      return NextResponse.json({
        success: true,
        message: 'Login successful',
        data: {
          is_new_user: false,
          requires_role_selection: false,
          requires_location: existingUser.status === 'PENDING_LOCATION',
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          access_token_expires_at: tokens.accessTokenExpiresAt.toISOString(),
          refresh_token_expires_at: tokens.refreshTokenExpiresAt.toISOString(),
          user: existingUser,
        },
      });
    }
    
    // Check if user exists as Laundry
    const existingLaundry = await prisma.laundry.findUnique({
      where: { phone_number },
    });
    
    if (existingLaundry) {
      // Update last login
      await prisma.laundry.update({
        where: { id: existingLaundry.id },
        data: { last_login: new Date() },
      });
      
      // Generate tokens for existing laundry
      const tokens = await generateTokenPair(
        {
          id: existingLaundry.id,
          phone_number: existingLaundry.phone_number,
          role: 'LAUNDRY',
        },
        device_info,
        ipAddress
      );
      
      // Delete temp account
      await prisma.tempAccount.delete({
        where: { phone_number },
      });
      
      return NextResponse.json({
        success: true,
        message: 'Login successful',
        data: {
          is_new_user: false,
          requires_role_selection: false,
          requires_location: existingLaundry.status === 'PENDING_LOCATION',
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          access_token_expires_at: tokens.accessTokenExpiresAt.toISOString(),
          refresh_token_expires_at: tokens.refreshTokenExpiresAt.toISOString(),
          user: existingLaundry,
        },
      });
    }
    
    // New user - generate temporary token for role selection
    const tempToken = jwt.sign(
      { phone_number, type: 'temp' },
      process.env.JWT_ACCESS_SECRET || 'temp-secret',
      { expiresIn: '30m' }
    );
    
    return NextResponse.json({
      success: true,
      message: 'OTP verified successfully. Please select your role.',
      data: {
        is_new_user: true,
        requires_role_selection: true,
        requires_location: false,
        temp_token: tempToken,
      },
    });
    
  } catch (error) {
    console.error('Verify OTP Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify OTP',
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
