// src/app/api/laundries/[id]/services/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/laundries/:id/services - Get laundry's services (public)
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const laundry = await prisma.laundry.findUnique({
      where: { id: params.id, status: 'ACTIVE' },
      select: { id: true },
    });
    
    if (!laundry) {
      return NextResponse.json({ success: false, error: 'Laundry not found' }, { status: 404 });
    }
    
    const services = await prisma.laundryService.findMany({
      where: { laundry_id: params.id, is_available: true },
      include: {
        category: { select: { id: true, name: true, name_urdu: true, icon: true } },
        pricing: {
          where: { is_available: true },
          include: {
            clothing_item: { select: { id: true, name: true, name_urdu: true, type: true, icon: true } },
          },
          orderBy: { clothing_item: { sort_order: 'asc' } },
        },
      },
      orderBy: { category: { sort_order: 'asc' } },
    });
    
    // Group by category
    const grouped = services.reduce((acc: any, service) => {
      const catName = service.category.name;
      if (!acc[catName]) {
        acc[catName] = {
          category: service.category,
          services: [],
        };
      }
      acc[catName].services.push(service);
      return acc;
    }, {});
    
    return NextResponse.json({
      success: true,
      data: {
        services,
        grouped: Object.values(grouped),
      },
    });
  } catch (error) {
    console.error('Get Laundry Services Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch services' }, { status: 500 });
  }
}
