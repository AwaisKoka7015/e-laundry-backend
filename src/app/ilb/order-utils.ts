// src/lib/order-utils.ts
import prisma from './prisma';

/**
 * Generate unique order number: ORD-YYYYMMDD-XXXX
 */
export async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Get today's order count
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
  const count = await prisma.order.count({
    where: {
      created_at: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
  
  const sequence = String(count + 1).padStart(4, '0');
  return `ORD-${dateStr}-${sequence}`;
}

/**
 * Check if order can be cancelled
 */
export function canCancelOrder(status: string): { allowed: boolean; reason?: string } {
  const blockedStatuses = ['PROCESSING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REJECTED'];
  
  if (blockedStatuses.includes(status)) {
    return {
      allowed: false,
      reason: `Cannot cancel order with status: ${status}. Orders can only be cancelled before processing starts.`,
    };
  }
  
  return { allowed: true };
}

/**
 * Get next valid statuses for an order
 */
export function getNextValidStatuses(currentStatus: string): string[] {
  const statusFlow: Record<string, string[]> = {
    'PENDING': ['ACCEPTED', 'REJECTED', 'CANCELLED'],
    'ACCEPTED': ['PICKUP_SCHEDULED', 'CANCELLED'],
    'PICKUP_SCHEDULED': ['PICKED_UP', 'CANCELLED'],
    'PICKED_UP': ['PROCESSING', 'CANCELLED'],
    'PROCESSING': ['READY'],
    'READY': ['OUT_FOR_DELIVERY'],
    'OUT_FOR_DELIVERY': ['DELIVERED'],
    'DELIVERED': ['COMPLETED'],
    'COMPLETED': [],
    'CANCELLED': [],
    'REJECTED': [],
  };
  
  return statusFlow[currentStatus] || [];
}

/**
 * Validate status transition
 */
export function isValidStatusTransition(fromStatus: string, toStatus: string): boolean {
  const validNext = getNextValidStatuses(fromStatus);
  return validNext.includes(toStatus);
}

/**
 * Get timeline event details
 */
export function getTimelineEvent(status: string): { event: string; title: string; icon: string } {
  const events: Record<string, { event: string; title: string; icon: string }> = {
    'PENDING': { event: 'ORDER_PLACED', title: 'Order Placed', icon: 'shopping-cart' },
    'ACCEPTED': { event: 'ORDER_ACCEPTED', title: 'Order Accepted', icon: 'check-circle' },
    'REJECTED': { event: 'ORDER_REJECTED', title: 'Order Rejected', icon: 'x-circle' },
    'PICKUP_SCHEDULED': { event: 'PICKUP_SCHEDULED', title: 'Pickup Scheduled', icon: 'calendar' },
    'PICKED_UP': { event: 'PICKED_UP', title: 'Clothes Picked Up', icon: 'truck' },
    'PROCESSING': { event: 'PROCESSING', title: 'Processing Started', icon: 'loader' },
    'READY': { event: 'READY', title: 'Ready for Delivery', icon: 'package' },
    'OUT_FOR_DELIVERY': { event: 'OUT_FOR_DELIVERY', title: 'Out for Delivery', icon: 'truck' },
    'DELIVERED': { event: 'DELIVERED', title: 'Delivered', icon: 'check' },
    'COMPLETED': { event: 'COMPLETED', title: 'Order Completed', icon: 'check-circle' },
    'CANCELLED': { event: 'CANCELLED', title: 'Order Cancelled', icon: 'x' },
  };
  
  return events[status] || { event: status, title: status, icon: 'circle' };
}

/**
 * Calculate estimated delivery date
 */
export function calculateEstimatedDelivery(pickupDate: Date, estimatedHours: number, isExpress: boolean): Date {
  const hours = isExpress ? Math.ceil(estimatedHours / 2) : estimatedHours;
  const deliveryDate = new Date(pickupDate);
  deliveryDate.setHours(deliveryDate.getHours() + hours);
  return deliveryDate;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Update laundry statistics after order completion/review
 */
export async function updateLaundryStats(laundryId: string): Promise<void> {
  // Count total orders
  const totalOrders = await prisma.order.count({
    where: { laundry_id: laundryId, status: { not: 'CANCELLED' } },
  });
  
  // Calculate average rating
  const reviews = await prisma.review.aggregate({
    where: { laundry_id: laundryId, is_visible: true },
    _avg: { rating: true },
    _count: { id: true },
  });
  
  // Count services
  const servicesCount = await prisma.laundryService.count({
    where: { laundry_id: laundryId, is_available: true },
  });
  
  // Update laundry
  await prisma.laundry.update({
    where: { id: laundryId },
    data: {
      total_orders: totalOrders,
      rating: reviews._avg.rating || 0,
      total_reviews: reviews._count.id,
      services_count: servicesCount,
    },
  });
}
