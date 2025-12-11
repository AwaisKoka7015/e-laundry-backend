// src/app/api/laundry/services/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { createServiceSchema } from '@/types';

// GET /api/laundry/services - Get laundry's own services
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const services = await prisma.laundryService.findMany({
      where: { laundry_id: authResult.user.id },
      include: {
        category: { select: { id: true, name: true, name_urdu: true, icon: true } },
        pricing: {
          include: {
            clothing_item: { select: { id: true, name: true, name_urdu: true, type: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    
    return NextResponse.json({
      success: true,
      data: { services },
    });
  } catch (error) {
    console.error('Get Services Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch services', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// POST /api/laundry/services - Create new service
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const validation = createServiceSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }
    
    const { category_id, name, description, base_price, price_unit, estimated_hours, is_available } = validation.data;
    
    // Check if category exists
    const category = await prisma.serviceCategory.findUnique({ where: { id: category_id } });
    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Category not found', code: 'CATEGORY_NOT_FOUND' },
        { status: 404 }
      );
    }
    
    // Check for duplicate
    const existing = await prisma.laundryService.findFirst({
      where: { laundry_id: authResult.user.id, category_id, name },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Service with this name already exists in this category', code: 'DUPLICATE_SERVICE' },
        { status: 400 }
      );
    }
    
    const service = await prisma.laundryService.create({
      data: {
        laundry_id: authResult.user.id,
        category_id,
        name,
        description,
        base_price,
        price_unit,
        estimated_hours,
        is_available,
      },
      include: {
        category: { select: { id: true, name: true, name_urdu: true, icon: true } },
      },
    });
    
    // Update laundry services count
    await prisma.laundry.update({
      where: { id: authResult.user.id },
      data: { services_count: { increment: 1 } },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Service created successfully',
      data: { service },
    }, { status: 201 });
  } catch (error) {
    console.error('Create Service Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create service', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
