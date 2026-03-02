# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install                        # Install dependencies
npm run start:dev                  # Development server (hot reload)
npm run build && npm run start:prod  # Production build + run (build also runs prisma:generate)

# Database
npm run prisma:generate            # Generate Prisma client (required after schema changes)
npm run prisma:migrate             # Run migrations (dev)
npm run prisma:migrate:prod        # Run migrations (prod)
npm run prisma:seed                # Seed initial data
npm run prisma:studio              # Prisma Studio GUI
npm run db:reset                   # Reset and reseed database

# Testing
npm run test                       # Run all tests
npm run test:watch                 # Watch mode
npm run test:e2e                   # E2E tests
npm run test -- --testPathPattern=auth  # Run specific test file

# Linting
npm run lint                       # ESLint with auto-fix
npm run format                     # Prettier formatting
```

## Architecture Overview

NestJS 10 backend for an E-Laundry marketplace (Pakistani users). PostgreSQL with Prisma ORM. Schema at `prisma/schema.prisma`.

### Global Infrastructure (main.ts + app.module.ts)

All set up globally — individual modules don't need to configure these:

- **AllExceptionsFilter**: Errors → `{ success: false, error: "message", code: "ERROR_CODE" }` (+ `stack` in dev)
- **TransformInterceptor**: Success → `{ success: true, data: ... }`. Pass-through if response already has `success`
- **LoggingInterceptor**: Logs `METHOD URL STATUS_CODE DURATION_MS`
- **ValidationPipe**: `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — unknown DTO fields are rejected
- **ThrottlerGuard**: 100 req/60s globally (applied via `APP_GUARD`)
- **CacheModule**: In-memory, 5-min TTL
- **JwtAuthGuard**: Applied globally via `APP_GUARD` — all endpoints require auth unless `@Public()`
- CORS, Helmet, 50mb body limit, API prefix `/api`, Swagger at `/docs`

### Path Aliases (tsconfig.json)

- `@/*` → `src/*`
- `@common/*` → `src/common/*`
- `@config/*` → `src/config/*`
- `@prisma/*` → `src/prisma/*`

Always use these aliases, not relative paths.

### Authentication

**Decorators** (in `src/common/decorators/`):
- `@Public()` — bypasses JWT auth
- `@Roles('CUSTOMER' | 'LAUNDRY' | 'DELIVERY_PARTNER' | 'ADMIN')` — role-based access
- `@CurrentUser()` — injects JWT payload; supports field extraction: `@CurrentUser('sub')`

**JWT Payload**:
```typescript
{ sub: string, phone_number: string, role: Role, type: 'access' | 'refresh' }
```

**JWT Strategy Validation** (`src/auth/strategies/jwt.strategy.ts`):
1. Rejects refresh tokens (only `type: 'access'` accepted)
2. Polymorphic entity lookup based on `role`:
   - CUSTOMER → `User` table, rejects DELETED/SUSPENDED
   - LAUNDRY → `Laundry` table, rejects DELETED/SUSPENDED
   - DELIVERY_PARTNER → `DeliveryPartner` table, rejects INACTIVE
   - ADMIN → `User` table with `role === 'ADMIN'`

**Dual-Entity Auth Model**:
- `TempAccount` stores phone + OTP during verification
- After role selection, entity created in `users`, `laundries`, or `delivery_partners`
- `RefreshToken` is polymorphic: nullable `user_id | laundry_id | delivery_partner_id` (only one set per token)
- Same polymorphic pattern used for `Notification` table

### Order System

**Status State Machine** (`src/orders/orders.service.ts`):
```
PENDING → ACCEPTED → PICKUP_SCHEDULED → PICKED_UP → PROCESSING → READY → OUT_FOR_DELIVERY → DELIVERED → COMPLETED
    ↓         ↓             ↓                ↓
REJECTED  CANCELLED     CANCELLED        CANCELLED
```

**Self-drop-off exception**: Orders with `pickup_type: SELF_DROP_OFF` can skip pickup steps — `ACCEPTED → PROCESSING` is allowed directly.

**Cancellable statuses**: PENDING, ACCEPTED, PICKUP_SCHEDULED, PICKED_UP only.

**Order number format**: `ORD-YYYYMMDD-XXXX` (daily counter, auto-incremented).

**Pricing calculation** (in `createOrder`):
1. Looks up `LaundryPricing` (not ServicePricing) for each item — must be `is_active: true`
2. Item price = `pricing.price * quantity`
3. Express surcharge: items priced at `price * 1.5`, plus `express_fee = subtotal * 0.5`
4. Delivery fee: 100 PKR (free if `laundry.free_pickup_delivery` or subtotal >= 1000)
5. Promo discount applied last (PERCENTAGE or FIXED, with `max_discount` cap)
6. Total = `subtotal + delivery_fee + express_fee - discount`

**Side effects on order creation**: OrderTimeline entry, OrderStatusHistory, Payment record (COD/PENDING), push notification to laundry.

**Status update side effects** (`updateOrderStatus`):
- DELIVERED: sets `actual_delivery_date`
- COMPLETED: marks payment COMPLETED + `paid_at`, calls `updateLaundryStats()`
- REJECTED: stores `cancellation_reason`, `cancelled_at`, `cancelled_by = 'LAUNDRY'`
- All transitions: OrderStatusHistory + OrderTimeline + push notification to customer

### Pricing Hierarchy

Three levels, from base to laundry-specific:

1. **DefaultPrice** (admin-seeded) — `clothing_item_id + service_category_id → price`
2. **LaundryPricing** (per-laundry, auto-generated at onboarding Step 3 from DefaultPrice) — **this is what order creation uses**
3. **ServicePricing** (per-service within a laundry) — used for display, not order calculation

### Laundry Onboarding

- `setup_step` (0–5) + `setup_complete` boolean
- `verification_status`: NOT_SUBMITTED → PENDING_REVIEW → APPROVED | REJECTED
- CNIC images stored in Cloudinary for verification
- Auto-approval cron in `SchedulerModule` (1 min dev, 120 min prod)

### Common Utilities (`src/common/`)

- **DTOs**: `PaginationQueryDto` (page default 1, limit default 10, max 100), `ResponseDto<T>`
- **Guards**: `RolesGuard` — checks `@Roles()` metadata, respects `@Public()`
- **Testing**: `createMockPrismaService()`, `createMockJwtService()` in `src/common/testing/`
- Test files colocated with source: `*.spec.ts`

### Key Endpoint Patterns

```
# Customer order endpoints
POST /api/checkout              # Create order
GET  /api/orders                # List customer orders (paginated)
GET  /api/orders/:id            # Order details
POST /api/orders/:id/cancel     # Cancel order
POST /api/orders/:id/confirm-delivery  # Confirm delivery

# Laundry order endpoints
GET  /api/laundry/orders        # List laundry's orders
GET  /api/laundry/orders/:id    # Order details
PUT  /api/laundry/orders/:id    # Update order status
```

### Environment

- OTP always `0000` in development (`NODE_ENV=development`)
- Default port: 8000
- Swagger docs: `http://localhost:8000/docs`
- Seed data: 8 categories, 77 clothing items, promo codes (WELCOME50, FIRST100, FLAT20)
