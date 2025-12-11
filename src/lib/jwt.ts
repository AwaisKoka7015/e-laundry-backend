import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from './prisma';

// Types
export interface TokenPayload {
  id: string;
  phone_number: string;
  role: 'CUSTOMER' | 'LAUNDRY';
  type: 'access' | 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

// Environment variables with defaults
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'default-access-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me';
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Parse expiry string to milliseconds
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // Default 15 minutes
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}

/**
 * Generate Access Token
 */
export function generateAccessToken(payload: Omit<TokenPayload, 'type'>): string {
  const tokenPayload: TokenPayload = { ...payload, type: 'access' };
  
  const options: SignOptions = {
    expiresIn: JWT_ACCESS_EXPIRES_IN,
    issuer: 'e-laundry-api',
    audience: 'e-laundry-app',
  };
  
  return jwt.sign(tokenPayload, JWT_ACCESS_SECRET, options);
}

/**
 * Generate Refresh Token
 */
export function generateRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
  const tokenPayload: TokenPayload = { ...payload, type: 'refresh' };
  
  const options: SignOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'e-laundry-api',
    audience: 'e-laundry-app',
    jwtid: uuidv4(), // Unique token ID for revocation
  };
  
  return jwt.sign(tokenPayload, JWT_REFRESH_SECRET, options);
}

/**
 * Generate Token Pair (Access + Refresh)
 */
export async function generateTokenPair(
  payload: Omit<TokenPayload, 'type'>,
  deviceInfo?: string,
  ipAddress?: string
): Promise<TokenPair> {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  
  const accessExpiryMs = parseExpiry(JWT_ACCESS_EXPIRES_IN);
  const refreshExpiryMs = parseExpiry(JWT_REFRESH_EXPIRES_IN);
  
  const accessTokenExpiresAt = new Date(Date.now() + accessExpiryMs);
  const refreshTokenExpiresAt = new Date(Date.now() + refreshExpiryMs);
  
  // Store refresh token in database
  const refreshTokenData: any = {
    token: refreshToken,
    expires_at: refreshTokenExpiresAt,
    device_info: deviceInfo,
    ip_address: ipAddress,
  };
  
  // Link to user or laundry based on role
  if (payload.role === 'CUSTOMER') {
    refreshTokenData.user_id = payload.id;
  } else {
    refreshTokenData.laundry_id = payload.id;
  }
  
  await prisma.refreshToken.create({
    data: refreshTokenData,
  });
  
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  };
}

/**
 * Verify Access Token
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET, {
      issuer: 'e-laundry-api',
      audience: 'e-laundry-app',
    }) as TokenPayload & JwtPayload;
    
    if (decoded.type !== 'access') {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Verify Refresh Token
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'e-laundry-api',
      audience: 'e-laundry-app',
    }) as TokenPayload & JwtPayload;
    
    if (decoded.type !== 'refresh') {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Refresh Token Pair using Refresh Token
 */
export async function refreshTokenPair(
  refreshToken: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<TokenPair | null> {
  // Verify the refresh token
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return null;
  }
  
  // Check if token exists and is not revoked
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });
  
  if (!storedToken || storedToken.is_revoked || new Date() > storedToken.expires_at) {
    return null;
  }
  
  // Revoke the old refresh token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { is_revoked: true, revoked_at: new Date() },
  });
  
  // Generate new token pair
  return generateTokenPair(
    {
      id: decoded.id,
      phone_number: decoded.phone_number,
      role: decoded.role,
    },
    deviceInfo,
    ipAddress
  );
}

/**
 * Revoke Refresh Token (Logout)
 */
export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  try {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { is_revoked: true, revoked_at: new Date() },
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Revoke All Refresh Tokens for a User/Laundry (Logout from all devices)
 */
export async function revokeAllTokens(id: string, role: 'CUSTOMER' | 'LAUNDRY'): Promise<boolean> {
  try {
    const whereClause = role === 'CUSTOMER' 
      ? { user_id: id } 
      : { laundry_id: id };
    
    await prisma.refreshToken.updateMany({
      where: whereClause,
      data: { is_revoked: true, revoked_at: new Date() },
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): any {
  return jwt.decode(token);
}
