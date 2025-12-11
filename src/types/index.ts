import { z } from 'zod';

// ============================================
// PHONE NUMBER VALIDATION (Pakistan)
// ============================================

// Pakistan phone formats: +923001234567, 03001234567, 3001234567
export const phoneNumberSchema = z.string()
  .transform((val) => {
    // Remove spaces and dashes
    let cleaned = val.replace(/[\s-]/g, '');
    
    // Add +92 if starts with 0
    if (cleaned.startsWith('0')) {
      cleaned = '+92' + cleaned.substring(1);
    }
    // Add +92 if starts with 3
    else if (cleaned.startsWith('3')) {
      cleaned = '+92' + cleaned;
    }
    // Add + if starts with 92
    else if (cleaned.startsWith('92')) {
      cleaned = '+' + cleaned;
    }
    
    return cleaned;
  })
  .refine((val) => {
    // Validate Pakistani number format: +923XXXXXXXXX
    return /^\+92[0-9]{10}$/.test(val);
  }, {
    message: 'Invalid Pakistani phone number. Format: +923001234567 or 03001234567',
  });

// ============================================
// AUTH SCHEMAS
// ============================================

export const sendOtpSchema = z.object({
  phone_number: phoneNumberSchema,
});

export const verifyOtpSchema = z.object({
  phone_number: phoneNumberSchema,
  otp: z.string().length(4, 'OTP must be 4 digits'),
  device_info: z.string().optional(),
});

export const selectRoleSchema = z.object({
  phone_number: phoneNumberSchema,
  role: z.enum(['CUSTOMER', 'LAUNDRY']),
  temp_token: z.string().optional(),
});

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  city: z.string().optional(),
  address_text: z.string().optional(),
  near_landmark: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string(),
  device_info: z.string().optional(),
});

export const logoutSchema = z.object({
  refresh_token: z.string().optional(),
  logout_all_devices: z.boolean().default(false),
});

// ============================================
// PROFILE UPDATE SCHEMAS
// ============================================

export const updateUserProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().nullable(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional().nullable(),
  near_landmark: z.string().max(200).optional().nullable(),
  address_text: z.string().max(500).optional().nullable(),
  fcm_token: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  city: z.string().optional(),
});

export const updateLaundryProfileSchema = z.object({
  laundry_name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().nullable(),
  near_landmark: z.string().max(200).optional().nullable(),
  address_text: z.string().max(500).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  fcm_token: z.string().optional().nullable(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  city: z.string().optional(),
  working_hours: z.record(z.object({
    open: z.string(),
    close: z.string(),
    is_closed: z.boolean().optional(),
  })).optional().nullable(),
});

// ============================================
// UPLOAD SCHEMAS
// ============================================

export const uploadImageSchema = z.object({
  image: z.string().refine((val) => {
    // Check if it's a valid base64 image
    return val.startsWith('data:image/') || /^[A-Za-z0-9+/]+=*$/.test(val);
  }, 'Invalid base64 image'),
  type: z.enum(['avatar', 'laundry_logo', 'review']),
});

// ============================================
// SERVICE MANAGEMENT SCHEMAS (NEW)
// ============================================

export const createServiceSchema = z.object({
  category_id: z.string().uuid('Invalid category ID'),
  name: z.string().min(2, 'Service name must be at least 2 characters').max(100),
  description: z.string().max(500).optional().nullable(),
  base_price: z.number().min(0, 'Price cannot be negative').default(0),
  price_unit: z.enum(['PER_PIECE', 'PER_KG']).default('PER_PIECE'),
  estimated_hours: z.number().int().min(1).max(168).default(24), // max 1 week
  is_available: z.boolean().default(true),
});

export const updateServiceSchema = createServiceSchema.partial();

export const servicePricingSchema = z.object({
  clothing_item_id: z.string().uuid('Invalid clothing item ID'),
  price: z.number().min(0, 'Price cannot be negative'),
  express_price: z.number().min(0).optional().nullable(),
  price_unit: z.enum(['PER_PIECE', 'PER_KG']).optional(),
  is_available: z.boolean().default(true),
});

export const bulkPricingSchema = z.object({
  pricing: z.array(servicePricingSchema).min(1, 'At least one pricing item is required'),
});

// ============================================
// SEARCH SCHEMAS (NEW)
// ============================================

export const searchLaundriesSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().min(1).max(50).default(5),
  category_id: z.string().uuid().optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
  sort_by: z.enum(['distance', 'rating', 'price', 'orders']).default('distance'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ============================================
// ORDER SCHEMAS (NEW)
// ============================================

export const orderItemSchema = z.object({
  service_id: z.string().uuid('Invalid service ID'),
  clothing_item_id: z.string().uuid('Invalid clothing item ID'),
  quantity: z.number().int().min(1).default(1),
  weight_kg: z.number().min(0.1).optional(), // For PER_KG pricing
  special_notes: z.string().max(200).optional(),
});

export const createOrderSchema = z.object({
  laundry_id: z.string().uuid('Invalid laundry ID'),
  order_type: z.enum(['STANDARD', 'EXPRESS']).default('STANDARD'),
  
  // Pickup details
  pickup_address: z.string().min(10, 'Pickup address is required').max(500),
  pickup_latitude: z.number().min(-90).max(90),
  pickup_longitude: z.number().min(-180).max(180),
  pickup_date: z.coerce.date().refine((date) => date > new Date(), {
    message: 'Pickup date must be in the future',
  }),
  pickup_time_slot: z.string().optional(), // e.g., "09:00-11:00"
  pickup_notes: z.string().max(200).optional(),
  
  // Delivery details (optional, defaults to pickup address)
  delivery_address: z.string().max(500).optional(),
  delivery_latitude: z.number().min(-90).max(90).optional(),
  delivery_longitude: z.number().min(-180).max(180).optional(),
  delivery_notes: z.string().max(200).optional(),
  
  // Order items
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  
  // Promo & notes
  promo_code: z.string().max(20).optional(),
  special_instructions: z.string().max(500).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'ACCEPTED',
    'REJECTED',
    'PICKUP_SCHEDULED',
    'PICKED_UP',
    'PROCESSING',
    'READY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'COMPLETED',
  ]),
  notes: z.string().max(500).optional(),
  // For scheduling pickup
  scheduled_pickup_time: z.coerce.date().optional(),
  // For rejection
  rejection_reason: z.string().max(500).optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason (at least 10 characters)').max(500),
});

