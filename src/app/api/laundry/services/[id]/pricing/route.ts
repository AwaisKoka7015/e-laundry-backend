// src/app/api/laundry/services/[id]/pricing/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { bulkPricingSchema } from '@/types';

// GET /api/laundry/services/:id/pricing - Get service pricing
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const service = await prisma.laundryService.findFirst({
      where: { id: params.id, laundry_id: authResult.user.id },
    });
    if (!service) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
    }
    
    const pricing = await prisma.servicePricing.findMany({
      where: { laundry_service_id: params.id },
      include: {
        clothing_item: { select: { id: true, name: true, name_urdu: true, type: true, icon: true } },
      },
      orderBy: { clothing_item: { sort_order: 'asc' } },
    });
    
    return NextResponse.json({ success: true, data: { pricing } });
  } catch (error) {
    console.error('Get Pricing Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch pricing' }, { status: 500 });
  }
}

// POST /api/laundry/services/:id/pricing - Set bulk pricing
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const service = await prisma.laundryService.findFirst({
      where: { id: params.id, laundry_id: authResult.user.id },
    });
    if (!service) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
    }
    
    const body = await request.json();
    const validation = bulkPricingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.errors }, { status: 400 });
    }
    
    const { pricing } = validation.data;
    
    // Upsert each pricing item
    const results = await Promise.all(
      pricing.map(async (item) => {
        return prisma.servicePricing.upsert({
          where: {
            laundry_service_id_clothing_item_id: {
              laundry_service_id: params.id,
              clothing_item_id: item.clothing_item_id,
            },
          },
          update: {
            price: item.price,
            express_price: item.express_price,
            price_unit: item.price_unit,
            is_available: item.is_available,
          },
          create: {
            laundry_service_id: params.id,
            clothing_item_id: item.clothing_item_id,
            price: item.price,
            express_price: item.express_price,
            price_unit: item.price_unit,
            is_available: item.is_available,
          },
          include: { clothing_item: true },
        });
      })
    );
    
    return NextResponse.json({
      success: true,
      message: `${results.length} pricing items updated`,
      data: { pricing: results },
    });
  } catch (error) {
    console.error('Set Pricing Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to set pricing' }, { status: 500 });
  }
}
