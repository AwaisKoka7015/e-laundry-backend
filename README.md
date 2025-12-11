# E-Laundry Backend - NestJS

Complete backend API for the E-Laundry application targeting Pakistani users.

## Tech Stack

- **Framework**: NestJS 10
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (Access + Refresh tokens)
- **File Storage**: Cloudinary
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator + class-transformer

## Features

### Phase 1 - Authentication
- ✅ Phone-based OTP authentication (Pakistan format)
- ✅ Role selection (CUSTOMER / LAUNDRY)
- ✅ Location-based registration
- ✅ JWT token management (access + refresh)
- ✅ Profile management
- ✅ Image uploads to Cloudinary

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

## Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts           # Root module
├── prisma/                 # Database service
├── common/                 # Shared utilities
│   ├── decorators/         # Custom decorators
│   ├── guards/             # Auth guards
│   ├── filters/            # Exception filters
│   ├── interceptors/       # Response interceptors
│   └── dto/                # Common DTOs
├── auth/                   # Authentication module
├── users/                  # Customer management
├── laundries/              # Laundry management
├── categories/             # Service categories
├── clothing-items/         # Clothing items master
├── services/               # Laundry services
├── search/                 # Search & discovery
├── orders/                 # Order management
├── reviews/                # Reviews & ratings
├── dashboard/              # Analytics dashboards
├── promo/                  # Promo codes
├── notifications/          # Notifications
└── upload/                 # File uploads
```

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Setup

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd e-laundry-backend
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
- API: http://localhost:3000/api
- Swagger Docs: http://localhost:3000/docs

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/elaundry"

# JWT
JWT_SECRET="your-secret-key"
JWT_ACCESS_EXPIRATION="15m"
JWT_REFRESH_EXPIRATION="7d"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud"
CLOUDINARY_API_KEY="your-key"
CLOUDINARY_API_SECRET="your-secret"

# App
NODE_ENV="development"
PORT=3000
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/send-otp | Send OTP to phone |
| POST | /api/auth/verify-otp | Verify OTP |
| POST | /api/auth/select-role | Select user role |
| POST | /api/auth/update-location | Update location |
| POST | /api/auth/refresh-token | Refresh access token |
| POST | /api/auth/logout | Logout user |
| GET | /api/auth/me | Get current user |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | /api/auth/update-profile | Update profile |

### Categories & Items
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/categories | List categories |
| GET | /api/clothing-items | List clothing items |

### Laundry Services
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/laundry/services | Get my services |
| POST | /api/laundry/services | Create service |
| GET | /api/laundry/services/:id | Get service |
| PUT | /api/laundry/services/:id | Update service |
| DELETE | /api/laundry/services/:id | Delete service |
| GET | /api/laundry/services/:id/pricing | Get pricing |
| POST | /api/laundry/services/:id/pricing | Set bulk pricing |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/search/laundries | Search nearby laundries |
| GET | /api/laundries/:id | Get laundry details |
| GET | /api/laundries/:id/services | Get laundry services |
| GET | /api/laundries/:id/reviews | Get laundry reviews |

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

### Promo & Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/promo/validate | Validate promo code |
| GET | /api/notifications | Get notifications |
| POST | /api/notifications | Mark as read |
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

## Development Notes

### OTP for Development
- OTP is always `0000` in development mode
- In production, integrate with SMS service

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

## Scripts

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod

# Database
npm run prisma:generate   # Generate Prisma client
npm run prisma:migrate    # Run migrations
npm run prisma:seed       # Seed database
npm run prisma:studio     # Open Prisma Studio
npm run db:reset          # Reset and reseed

# Testing
npm run test
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

## Contributing

1. Create feature branch
2. Make changes
3. Run tests and linting
4. Submit pull request

## License

MIT
