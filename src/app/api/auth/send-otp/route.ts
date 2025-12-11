import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendOtpSchema } from '@/types';

// Constants
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '5');
const OTP_CODE = process.env.OTP_DEFAULT_CODE || '0000'; // Development only!

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const validationResult = sendOtpSchema.safeParse(body);
    
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
    
    const { phone_number } = validationResult.data;
    
    // Check rate limiting (max 5 OTPs per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentOtps = await prisma.otpLog.count({
      where: {
        phone_number,
        created_at: { gte: oneHourAgo },
      },
    });
    
    if (recentOtps >= 5) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many OTP requests. Please try again after an hour.',
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 }
      );
    }
    
    // Create OTP expiry time
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    
    // Create or update temp account
    await prisma.tempAccount.upsert({
      where: { phone_number },
      update: {
        otp_code: OTP_CODE,
        otp_verified: false,
        expires_at: expiresAt,
        updated_at: new Date(),
      },
      create: {
        phone_number,
        otp_code: OTP_CODE,
        otp_verified: false,
        expires_at: expiresAt,
      },
    });
    
    // Log OTP attempt
    await prisma.otpLog.create({
      data: {
        phone_number,
        otp_code: OTP_CODE,
        expires_at: expiresAt,
      },
    });
    
    // In production, send OTP via SMS provider (Twilio, etc.)
    // For now, we're using a constant OTP: 0000
    
    // Response
    const response: any = {
      success: true,
      message: 'OTP sent successfully',
      data: {
        phone_number,
        expires_in: OTP_EXPIRY_MINUTES * 60, // in seconds
      },
    };
    
    // Include OTP in development mode only
    if (process.env.NODE_ENV === 'development') {
      response.data.dev_otp = OTP_CODE;
      response.message = `OTP sent successfully (Development OTP: ${OTP_CODE})`;
    }
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    console.error('Send OTP Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send OTP',
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
