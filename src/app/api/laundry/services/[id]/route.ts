// src/app/api/laundry/services/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth-middleware';
import { updateServiceSchema } from '@/types';

// GET /api/laundry/services/:id - Get single service
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const service = await prisma.laundryService.findFirst({
      where: { id: params.id, laundry_id: authResult.user.id },
      include: {
        category: true,
        pricing: { include: { clothing_item: true } },
      },
    });
    
    if (!service) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, data: { service } });
  } catch (error) {
    console.error('Get Service Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch service' }, { status: 500 });
  }
}

// PUT /api/laundry/services/:id - Update service
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const existing = await prisma.laundryService.findFirst({
      where: { id: params.id, laundry_id: authResult.user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
    }
    
    const body = await request.json();
    const validation = updateServiceSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.errors }, { status: 400 });
    }
    
    const service = await prisma.laundryService.update({
      where: { id: params.id },
      data: validation.data,
      include: { category: true },
    });
    
    return NextResponse.json({ success: true, message: 'Service updated', data: { service } });
  } catch (error) {
    console.error('Update Service Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update service' }, { status: 500 });
  }
}

// DELETE /api/laundry/services/:id - Delete service
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user || authResult.user.role !== 'LAUNDRY') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    
    const existing = await prisma.laundryService.findFirst({
      where: { id: params.id, laundry_id: authResult.user.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Service not found' }, { status: 404 });
    }
    
    await prisma.laundryService.delete({ where: { id: params.id } });
    
    await prisma.laundry.update({
      where: { id: authResult.user.id },
      data: { services_count: { decrement: 1 } },
    });
    
    return NextResponse.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    console.error('Delete Service Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete service' }, { status: 500 });
  }
}
