import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountStatus } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  phone_number: string;
  role: 'CUSTOMER' | 'LAUNDRY' | 'DELIVERY_PARTNER';
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Verify user still exists and is active
    if (payload.role === 'CUSTOMER') {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (
        !user ||
        user.status === AccountStatus.DELETED ||
        user.status === AccountStatus.SUSPENDED
      ) {
        throw new UnauthorizedException('User not found or inactive');
      }
    } else if (payload.role === 'LAUNDRY') {
      const laundry = await this.prisma.laundry.findUnique({
        where: { id: payload.sub },
      });

      if (
        !laundry ||
        laundry.status === AccountStatus.DELETED ||
        laundry.status === AccountStatus.SUSPENDED
      ) {
        throw new UnauthorizedException('Laundry not found or inactive');
      }
    } else if (payload.role === 'DELIVERY_PARTNER') {
      const partner = await this.prisma.deliveryPartner.findUnique({
        where: { id: payload.sub },
      });

      if (!partner || partner.status === 'INACTIVE') {
        throw new UnauthorizedException('Delivery partner not found or inactive');
      }
    }

    return {
      sub: payload.sub,
      phone_number: payload.phone_number,
      role: payload.role,
      type: payload.type,
    };
  }
}
