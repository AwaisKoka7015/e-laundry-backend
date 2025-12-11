// src/lib/notification-utils.ts
import prisma from './prisma';
import { NotificationType } from '@prisma/client';

interface CreateNotificationParams {
  user_id?: string;
  laundry_id?: string;
  delivery_partner_id?: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: any;
  image?: string;
}

/**
 * Create a notification
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        user_id: params.user_id,
        laundry_id: params.laundry_id,
        delivery_partner_id: params.delivery_partner_id,
        type: params.type,
        title: params.title,
        body: params.body,
        data: params.data,
        image: params.image,
      },
    });
    
    // TODO: Send push notification via FCM
    // await sendPushNotification(notification);
    
    return notification;
  } catch (error) {
    console.error('Create Notification Error:', error);
    return null;
  }
}

/**
 * Send order status notification to customer
 */
export async function notifyCustomerOrderStatus(
  customerId: string,
  orderNumber: string,
  status: string,
  laundryName: string
) {
  const messages: Record<string, { title: string; body: string }> = {
    ACCEPTED: {
      title: 'Order Accepted! ✅',
      body: `${laundryName} has accepted your order #${orderNumber}`,
    },
    REJECTED: {
      title: 'Order Not Accepted',
      body: `Unfortunately, ${laundryName} couldn't accept your order #${orderNumber}`,
    },
    PICKUP_SCHEDULED: {
      title: 'Pickup Scheduled 📅',
      body: `Your clothes will be picked up soon for order #${orderNumber}`,
    },
    PICKED_UP: {
      title: 'Clothes Picked Up 🚚',
      body: `Your clothes have been picked up for order #${orderNumber}`,
    },
    PROCESSING: {
      title: 'Processing Started 🧺',
      body: `${laundryName} has started processing your order #${orderNumber}`,
    },
    READY: {
      title: 'Ready for Delivery! ✨',
      body: `Your clothes are ready! Order #${orderNumber} will be delivered soon`,
    },
    OUT_FOR_DELIVERY: {
      title: 'Out for Delivery 🚚',
      body: `Your order #${orderNumber} is on the way!`,
    },
    DELIVERED: {
      title: 'Delivered! 🎉',
      body: `Your order #${orderNumber} has been delivered. Please rate your experience!`,
    },
  };
  
  const message = messages[status];
  if (!message) return;
  
  return createNotification({
    user_id: customerId,
    type: 'ORDER_UPDATE',
    title: message.title,
    body: message.body,
    data: { order_number: orderNumber, status },
  });
}

/**
 * Send new order notification to laundry
 */
export async function notifyLaundryNewOrder(
  laundryId: string,
  orderNumber: string,
  customerName: string,
  itemsCount: number
) {
  return createNotification({
    laundry_id: laundryId,
    type: 'ORDER_UPDATE',
    title: 'New Order! 🎊',
    body: `${customerName} placed an order with ${itemsCount} items. Order #${orderNumber}`,
    data: { order_number: orderNumber },
  });
}

/**
 * Send review notification to laundry
 */
export async function notifyLaundryNewReview(
  laundryId: string,
  customerName: string,
  rating: number,
  orderNumber: string
) {
  return createNotification({
    laundry_id: laundryId,
    type: 'REVIEW',
    title: `New ${rating}⭐ Review`,
    body: `${customerName} left a review for order #${orderNumber}`,
    data: { order_number: orderNumber, rating },
  });
}

/**
 * Send welcome notification
 */
export async function sendWelcomeNotification(
  userId?: string,
  laundryId?: string,
  name?: string
) {
  const title = 'Welcome to E-Laundry! 🎉';
  const body = laundryId
    ? `Hi ${name || 'Partner'}! Your laundry account is ready. Start adding your services!`
    : `Hi ${name || 'there'}! Your account is ready. Find the best laundries near you!`;
  
  return createNotification({
    user_id: userId,
    laundry_id: laundryId,
    type: 'WELCOME',
    title,
    body,
  });
}
