# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Development server (hot reload)
npm run start:dev

# Production build and start
npm run build
npm run start:prod

# Database operations
npm run prisma:generate   # Generate Prisma client (required after schema changes)
npm run prisma:migrate    # Run migrations in dev
npm run prisma:migrate:prod # Run migrations in prod
npm run prisma:seed       # Seed database with initial data
npm run prisma:studio     # Open Prisma Studio GUI
npm run db:reset          # Reset and reseed database

# Testing
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:e2e          # E2E tests
npm run test -- --testPathPattern=auth  # Run specific test file

# Linting
npm run lint              # ESLint with auto-fix
npm run format            # Prettier formatting
```

## Architecture Overview

This is a NestJS 10 backend for an E-Laundry mobile app targeting Pakistani users. It uses PostgreSQL with Prisma ORM.

### Module Structure

The app follows NestJS modular architecture. Each feature is a module with its own controller, service, and DTOs:

- **PrismaModule**: Global database service, injected into all modules
- **AuthModule**: Phone-based OTP authentication, JWT tokens (access + refresh), Firebase Phone Auth for production
- **FirebaseModule**: Firebase Admin SDK for FCM push notifications and phone auth verification
- **UsersModule/LaundriesModule**: Separate tables and logic for customers vs laundry providers
- **ServicesModule**: Laundry services with per-item pricing (ServicePricing model)
- **OrdersModule**: Order workflow with status state machine
- **AdminModule**: Admin-only endpoints under `/api/admin/`
- **SchedulerModule**: Cron jobs (e.g., laundry auto-approval)

### Authentication Pattern

- JWT strategy in `src/auth/strategies/jwt.strategy.ts`
- `JwtAuthGuard` applied globally via `APP_GUARD`
- Use `@Public()` decorator for unauthenticated endpoints
- Use `@Roles('CUSTOMER')`, `@Roles('LAUNDRY')`, or `@Roles('ADMIN')` for role-based access
- `@CurrentUser()` decorator extracts user payload from JWT

### Key Decorators (src/common/decorators/)

- `@Public()`: Bypasses authentication
- `@Roles(Role[])`: Requires specific roles
- `@CurrentUser()`: Injects authenticated user payload (sub, phone_number, role)

### Database Schema Patterns

- **Dual-entity auth**: `User` table for customers, `Laundry` table for laundry providers (separate tables, not inheritance)
- **RefreshToken**: Polymorphic relation supporting User, Laundry, or DeliveryPartner
- **Service pricing**: `LaundryService` → `ServicePricing` → `ClothingItem` (per-item pricing)
- **Order flow**: Order → OrderItem, OrderStatusHistory, OrderTimeline

### Order Status State Machine

```
PENDING → ACCEPTED → PICKUP_SCHEDULED → PICKED_UP → PROCESSING → READY → OUT_FOR_DELIVERY → DELIVERED → COMPLETED
    ↓         ↓             ↓                ↓
REJECTED  CANCELLED     CANCELLED        CANCELLED
```

### Path Aliases (tsconfig.json)

- `@/*` → `src/*`
- `@common/*` → `src/common/*`
- `@config/*` → `src/config/*`
- `@prisma/*` → `src/prisma/*`

### Testing

Tests use Jest with mock factories in `src/common/testing/`:
- `createMockPrismaService()`: Mocked Prisma client
- `createMockJwtService()`: Mocked JWT service

Test files are colocated with source: `*.spec.ts`

### Environment

- OTP is always `0000` in development mode (NODE_ENV=development)
- Default port: 8000
- API prefix: `/api`
- Swagger docs: `/docs`
