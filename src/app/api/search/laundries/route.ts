// src/app/api/search/laundries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { searchLaundriesSchema } from '@/types';
import { calculateDistance } from '@/lib/order-utils';

// GET /api/search/laundries - Search nearby laundries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const validation = searchLaundriesSchema.safeParse({
      latitude: searchParams.get('latitude'),
      longitude: searchParams.get('longitude'),
      radius_km: searchParams.get('radius_km'),
      category_id: searchParams.get('category_id'),
      min_rating: searchParams.get('min_rating'),
      sort_by: searchParams.get('sort_by'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });
    
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }
    
    const { latitude, longitude, radius_km, category_id, min_rating, sort_by, page, limit } = validation.data;
    
    // Build where clause
    const where: any = {
      status: 'ACTIVE',
      latitude: { not: null },
      longitude: { not: null },
    };
    
    if (min_rating) {
      where.rating = { gte: min_rating };
    }
    
    if (category_id) {
      where.services = {
        some: { category_id, is_available: true },
      };
    }
    
    // Get all active laundries
    const laundries = await prisma.laundry.findMany({
      where,
      select: {
        id: true,
        laundry_name: true,
        laundry_logo: true,
        phone_number: true,
        latitude: true,
        longitude: true,
        address_text: true,
        city: true,
        rating: true,
        total_reviews: true,
        total_orders: true,
        services_count: true,
        is_verified: true,
        working_hours: true,
        services: {
          where: { is_available: true },
          select: {
            id: true,
            name: true,
            base_price: true,
            category: { select: { name: true } },
          },
          take: 5,
        },
      },
    });
    
    // Calculate distances and filter by radius
    const laundriesWithDistance = laundries
      .map((laundry) => {
        const distance = calculateDistance(
          latitude,
          longitude,
          laundry.latitude!,
          laundry.longitude!
        );
        return { ...laundry, distance_km: Math.round(distance * 10) / 10 };
      })
      .filter((l) => l.distance_km <= radius_km);
    
    // Sort
    laundriesWithDistance.sort((a, b) => {
      switch (sort_by) {
        case 'distance':
          return a.distance_km - b.distance_km;
        case 'rating':
          return b.rating - a.rating;
        case 'orders':
          return b.total_orders - a.total_orders;
        default:
          return a.distance_km - b.distance_km;
      }
    });
    
    // Paginate
    const total = laundriesWithDistance.length;
    const total_pages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginated = laundriesWithDistance.slice(offset, offset + limit);
    
    // Format response
    const results = paginated.map((l) => ({
      id: l.id,
      laundry_name: l.laundry_name,
      laundry_logo: l.laundry_logo,
      rating: l.rating,
      total_reviews: l.total_reviews,
      total_orders: l.total_orders,
      distance_km: l.distance_km,
      address_text: l.address_text,
      city: l.city,
      is_verified: l.is_verified,
      services_preview: l.services.map((s) => s.category.name).filter((v, i, a) => a.indexOf(v) === i),
      services_count: l.services_count,
    }));
    
    return NextResponse.json({
      success: true,
      data: { laundries: results },
      pagination: {
        page,
        limit,
        total,
        total_pages,
        has_more: page < total_pages,
      },
    });
  } catch (error) {
    console.error('Search Laundries Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search laundries' },
      { status: 500 }
    );
  }
}
