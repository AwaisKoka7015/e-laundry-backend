import { SetMetadata } from '@nestjs/common';

export type Role = 'CUSTOMER' | 'LAUNDRY' | 'DELIVERY_PARTNER';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
