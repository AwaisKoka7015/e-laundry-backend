// src/app/api/laundry/reviews/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { replyReviewSchema } from '@/types';

// POST /api/laundry/reviews/:id - Reply to review
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const review = await prisma.review.findFirst({
      where: { id: params.id, laundry_id: authResult.user.id },
    });
    
    if (!review) {
      return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });
    }
    
    if (review.laundry_reply) {
      return NextResponse.json({ success: false, error: 'Already replied to this review' }, { status: 400 });
    }
    
    const body = await request.json();
    const validation = replyReviewSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.errors }, { status: 400 });
    }
    
    const updatedReview = await prisma.review.update({
      where: { id: params.id },
      data: {
        laundry_reply: validation.data.reply,
        replied_at: new Date(),
      },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Reply added successfully',
      data: { review: updatedReview },
    });
  } catch (error) {
    console.error('Reply Review Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to reply to review' }, { status: 500 });
  }
}
