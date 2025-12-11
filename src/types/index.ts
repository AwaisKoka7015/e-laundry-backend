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
  type: z.enum(['avatar', 'laundry_logo']),
});

// ============================================
// TYPE EXPORTS
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
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
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
