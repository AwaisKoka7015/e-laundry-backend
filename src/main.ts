import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Security headers
  app.use(helmet());

  // Increase body size limit for file uploads (50MB)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Global exception filter and logging
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('E-Laundry API')
    .setDescription(
      `
## E-Laundry Backend API

Complete backend API for the E-Laundry application targeting Pakistani users.

### Authentication Flow:
1. **Send OTP**: User enters phone number → API sends OTP (constant 0000 for development)
2. **Verify OTP**: User verifies OTP → Creates temporary account
3. **Select Role**: User chooses CUSTOMER or LAUNDRY → Moves to appropriate table
4. **Update Location**: User submits location → Completes registration
5. **Login Complete**: JWT tokens issued (access + refresh)

### Admin Login:
- \`POST /api/admin/login\` with email + password
- All other admin endpoints require Bearer token with ADMIN role

### Token Usage:
- Access Token: Short-lived (15 min), used for API requests
- Refresh Token: Long-lived (7 days), used to get new access token
- Include access token in header: \`Authorization: Bearer <token>\`

### Order Status Flow:
\`\`\`
PENDING → ACCEPTED → PICKUP_SCHEDULED → PICKED_UP → PROCESSING → READY → OUT_FOR_DELIVERY → DELIVERED → COMPLETED
\`\`\`

### Pricing Model:
- **Per Piece**: e.g., Shirt = ₨50
- **Per KG**: e.g., Wash = ₨100/kg
- **Delivery Fee**: ₨100 (free above ₨1000)
- **Express**: +50% extra
    `,
    )
    .setVersion('2.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token',
      },
      'access-token',
    )
    .addTag('Auth', 'Authentication & device registration')
    .addTag('Admin', 'Admin panel endpoints (requires ADMIN role)')
    .addTag('Profile', 'User profile management')
    .addTag('Upload', 'File upload endpoints')
    .addTag('Categories', 'Service categories')
    .addTag('Clothing Items', 'Clothing items master data')
    .addTag('Laundry Services', 'Laundry service management')
    .addTag('Search', 'Search and discovery')
    .addTag('Orders - Customer', 'Customer order operations')
    .addTag('Orders - Laundry', 'Laundry order management')
    .addTag('Reviews', 'Reviews and ratings')
    .addTag('Dashboard', 'Dashboard and analytics')
    .addTag('Promo', 'Promotional codes')
    .addTag('Notifications', 'Push notifications')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 8000;
  await app.listen(port, '0.0.0.0');

  logger.log(`API is running on: http://localhost:${port}`);
  logger.log(`Docs available at: http://localhost:${port}/docs`);
}

bootstrap();
