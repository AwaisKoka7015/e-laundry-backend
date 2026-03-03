# CleanZo Backend - NestJS

Complete backend API for the CleanZo application targeting Pakistani users.

## Tech Stack

- **Framework**: NestJS 10
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (Access + Refresh tokens)
- **File Storage**: Cloudinary
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator + class-transformer
- **Scheduling**: @nestjs/schedule for cron jobs

## Features

### Phase 1 - Authentication
- ✅ Phone-based OTP authentication (Pakistan format)
- ✅ Firebase Phone Auth integration (production)
- ✅ Role selection (CUSTOMER / LAUNDRY)
- ✅ Location-based registration
- ✅ JWT token management (access + refresh)
- ✅ Profile management
- ✅ Image uploads to Cloudinary
- ✅ FCM device registration for push notifications

### Phase 2 - Core Features
- ✅ Service categories & clothing items
- ✅ Laundry service management with pricing
- ✅ Nearby laundry search (distance-based)
- ✅ Order placement & management
- ✅ Order status workflow
- ✅ Reviews & ratings
- ✅ Customer & Laundry dashboards
- ✅ Promo code validation
- ✅ Notifications system

### Phase 3 - Push Notifications
- ✅ FCM token registration/unregistration
- ✅ Automatic push on order status changes
- ✅ New order notifications for laundries
- ✅ Order cancellation notifications
- ✅ In-app notification storage & retrieval

### Admin Features
- ✅ User management (suspend/activate/delete)
- ✅ Laundry management (verify/block/approve)
- ✅ Order management (status updates)
- ✅ Category & clothing item CRUD
- ✅ Promo code management
- ✅ Review moderation
- ✅ Dashboard analytics
- ✅ App settings management
- ✅ Bulk notification sending

## Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts           # Root module
├── prisma/                 # Database service
├── common/                 # Shared utilities
│   ├── decorators/         # Custom decorators (@CurrentUser, @Roles, @Public)
│   ├── guards/             # Auth guards (JwtAuthGuard, RolesGuard)
│   ├── filters/            # Exception filters
│   ├── interceptors/       # Response interceptors
│   └── dto/                # Common DTOs (pagination)
├── auth/                   # Authentication module
├── users/                  # Customer management
├── laundries/              # Laundry management
├── categories/             # Service categories
├── clothing-items/         # Clothing items master
├── services/               # Laundry services & pricing
├── search/                 # Search & discovery
├── orders/                 # Order management
├── reviews/                # Reviews & ratings
├── dashboard/              # Analytics dashboards
├── promo/                  # Promo codes
├── notifications/          # Push & in-app notifications
├── upload/                 # File uploads (Cloudinary)
├── firebase/               # Firebase Admin SDK (FCM, Auth)
├── scheduler/              # Cron jobs (laundry auto-approval)
└── admin/                  # Admin panel APIs
```

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn
- Firebase project (for push notifications)

### Setup

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd cleanzo-backend
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Setup database**
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database with initial data
npm run prisma:seed
```

4. **Start development server**
```bash
npm run start:dev
```

5. **Access the API**
- API: http://localhost:8000/api
- Swagger Docs: http://localhost:8000/docs

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/cleanzo"

# JWT
JWT_ACCESS_SECRET="your-super-secret-jwt-key"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud"
CLOUDINARY_API_KEY="your-key"
CLOUDINARY_API_SECRET="your-secret"

# Firebase (for push notifications & phone auth)
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# App
NODE_ENV="development"
PORT=8000

# Laundry Auto-Approval (minutes)
LAUNDRY_AUTO_APPROVE_MINUTES=1  # Dev: 1, Prod: 120
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/send-otp | Send OTP to phone |
| POST | /api/auth/verify-otp | Verify OTP |
| POST | /api/auth/firebase | Firebase phone auth |
| POST | /api/auth/select-role | Select user role |
| POST | /api/auth/update-location | Update location |
| POST | /api/auth/refresh-token | Refresh access token |
| POST | /api/auth/logout | Logout user |
| GET | /api/auth/me | Get current user |
| GET | /api/auth/status | Get account status |

### Device Registration (Push Notifications)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register-device | Register FCM token |
| POST | /api/auth/unregister-device | Remove FCM token |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | /api/auth/update-profile | Update profile |

### Categories & Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/categories | List categories |
| GET | /api/clothing-items | List clothing items |

### Laundries (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/laundries | List active laundries |
| GET | /api/laundries/nearby | Find nearby laundries |
| GET | /api/laundries/top-rated | Top rated laundries |
| GET | /api/laundries/:id | Get laundry details |
| GET | /api/laundries/:id/services | Get laundry services |
| GET | /api/laundries/:id/reviews | Get laundry reviews |

### Laundry Services (Laundry Role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/laundry/services | Get my services |
| POST | /api/laundry/services | Create service |
| GET | /api/laundry/services/:id | Get service |
| PUT | /api/laundry/services/:id | Update service |
| DELETE | /api/laundry/services/:id | Delete service |
| GET | /api/laundry/services/:id/pricing | Get pricing |
| POST | /api/laundry/services/:id/pricing | Set bulk pricing |
| PATCH | /api/laundry/toggle-open | Toggle shop open/close |

