import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, TokenPayload } from './jwt';
import prisma from './prisma';

export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload;
}

export interface AuthResult {
  success: boolean;
  user?: TokenPayload;
  error?: string;
  status?: number;
}

/**
 * Verify authentication from request headers
 */
export async function verifyAuth(request: NextRequest): Promise<AuthResult> {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return {
        success: false,
        error: 'Authorization header missing',
        status: 401,
      };
    }
    
    // Check Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Invalid authorization format. Use: Bearer <token>',
        status: 401,
      };
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      return {
        success: false,
        error: 'Token not provided',
        status: 401,
      };
    }
    
    // Verify the token
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return {
        success: false,
        error: 'Invalid or expired token',
        status: 401,
      };
    }
    
    // Verify user/laundry exists and is active
    if (decoded.role === 'CUSTOMER') {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, status: true },
      });
      
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          status: 404,
        };
      }
      
      if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
        return {
          success: false,
          error: 'Account is suspended or deleted',
          status: 403,
        };
      }
    } else if (decoded.role === 'LAUNDRY') {
      const laundry = await prisma.laundry.findUnique({
        where: { id: decoded.id },
        select: { id: true, status: true },
      });
      
      if (!laundry) {
        return {
          success: false,
          error: 'Laundry not found',
          status: 404,
        };
      }
      
      if (laundry.status === 'SUSPENDED' || laundry.status === 'DELETED') {
        return {
          success: false,
          error: 'Account is suspended or deleted',
          status: 403,
        };
      }
    }
    
    return {
      success: true,
      user: decoded,
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      status: 500,
    };
  }
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'UNAUTHORIZED',
    },
    { status: 401 }
  );
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'FORBIDDEN',
    },
    { status: 403 }
  );
}

/**
 * Higher-order function for protected routes
 */
export function withAuth(
  handler: (request: NextRequest, user: TokenPayload) => Promise<NextResponse>,
  allowedRoles?: ('CUSTOMER' | 'LAUNDRY')[]
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await verifyAuth(request);
    
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Unauthorized',
          code: 'UNAUTHORIZED',
        },
        { status: authResult.status || 401 }
      );
    }
    
    // Check role if specified
    if (allowedRoles && !allowedRoles.includes(authResult.user.role)) {
      return forbiddenResponse('You do not have permission to access this resource');
    }
    
    return handler(request, authResult.user);
  };
}

/**
 * Get user info from token
 */
export async function getUserFromToken(request: NextRequest): Promise<TokenPayload | null> {
  const authResult = await verifyAuth(request);
  return authResult.success ? authResult.user || null : null;
}
