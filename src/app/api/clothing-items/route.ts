// src/app/api/clothing-items/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/clothing-items - List all clothing items
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // MEN, WOMEN, KIDS, HOME
    const activeOnly = searchParams.get('active') !== 'false';
    
    const where: any = {};
    if (activeOnly) where.is_active = true;
    if (type) where.type = type;
    
    const items = await prisma.clothingItem.findMany({
      where,
      orderBy: [{ type: 'asc' }, { sort_order: 'asc' }],
      select: {
        id: true,
        name: true,
        name_urdu: true,
        type: true,
        icon: true,
        description: true,
        sort_order: true,
        is_active: true,
      },
    });
    
    // Group by type if no specific type requested
    if (!type) {
      const grouped = {
        MEN: items.filter(i => i.type === 'MEN'),
        WOMEN: items.filter(i => i.type === 'WOMEN'),
        KIDS: items.filter(i => i.type === 'KIDS'),
        HOME: items.filter(i => i.type === 'HOME'),
      };
      
      return NextResponse.json({
        success: true,
        data: { items: grouped, total: items.length },
      });
    }
    
    return NextResponse.json({
      success: true,
      data: { items, total: items.length },
    });
  } catch (error) {
    console.error('Get Clothing Items Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch clothing items', code: 'INTERNAL_ERROR' },
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