// ============================================
// REVIEW SCHEMAS (NEW)
// ============================================

export const createReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().max(1000).optional(),
  service_rating: z.number().min(1).max(5).optional(),
  delivery_rating: z.number().min(1).max(5).optional(),
  value_rating: z.number().min(1).max(5).optional(),
  images: z.array(z.string().url()).max(5).optional(),
});

export const replyReviewSchema = z.object({
  reply: z.string().min(10, 'Reply must be at least 10 characters').max(500),
});

// ============================================
// PROMO CODE SCHEMAS (NEW)
// ============================================

export const validatePromoSchema = z.object({
  code: z.string().min(1).max(20).transform((val) => val.toUpperCase()),
  order_amount: z.number().min(0),
  laundry_id: z.string().uuid().optional(),
});

// ============================================
// NOTIFICATION SCHEMAS (NEW)
// ============================================

export const markNotificationsReadSchema = z.object({
  notification_ids: z.array(z.string().uuid()).optional(),
  mark_all: z.boolean().default(false),
}).refine((data) => data.mark_all || (data.notification_ids && data.notification_ids.length > 0), {
  message: 'Either mark_all must be true or notification_ids must be provided',
});

// ============================================
// DELIVERY PARTNER SCHEMAS (NEW - Future)
// ============================================

export const updateDeliveryPartnerProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().nullable(),
  avatar: z.string().url().optional().nullable(),
  vehicle_type: z.enum(['BIKE', 'MOTORCYCLE', 'CAR', 'VAN']).optional(),
  vehicle_number: z.string().max(20).optional().nullable(),
  cnic: z.string().length(13, 'CNIC must be 13 digits').optional(),
  fcm_token: z.string().optional().nullable(),
  is_available: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// ============================================
// PAGINATION SCHEMA (NEW)
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// ============================================
// TYPE EXPORTS - EXISTING
// ============================================

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type SelectRoleInput = z.infer<typeof selectRoleSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type UpdateLaundryProfileInput = z.infer<typeof updateLaundryProfileSchema>;
export type UploadImageInput = z.infer<typeof uploadImageSchema>;

// ============================================
// TYPE EXPORTS - NEW
// ============================================

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
export type ServicePricingInput = z.infer<typeof servicePricingSchema>;
export type BulkPricingInput = z.infer<typeof bulkPricingSchema>;
export type SearchLaundriesInput = z.infer<typeof searchLaundriesSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ReplyReviewInput = z.infer<typeof replyReviewSchema>;
export type ValidatePromoInput = z.infer<typeof validatePromoSchema>;
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;
export type UpdateDeliveryPartnerProfileInput = z.infer<typeof updateDeliveryPartnerProfileSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
}

export interface AuthResponse {
  is_new_user: boolean;
  requires_role_selection: boolean;
  requires_location: boolean;
  temp_token?: string;
  access_token?: string;
  refresh_token?: string;
  access_token_expires_at?: string;
  refresh_token_expires_at?: string;
  user?: UserData | LaundryData;
}

