import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase body size limit for file uploads (50MB)
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

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
    .addTag('Auth', 'Authentication endpoints')
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

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀API is running on: http://localhost:${port}`);
  console.log(`📚 docs available at: http://localhost:${port}/docs`);
}

bootstrap();
