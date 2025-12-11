# 🧺 E-Laundry Backend API

Complete Next.js 14 backend authentication system for an E-Laundry application targeting Pakistani users.

## 📚 Table of Contents

- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Authentication Flow](#authentication-flow)
- [API Endpoints](#api-endpoints)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Usage Examples](#usage-examples)
- [Testing with Swagger](#testing-with-swagger)

---

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 14** | API Routes (App Router) |
| **PostgreSQL** | Database |
| **Prisma** | ORM |
| **JWT** | Authentication (Access + Refresh tokens) |
| **Cloudinary** | Image uploads |
| **Zod** | Validation |
| **Swagger** | API Documentation |

---

## ✨ Features

- 📱 **Phone-based Authentication** (Pakistan format: +92XXXXXXXXXX)
- 🔐 **OTP Verification** (Constant 0000 for development)
- 👤 **Dual Role System** (CUSTOMER / LAUNDRY)
- 📍 **Location Management**
- 🔄 **JWT Token Refresh**
- 🖼️ **Cloudinary Image Uploads**
- 📖 **Swagger API Documentation**
- 🔒 **Secure Password-less Authentication**

---

## 📁 Project Structure

```
e-laundry-backend/
├── prisma/
│   └── schema.prisma           # Database schema
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── send-otp/route.ts
│   │   │   │   ├── verify-otp/route.ts
│   │   │   │   ├── select-role/route.ts
│   │   │   │   ├── update-location/route.ts
│   │   │   │   ├── refresh-token/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   ├── me/route.ts
│   │   │   │   └── update-profile/route.ts
│   │   │   ├── upload/
│   │   │   │   └── image/route.ts
│   │   │   └── docs/route.ts
│   │   ├── api-docs/page.tsx   # Swagger UI
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/
│   │   ├── prisma.ts           # Prisma client
│   │   ├── jwt.ts              # JWT utilities
│   │   ├── cloudinary.ts       # Cloudinary utilities
│   │   ├── auth-middleware.ts  # Auth middleware
│   │   └── swagger.ts          # Swagger spec
│   └── types/
│       └── index.ts            # TypeScript types & validators
├── .env.example
├── package.json
└── README.md
```

---

## 🗄 Database Schema

### Tables Overview

| Table | Purpose |
|-------|---------|
| `temp_accounts` | Temporary accounts (before role selection) |
| `users` | Customer accounts |
| `laundries` | Laundry service provider accounts |
| `refresh_tokens` | JWT refresh token management |
| `otp_logs` | OTP attempt tracking |

### User Table (Customers)

```prisma
model User {
  id             String        @id @default(uuid())
  phone_number   String        @unique
  name           String?
  email          String?       @unique
  avatar         String?       // Cloudinary URL
  gender         Gender?       // MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
  role           Role          @default(CUSTOMER)
  status         AccountStatus @default(PENDING_LOCATION)
  latitude       Float?
  longitude      Float?
  near_landmark  String?
  address_text   String?
  city           String?
  fcm_token      String?
  created_at     DateTime      @default(now())
  updated_at     DateTime      @updatedAt
  last_login     DateTime?
}
```

### Laundry Table

```prisma
model Laundry {
  id               String        @id @default(uuid())
  phone_number     String        @unique
  laundry_name     String?
  email            String?       @unique
  laundry_logo     String?       // Cloudinary URL
  role             Role          @default(LAUNDRY)
  status           AccountStatus @default(PENDING_LOCATION)
  latitude         Float?
  longitude        Float?
  near_landmark    String?
  address_text     String?
  city             String?
  working_hours    Json?         // { "monday": { "open": "09:00", "close": "18:00" } }
  description      String?
  rating           Float         @default(0)
  total_orders     Int           @default(0)
  total_reviews    Int           @default(0)
  services_count   Int           @default(0)
  is_verified      Boolean       @default(false)
  fcm_token        String?
  created_at       DateTime      @default(now())
  updated_at       DateTime      @updatedAt
  last_login       DateTime?
}
```

---

## 🔄 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SEND OTP                                                    │
│     POST /api/auth/send-otp                                     │
│     { "phone_number": "+923001234567" }                         │
│     ↓                                                           │
│     Response: { success: true, dev_otp: "0000" }               │
│                                                                 │
│  2. VERIFY OTP                                                  │
│     POST /api/auth/verify-otp                                   │
│     { "phone_number": "+923001234567", "otp": "0000" }          │
│     ↓                                                           │
│     NEW USER: { is_new_user: true, temp_token: "..." }         │
│     EXISTING: { access_token: "...", refresh_token: "..." }    │
│                                                                 │
│  3. SELECT ROLE (New users only)                                │
│     POST /api/auth/select-role                                  │
│     { "phone_number": "...", "role": "CUSTOMER|LAUNDRY" }       │
│     ↓                                                           │
│     Response: { access_token: "...", requires_location: true } │
│                                                                 │
│  4. UPDATE LOCATION                                             │
│     POST /api/auth/update-location                              │
│     Authorization: Bearer <access_token>                        │
│     { "latitude": 31.5204, "longitude": 74.3587 }              │
│     ↓                                                           │
│     Response: { success: true, user: {...} }                   │
│                                                                 │
│  ✅ REGISTRATION COMPLETE!                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/send-otp` | Send OTP to phone | ❌ |
| POST | `/api/auth/verify-otp` | Verify OTP | ❌ |
| POST | `/api/auth/select-role` | Select CUSTOMER/LAUNDRY | ❌ |
| POST | `/api/auth/update-location` | Update location | ✅ |
| POST | `/api/auth/refresh-token` | Refresh tokens | ❌ |
| POST | `/api/auth/logout` | Logout | ✅ |

### Profile

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/auth/me` | Get current user | ✅ |
| PUT | `/api/auth/update-profile` | Update profile | ✅ |

### Upload

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/upload/image` | Upload avatar/logo | ✅ |

### Documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/docs` | Swagger JSON |
| GET | `/api-docs` | Swagger UI |

---

## 🚀 Setup & Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Cloudinary account

### Step 1: Clone & Install

```bash
# Clone repository
git clone <repo-url>
cd e-laundry-backend

# Install dependencies
npm install
```

### Step 2: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your values
nano .env
```

### Step 3: Setup Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# (Optional) Open Prisma Studio
npx prisma studio
```

### Step 4: Run Development Server

```bash
npm run dev
```

Server will start at `http://localhost:3000`

---

## 🔧 Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/e_laundry_db"

# JWT Secrets (min 32 characters)
JWT_ACCESS_SECRET="your-super-secret-access-key-min-32-chars"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-min-32-chars"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# OTP (Development)
OTP_EXPIRY_MINUTES=5
OTP_DEFAULT_CODE="0000"
DEFAULT_COUNTRY_CODE="+92"
```

---

## 📝 Usage Examples

### 1. Send OTP

```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+923001234567"}'
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully (Development OTP: 0000)",
  "data": {
    "phone_number": "+923001234567",
    "expires_in": 300,
    "dev_otp": "0000"
  }
}
```

### 2. Verify OTP

```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+923001234567", "otp": "0000"}'
```

**Response (New User):**
```json
{
  "success": true,
  "message": "OTP verified successfully. Please select your role.",
  "data": {
    "is_new_user": true,
    "requires_role_selection": true,
    "temp_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 3. Select Role

```bash
curl -X POST http://localhost:3000/api/auth/select-role \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+923001234567", "role": "CUSTOMER"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Role selected successfully. Please update your location.",
  "data": {
    "requires_location": true,
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { ... }
  }
}
```

### 4. Update Location

```bash
curl -X POST http://localhost:3000/api/auth/update-location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -d '{"latitude": 31.5204, "longitude": 74.3587, "city": "Lahore"}'
```

### 5. Get Profile

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 6. Refresh Token

```bash
curl -X POST http://localhost:3000/api/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "eyJhbGciOiJIUzI1NiIs..."}'
```

---

## 🧪 Testing with Swagger

1. Start the development server: `npm run dev`
2. Open browser: `http://localhost:3000/api-docs`
3. Use Swagger UI to test all endpoints

### Testing Flow:

1. **Send OTP** → Copy the phone number
2. **Verify OTP** → Use phone + OTP "0000"
3. **Select Role** → Choose CUSTOMER or LAUNDRY
4. **Authorize** → Click "Authorize" button, paste access token
5. **Update Location** → Complete registration
6. **Test other endpoints** → Me, Update Profile, etc.

---

## 🔐 JWT Token Structure

### Access Token Payload
```json
{
  "id": "uuid",
  "phone_number": "+923001234567",
  "role": "CUSTOMER",
  "type": "access",
  "iat": 1234567890,
  "exp": 1234568790,
  "iss": "e-laundry-api",
  "aud": "e-laundry-app"
}
```

### Refresh Token Payload
```json
{
  "id": "uuid",
  "phone_number": "+923001234567",
  "role": "CUSTOMER",
  "type": "refresh",
  "jti": "unique-token-id",
  "iat": 1234567890,
  "exp": 1235172690,
  "iss": "e-laundry-api",
  "aud": "e-laundry-app"
}
```

---

## 📱 Flutter Integration

### Token Storage
Store tokens securely using `flutter_secure_storage`:

```dart
final storage = FlutterSecureStorage();
await storage.write(key: 'access_token', value: accessToken);
await storage.write(key: 'refresh_token', value: refreshToken);
```

### API Calls
Add Authorization header to all protected requests:

```dart
final response = await http.get(
  Uri.parse('$baseUrl/api/auth/me'),
  headers: {
    'Authorization': 'Bearer $accessToken',
    'Content-Type': 'application/json',
  },
);
```

### Token Refresh
Implement automatic token refresh on 401 errors:

```dart
if (response.statusCode == 401) {
  final newTokens = await refreshTokens();
  // Retry original request with new token
}
```

---

## 📋 Next Steps (Future Flows)

After auth is complete, implement:

1. **Dashboard** - Home screens for both roles
2. **Services** - Laundry services CRUD
3. **Orders** - Order management system
4. **Ratings** - Review and rating system
5. **Notifications** - Push notification integration
6. **Search** - Find nearby laundries
7. **Payments** - Payment integration

---

## 📄 License

MIT License

---

## 👨‍💻 Author

E-Laundry Pakistan Team
