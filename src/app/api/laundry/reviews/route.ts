// src/app/api/laundry/reviews/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';

// GET /api/laundry/reviews - Get laundry's reviews
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { laundry_id: authResult.user.id, is_visible: true },
        include: {
          customer: { select: { id: true, name: true, avatar: true } },
          order: { select: { order_number: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.review.count({ where: { laundry_id: authResult.user.id, is_visible: true } }),
    ]);
    
    // Calculate rating distribution
    const distribution = await prisma.review.groupBy({
      by: ['rating'],
      where: { laundry_id: authResult.user.id, is_visible: true },
      _count: { rating: true },
    });
    
    const ratingDistribution = {
      5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
    };
    distribution.forEach((d) => {
      ratingDistribution[Math.floor(d.rating) as keyof typeof ratingDistribution] = d._count.rating;
    });
    
    return NextResponse.json({
      success: true,
      data: { reviews, rating_distribution: ratingDistribution },
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit), has_more: page * limit < total },
    });
  } catch (error) {
    console.error('Get Laundry Reviews Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