### Orders - Customer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/orders | List my orders |
| POST | /api/orders | Place order |
| GET | /api/orders/:id | Get order details |
| POST | /api/orders/:id/cancel | Cancel order |
| GET | /api/orders/:id/timeline | Get order timeline |

### Orders - Laundry
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/laundry/orders | List incoming orders |
| GET | /api/laundry/orders/:id | Get order details |
| PUT | /api/laundry/orders/:id | Update order status |

### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/orders/:id/review | Get order review |
| POST | /api/orders/:id/review | Create review |
| GET | /api/laundry/reviews | Get my reviews |
| POST | /api/laundry/reviews/:id | Reply to review |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/customer/dashboard | Customer dashboard |
| GET | /api/laundry/dashboard | Laundry dashboard |

### Promo Codes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/promo/validate | Validate promo code |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/notifications | Get my notifications |
| POST | /api/notifications | Mark multiple as read |
| POST | /api/notifications/:id | Mark single as read |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/upload/image | Upload image |

## Order Status Flow

```
PENDING → ACCEPTED → PICKUP_SCHEDULED → PICKED_UP → PROCESSING → READY → OUT_FOR_DELIVERY → DELIVERED → COMPLETED
    ↓         ↓             ↓                ↓
REJECTED  CANCELLED     CANCELLED        CANCELLED
```

**Push notifications are sent automatically at each status change.**

## Push Notifications

### Setup (Mobile App)

1. **Integrate Firebase SDK** in your mobile app
2. **Get FCM Token** after user authentication:
   ```kotlin
   // Android
   FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
       // Send to backend
   }
   ```
   ```swift
   // iOS
   Messaging.messaging().token { token, error in
       // Send to backend
   }
   ```

3. **Register device** with backend:
   ```bash
   POST /api/auth/register-device
   Authorization: Bearer <access_token>
   Content-Type: application/json

   { "fcm_token": "your-fcm-token" }
   ```

### Notification Types

| Type | Trigger | Recipient |
|------|---------|-----------|
| `ORDER_UPDATE` | Status change | Customer |
| `NEW_ORDER` | Order placed | Laundry |
| `ORDER_CANCELLED` | Customer cancels | Laundry |
| `PROMO` | Admin sends | Users |
| `SYSTEM` | Admin sends | All |
| `WELCOME` | Registration | New user |

### Status Change Messages

| Status | Customer Notification |
|--------|----------------------|
| ACCEPTED | "Order Accepted ✅ - Your order has been accepted!" |
| PICKED_UP | "Clothes Picked Up 🚚 - Your clothes have been picked up" |
| PROCESSING | "Processing Started 🧺 - Your order is being cleaned" |
| READY | "Ready for Delivery 📦 - Your order is ready!" |
| OUT_FOR_DELIVERY | "Out for Delivery 🚗 - Your order is on the way!" |
| DELIVERED | "Delivered ✨ - Your order has been delivered!" |
| COMPLETED | "Order Completed 🎉 - Please rate your experience!" |

## Development Notes

### OTP for Development
- OTP is always `0000` in development mode
- In production, use Firebase Phone Auth

### Pricing Model
- **Per Piece**: Fixed price per item (e.g., Shirt = ₨50)
- **Per KG**: Price by weight (e.g., Wash = ₨100/kg)
- **Express**: +50% of base price
- **Delivery**: ₨100 (free above ₨1000)

### Seed Data
The seed script creates:
- 8 service categories
- 77 clothing items (MEN/WOMEN/KIDS/HOME)
- 3 promo codes (WELCOME50, FIRST100, FLAT20)
- 6 app settings

### Laundry Auto-Approval
- Laundries are auto-approved after setup by admin
- Configurable via `LAUNDRY_AUTO_APPROVE_MINUTES`
- Cron job runs every minute to check pending laundries

## Scripts

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod

# Database
npm run prisma:generate   # Generate Prisma client
npm run prisma:migrate    # Run migrations (dev)
npm run prisma:migrate:prod # Run migrations (prod)
npm run prisma:seed       # Seed database
npm run prisma:studio     # Open Prisma Studio
npm run db:reset          # Reset and reseed

# Testing
npm run test
npm run test:watch
npm run test:e2e
npm run test:cov

# Linting
npm run lint
npm run format
```

## Production Deployment

1. Build the application:
```bash
npm run build
```

2. Set production environment variables

3. Run migrations:
```bash
npm run prisma:migrate:prod
```

4. Start the server:
```bash
npm run start:prod
```

## Admin Panel

A separate React admin panel is available at `cleanzo-admin/`.

**Admin API Endpoints:** All under `/api/admin/`
- Dashboard & analytics
- User management
- Laundry management & approval
- Order management
- Category & item management
- Promo code management
- Review moderation
- Notification sending
- App settings

## Contributing

1. Create feature branch
2. Make changes
3. Run tests and linting
4. Submit pull request

## License

MIT
