// src/app/api/orders/[id]/review/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { createReviewSchema } from '@/types';
import { updateLaundryStats } from '@/lib/order-utils';

// GET /api/orders/:id/review - Get order review
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const review = await prisma.review.findUnique({
      where: { order_id: params.id },
      include: {
        customer: { select: { id: true, name: true, avatar: true } },
      },
    });
    
    if (!review) {
      return NextResponse.json({ success: false, error: 'Review not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: { review } });
  } catch (error) {
    console.error('Get Review Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch review' }, { status: 500 });
  }
}

// POST /api/orders/:id/review - Create review
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'CUSTOMER') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get order
    const order = await prisma.order.findFirst({
      where: { id: params.id, customer_id: authResult.user.id },
    });
    
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }
    
    if (order.status !== 'DELIVERED' && order.status !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Can only review delivered orders', code: 'ORDER_NOT_DELIVERED' },
        { status: 400 }
      );
    }
    
    // Check if already reviewed
    const existingReview = await prisma.review.findUnique({ where: { order_id: params.id } });
    if (existingReview) {
      return NextResponse.json(
        { success: false, error: 'Order already reviewed', code: 'ALREADY_REVIEWED' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const validation = createReviewSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.errors }, { status: 400 });
    }
    
    const { rating, comment, service_rating, delivery_rating, value_rating, images } = validation.data;
    
    // Create review
    const review = await prisma.review.create({
      data: {
        order_id: params.id,
        customer_id: authResult.user.id,
        laundry_id: order.laundry_id,
        rating,
        comment,
        service_rating,
        delivery_rating,
        value_rating,
        images: images || [],
      },
    });
    
    // Update order status to completed
    await prisma.order.update({
      where: { id: params.id },
      data: { status: 'COMPLETED', completed_at: new Date() },
    });
    
    // Update laundry stats
    await updateLaundryStats(order.laundry_id);
    
    // TODO: Send notification to laundry
    
    return NextResponse.json({
      success: true,
      message: 'Review submitted successfully',
      data: { review },
    }, { status: 201 });
  } catch (error) {
    console.error('Create Review Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create review' }, { status: 500 });
  }
}
