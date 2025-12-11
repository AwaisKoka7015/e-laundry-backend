// src/app/api/categories/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/categories - List all service categories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';
    
    const categories = await prisma.serviceCategory.findMany({
      where: activeOnly ? { is_active: true } : {},
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        name: true,
        name_urdu: true,
        icon: true,
        description: true,
        sort_order: true,
        is_active: true,
      },
    });
    
    return NextResponse.json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    console.error('Get Categories Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
