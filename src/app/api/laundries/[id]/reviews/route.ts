// src/app/api/laundries/[id]/reviews/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/laundries/:id/reviews - Get laundry reviews (public)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { laundry_id: params.id, is_visible: true },
        include: {
          customer: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where: { laundry_id: params.id, is_visible: true } }),
    ]);
    
    return NextResponse.json({
      success: true,
      data: { reviews },
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit), has_more: page * limit < total },
    });
  } catch (error) {
    console.error('Get Laundry Reviews Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
