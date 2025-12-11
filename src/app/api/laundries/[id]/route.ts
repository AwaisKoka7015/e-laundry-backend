// src/app/api/laundries/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/laundries/:id - Get laundry details (public)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const laundry = await prisma.laundry.findUnique({
      where: { id: params.id, status: 'ACTIVE' },
      select: {
        id: true,
        laundry_name: true,
        laundry_logo: true,
        phone_number: true,
        email: true,
        description: true,
        latitude: true,
        longitude: true,
        address_text: true,
        near_landmark: true,
        city: true,
        rating: true,
        total_reviews: true,
        total_orders: true,
        services_count: true,
        is_verified: true,
        working_hours: true,
        created_at: true,
      },
    });
    
    if (!laundry) {
      return NextResponse.json(
        { success: false, error: 'Laundry not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: { laundry },
    });
  } catch (error) {
    console.error('Get Laundry Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch laundry' },
      { status: 500 }
    );
  }
}