export interface UserData {
  id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  gender: string | null;
  role: 'CUSTOMER';
  status: string;
  latitude: number | null;
  longitude: number | null;
  near_landmark: string | null;
  address_text: string | null;
  city: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface LaundryData {
  id: string;
  phone_number: string;
  laundry_name: string | null;
  email: string | null;
  laundry_logo: string | null;
  role: 'LAUNDRY';
  status: string;
  latitude: number | null;
  longitude: number | null;
  near_landmark: string | null;
  address_text: string | null;
  city: string | null;
  working_hours: any;
  description: string | null;
  rating: number;
  total_orders: number;
  total_reviews: number;
  services_count: number;
  is_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// NEW DATA TYPES
// ============================================

export interface ServiceCategoryData {
  id: string;
  name: string;
  name_urdu: string | null;
  icon: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ClothingItemData {
  id: string;
  name: string;
  name_urdu: string | null;
  type: 'MEN' | 'WOMEN' | 'KIDS' | 'HOME';
  icon: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface LaundryServiceData {
  id: string;
  laundry_id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price: number;
  price_unit: 'PER_PIECE' | 'PER_KG';
  estimated_hours: number;
  is_available: boolean;
  category?: ServiceCategoryData;
  pricing?: ServicePricingData[];
}

export interface ServicePricingData {
  id: string;
  laundry_service_id: string;
  clothing_item_id: string;
  price: number;
  express_price: number | null;
  price_unit: 'PER_PIECE' | 'PER_KG';
  is_available: boolean;
  clothing_item?: ClothingItemData;
}

export interface OrderData {
  id: string;
  order_number: string;
  customer_id: string;
  laundry_id: string;
  status: OrderStatus;
  order_type: 'STANDARD' | 'EXPRESS';
  pickup_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  pickup_date: Date;
  pickup_time_slot: string | null;
  pickup_notes: string | null;
  delivery_address: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_notes: string | null;
  expected_delivery_date: Date | null;
  actual_delivery_date: Date | null;
  subtotal: number;
  delivery_fee: number;
  express_fee: number;
  discount: number;
  promo_code: string | null;
  total_amount: number;
  payment_status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  payment_method: 'COD' | 'JAZZCASH' | 'EASYPAISA' | 'CARD';
  special_instructions: string | null;
  cancellation_reason: string | null;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  items?: OrderItemData[];
  customer?: UserData;
  laundry?: LaundryData;
  review?: ReviewData;
  created_at: Date;
  updated_at: Date;
}

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'PROCESSING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OrderItemData {
  id: string;
  order_id: string;
  laundry_service_id: string;
  clothing_item_id: string;
  quantity: number;
  weight_kg: number | null;
  unit_price: number;
  price_unit: 'PER_PIECE' | 'PER_KG';
  total_price: number;
  special_notes: string | null;
  clothing_item?: ClothingItemData;
  service?: LaundryServiceData;
}

export interface OrderTimelineData {
  id: string;
  order_id: string;
  event: string;
  title: string;
  description: string | null;
  icon: string | null;
  timestamp: Date;
}

export interface ReviewData {
  id: string;
  order_id: string;
  customer_id: string;
  laundry_id: string;
  rating: number;
  comment: string | null;
  service_rating: number | null;
  delivery_rating: number | null;
  value_rating: number | null;
  images: string[];
  laundry_reply: string | null;
  replied_at: Date | null;
  is_visible: boolean;
  customer?: UserData;
  created_at: Date;
}

export interface NotificationData {
  id: string;
  type: 'ORDER_UPDATE' | 'PROMO' | 'SYSTEM' | 'REVIEW' | 'WELCOME';
  title: string;
  body: string;
  data: any;
  is_read: boolean;
  created_at: Date;
}

export interface PromoCodeData {
  id: string;
  code: string;
  discount_type: 'PERCENTAGE' | 'FIXED';
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number;
  usage_limit: number | null;
  used_count: number;
  valid_from: Date;
  valid_until: Date;
  is_active: boolean;
  first_order_only: boolean;
  applicable_laundries: string[];
}

export interface CustomerDashboardData {
  active_orders: number;
  completed_orders: number;
  total_spent: number;
  favorite_laundry: {
    id: string;
    laundry_name: string;
    laundry_logo: string | null;
    orders_count: number;
  } | null;
  recent_orders: OrderData[];
  unread_notifications: number;
}

export interface LaundryDashboardData {
  today: {
    new_orders: number;
    completed_orders: number;
    revenue: number;
    pending_pickups: number;
  };
  this_week: {
    total_orders: number;
    revenue: number;
    new_customers: number;
  };
  this_month: {
    total_orders: number;
    revenue: number;
  };
  overview: {
    rating: number;
    total_reviews: number;
    total_orders: number;
    services_count: number;
  };
  pending_actions: {
    pending_orders: number;
    ready_for_delivery: number;
  };
  recent_orders: OrderData[];
  unread_notifications: number;
}

// ============================================
// CONSTANTS
// ============================================

export const ORDER_STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PICKUP_SCHEDULED', 'CANCELLED'],
  REJECTED: [],
  PICKUP_SCHEDULED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY'],
  READY: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const CANCELLABLE_STATUSES: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
];

export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PICKUP_SCHEDULED',
  'PICKED_UP',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
];

export const TIME_SLOTS = [
  '09:00-11:00',
  '11:00-13:00',
  '13:00-15:00',
  '15:00-17:00',
  '17:00-19:00',
  '19:00-21:00',
];

export const CLOTHING_TYPES = ['MEN', 'WOMEN', 'KIDS', 'HOME'] as const;
export type ClothingType = typeof CLOTHING_TYPES[number];
