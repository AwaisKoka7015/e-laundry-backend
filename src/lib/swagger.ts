export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'E-Laundry API',
    version: '2.0.0',
    description: `
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
    contact: {
      name: 'E-Laundry Support',
      email: 'support@elaundry.pk',
    },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Development server' },
    { url: 'https://api.elaundry.pk', description: 'Production server' },
  ],
  tags: [
    { name: 'Authentication', description: 'User authentication and registration endpoints' },
    { name: 'Profile', description: 'User profile management' },
    { name: 'Upload', description: 'File upload endpoints' },
    { name: 'Categories', description: 'Service categories (Admin seeded)' },
    { name: 'Clothing Items', description: 'Clothing items master data' },
    { name: 'Laundry Services', description: 'Laundry service management' },
    { name: 'Search', description: 'Search and discovery' },
    { name: 'Orders - Customer', description: 'Customer order operations' },
    { name: 'Orders - Laundry', description: 'Laundry order management' },
    { name: 'Reviews', description: 'Reviews and ratings' },
    { name: 'Dashboard', description: 'Dashboard and analytics' },
    { name: 'Promo', description: 'Promotional codes' },
    { name: 'Notifications', description: 'Push notifications' },
  ],
  paths: {
    // ========== AUTHENTICATION (Existing) ==========
    '/api/auth/send-otp': {
      post: {
        tags: ['Authentication'],
        summary: 'Send OTP to phone number',
        description: 'Initiates authentication by sending OTP. For development, OTP is always 0000.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['phone_number'], properties: { phone_number: { type: 'string', example: '+923001234567' } } } } },
        },
        responses: {
          200: { description: 'OTP sent successfully', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' }, data: { type: 'object', properties: { phone_number: { type: 'string' }, expires_in: { type: 'number' }, dev_otp: { type: 'string' } } } } } } } },
          400: { description: 'Invalid phone number', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          429: { description: 'Too many OTP requests' },
        },
      },
    },
    '/api/auth/verify-otp': {
      post: {
        tags: ['Authentication'],
        summary: 'Verify OTP and create/login account',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['phone_number', 'otp'], properties: { phone_number: { type: 'string', example: '+923001234567' }, otp: { type: 'string', example: '0000' }, device_info: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'OTP verified', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { is_new_user: { type: 'boolean' }, requires_role_selection: { type: 'boolean' }, temp_token: { type: 'string' }, access_token: { type: 'string' }, refresh_token: { type: 'string' }, user: { $ref: '#/components/schemas/UserOrLaundry' } } } } } } } },
          400: { description: 'Invalid OTP' },
        },
      },
    },
    '/api/auth/select-role': {
      post: {
        tags: ['Authentication'],
        summary: 'Select user role (CUSTOMER or LAUNDRY)',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['phone_number', 'role'], properties: { phone_number: { type: 'string' }, role: { type: 'string', enum: ['CUSTOMER', 'LAUNDRY'] }, temp_token: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Role selected' }, 400: { description: 'Invalid request' } },
      },
    },
    '/api/auth/update-location': {
      post: {
        tags: ['Authentication'],
        summary: 'Update user location',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['latitude', 'longitude'], properties: { latitude: { type: 'number', example: 31.5204 }, longitude: { type: 'number', example: 74.3587 }, city: { type: 'string' }, address_text: { type: 'string' }, near_landmark: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Location updated' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/auth/refresh-token': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['refresh_token'], properties: { refresh_token: { type: 'string' }, device_info: { type: 'string' } } } } } },
        responses: { 200: { description: 'Token refreshed' }, 401: { description: 'Invalid token' } },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout user',
        security: [{ bearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { refresh_token: { type: 'string' }, logout_all_devices: { type: 'boolean' } } } } } },
        responses: { 200: { description: 'Logged out' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Profile'],
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Profile retrieved', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { user: { $ref: '#/components/schemas/UserOrLaundry' } } } } } } } }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/auth/update-profile': {
      put: {
        tags: ['Profile'],
        summary: 'Update user profile',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] }, near_landmark: { type: 'string' }, address_text: { type: 'string' }, fcm_token: { type: 'string' }, laundry_name: { type: 'string' }, working_hours: { type: 'object' }, description: { type: 'string' } } } } } },
        responses: { 200: { description: 'Profile updated' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/upload/image': {
      post: {
        tags: ['Upload'],
        summary: 'Upload image to Cloudinary',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['image', 'type'], properties: { image: { type: 'string', description: 'Base64 encoded image' }, type: { type: 'string', enum: ['avatar', 'laundry_logo', 'review'] } } } } } },
        responses: { 200: { description: 'Image uploaded', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { url: { type: 'string' }, public_id: { type: 'string' } } } } } } } }, 401: { description: 'Unauthorized' } },
      },
    },

    // ========== CATEGORIES (NEW) ==========
    '/api/categories': {
      get: {
        tags: ['Categories'],
        summary: 'List all service categories',
        description: 'Get list of all service categories (Washing, Ironing, Dry Cleaning, etc.)',
        parameters: [{ name: 'active', in: 'query', schema: { type: 'boolean', default: true } }],
        responses: { 200: { description: 'List of categories', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { categories: { type: 'array', items: { $ref: '#/components/schemas/ServiceCategory' } } } } } } } } } },
      },
    },

    // ========== CLOTHING ITEMS (NEW) ==========
    '/api/clothing-items': {
      get: {
        tags: ['Clothing Items'],
        summary: 'List all clothing items',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['MEN', 'WOMEN', 'KIDS', 'HOME'] } },
          { name: 'active', in: 'query', schema: { type: 'boolean', default: true } },
        ],
        responses: { 200: { description: 'Clothing items (grouped by type if no filter)', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { items: { type: 'object' }, total: { type: 'integer' } } } } } } } } },
      },
    },

    // ========== LAUNDRY SERVICES (NEW) ==========
    '/api/laundry/services': {
      get: {
        tags: ['Laundry Services'],
        summary: 'Get my services',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'List of services', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { services: { type: 'array', items: { $ref: '#/components/schemas/LaundryService' } } } } } } } } }, 401: { description: 'Unauthorized' } },
      },
      post: {
        tags: ['Laundry Services'],
        summary: 'Create new service',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateService' } } } },
        responses: { 201: { description: 'Service created' }, 400: { description: 'Validation error' }, 401: { description: 'Unauthorized' } },
      },
    },
    '/api/laundry/services/{id}': {
      get: { tags: ['Laundry Services'], summary: 'Get service details', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Service details' }, 404: { description: 'Not found' } } },
      put: { tags: ['Laundry Services'], summary: 'Update service', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateService' } } } }, responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } } },
      delete: { tags: ['Laundry Services'], summary: 'Delete service', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } } },
    },
    '/api/laundry/services/{id}/pricing': {
      get: { tags: ['Laundry Services'], summary: 'Get service pricing', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Pricing list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { pricing: { type: 'array', items: { $ref: '#/components/schemas/ServicePricing' } } } } } } } } } } },
      post: { tags: ['Laundry Services'], summary: 'Set bulk pricing', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BulkPricing' } } } }, responses: { 200: { description: 'Pricing updated' }, 400: { description: 'Validation error' } } },
    },

    // ========== SEARCH (NEW) ==========
    '/api/search/laundries': {
      get: {
        tags: ['Search'],
        summary: 'Search nearby laundries',
        parameters: [
          { name: 'latitude', in: 'query', required: true, schema: { type: 'number' }, example: 31.4697 },
          { name: 'longitude', in: 'query', required: true, schema: { type: 'number' }, example: 74.2728 },
          { name: 'radius_km', in: 'query', schema: { type: 'number', default: 5 } },
          { name: 'category_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'min_rating', in: 'query', schema: { type: 'number' } },
          { name: 'sort_by', in: 'query', schema: { type: 'string', enum: ['distance', 'rating', 'orders'], default: 'distance' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: { 200: { description: 'Search results', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { laundries: { type: 'array', items: { $ref: '#/components/schemas/LaundrySearchResult' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } } },
      },
    },
    '/api/laundries/{id}': {
      get: { tags: ['Search'], summary: 'Get laundry details (public)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Laundry details' }, 404: { description: 'Not found' } } },
    },
    '/api/laundries/{id}/services': {
      get: { tags: ['Search'], summary: 'Get laundry services (public)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Services with pricing' }, 404: { description: 'Not found' } } },
    },
    '/api/laundries/{id}/reviews': {
      get: { tags: ['Search'], summary: 'Get laundry reviews (public)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }], responses: { 200: { description: 'Reviews list' } } },
    },

    // ========== ORDERS - CUSTOMER (NEW) ==========
    '/api/orders': {
      get: {
        tags: ['Orders - Customer'],
        summary: 'List my orders',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: { 200: { description: 'Orders list', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { orders: { type: 'array', items: { $ref: '#/components/schemas/Order' } } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } } },
      },
      post: {
        tags: ['Orders - Customer'],
        summary: 'Place new order',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrder' } } } },
        responses: { 201: { description: 'Order created' }, 400: { description: 'Validation error' }, 404: { description: 'Laundry not found' } },
      },
    },
    '/api/orders/{id}': {
      get: { tags: ['Orders - Customer'], summary: 'Get order details', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Order details' }, 404: { description: 'Not found' } } },
    },
    '/api/orders/{id}/cancel': {
      post: {
        tags: ['Orders - Customer'],
        summary: 'Cancel order',
        description: 'Cancel order (only before PROCESSING status)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', minLength: 10, example: 'Changed my mind' } } } } } },
        responses: { 200: { description: 'Cancelled' }, 400: { description: 'Cannot cancel at this stage' }, 404: { description: 'Not found' } },
      },
    },
    '/api/orders/{id}/timeline': {
      get: { tags: ['Orders - Customer'], summary: 'Get order timeline', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Timeline events', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { timeline: { type: 'array', items: { $ref: '#/components/schemas/OrderTimeline' } } } } } } } } } } },
    },
    '/api/orders/{id}/review': {
      get: { tags: ['Reviews'], summary: 'Get order review', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Review' }, 404: { description: 'Not found' } } },
      post: { tags: ['Reviews'], summary: 'Submit review', description: 'Submit review for delivered order', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateReview' } } } }, responses: { 201: { description: 'Review submitted' }, 400: { description: 'Already reviewed or not delivered' }, 404: { description: 'Not found' } } },
    },

    // ========== ORDERS - LAUNDRY (NEW) ==========
    '/api/laundry/orders': {
      get: { tags: ['Orders - Laundry'], summary: 'List incoming orders', description: 'Use status=active for all active orders', security: [{ bearerAuth: [] }], parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }], responses: { 200: { description: 'Orders list' } } },
    },
    '/api/laundry/orders/{id}': {
      get: { tags: ['Orders - Laundry'], summary: 'Get order details', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Order with customer info' }, 404: { description: 'Not found' } } },
      put: { tags: ['Orders - Laundry'], summary: 'Update order status', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ACCEPTED', 'REJECTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'] }, notes: { type: 'string' } } } } } }, responses: { 200: { description: 'Status updated' }, 400: { description: 'Invalid transition' }, 404: { description: 'Not found' } } },
    },

    // ========== REVIEWS - LAUNDRY (NEW) ==========
    '/api/laundry/reviews': {
      get: { tags: ['Reviews'], summary: 'Get my reviews', description: 'Reviews with rating distribution', security: [{ bearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }], responses: { 200: { description: 'Reviews with distribution', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { reviews: { type: 'array', items: { $ref: '#/components/schemas/Review' } }, rating_distribution: { type: 'object' } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } } } },
    },
    '/api/laundry/reviews/{id}': {
      post: { tags: ['Reviews'], summary: 'Reply to review', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['reply'], properties: { reply: { type: 'string', minLength: 10, maxLength: 500 } } } } } }, responses: { 200: { description: 'Reply added' }, 400: { description: 'Already replied' }, 404: { description: 'Not found' } } },
    },

    // ========== DASHBOARD (NEW) ==========
    '/api/customer/dashboard': {
      get: { tags: ['Dashboard'], summary: 'Customer dashboard', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Dashboard data', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/CustomerDashboard' } } } } } } } },
    },
    '/api/laundry/dashboard': {
      get: { tags: ['Dashboard'], summary: 'Laundry dashboard', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Dashboard data', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/LaundryDashboard' } } } } } } } },
    },

    // ========== PROMO (NEW) ==========
    '/api/promo/validate': {
      post: {
        tags: ['Promo'],
        summary: 'Validate promo code',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code', 'order_amount'], properties: { code: { type: 'string', example: 'WELCOME50' }, order_amount: { type: 'number', example: 500 }, laundry_id: { type: 'string', format: 'uuid' } } } } } },
        responses: { 200: { description: 'Valid promo', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { code: { type: 'string' }, discount_type: { type: 'string' }, discount_value: { type: 'number' }, calculated_discount: { type: 'number' }, final_amount: { type: 'number' } } } } } } } }, 400: { description: 'Invalid promo' } },
      },
    },

    // ========== NOTIFICATIONS (NEW) ==========
    '/api/notifications': {
      get: { tags: ['Notifications'], summary: 'List notifications', security: [{ bearerAuth: [] }], parameters: [{ name: 'unread', in: 'query', schema: { type: 'boolean' } }, { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }], responses: { 200: { description: 'Notifications', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { notifications: { type: 'array', items: { $ref: '#/components/schemas/Notification' } }, unread_count: { type: 'integer' } } }, pagination: { $ref: '#/components/schemas/Pagination' } } } } } } } },
      post: { tags: ['Notifications'], summary: 'Mark notifications as read', security: [{ bearerAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { notification_ids: { type: 'array', items: { type: 'string', format: 'uuid' } }, mark_all: { type: 'boolean', default: false } } } } } }, responses: { 200: { description: 'Marked as read' } } },
    },
    '/api/notifications/{id}': {
      post: { tags: ['Notifications'], summary: 'Mark single notification as read', security: [{ bearerAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Marked as read' }, 404: { description: 'Not found' } } },
    },
  },

  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Enter your JWT access token' },
    },
    schemas: {
      Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, error: { type: 'string' }, code: { type: 'string' } } },
      Pagination: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, total_pages: { type: 'integer' }, has_more: { type: 'boolean' } } },
      User: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, phone_number: { type: 'string', example: '+923001234567' }, name: { type: 'string' }, email: { type: 'string' }, avatar: { type: 'string' }, gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] }, role: { type: 'string', example: 'CUSTOMER' }, status: { type: 'string', enum: ['PENDING_ROLE', 'PENDING_LOCATION', 'ACTIVE', 'SUSPENDED', 'DELETED'] }, latitude: { type: 'number' }, longitude: { type: 'number' }, near_landmark: { type: 'string' }, address_text: { type: 'string' }, city: { type: 'string' }, created_at: { type: 'string', format: 'date-time' } } },
      Laundry: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, phone_number: { type: 'string' }, laundry_name: { type: 'string' }, email: { type: 'string' }, laundry_logo: { type: 'string' }, role: { type: 'string', example: 'LAUNDRY' }, status: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' }, near_landmark: { type: 'string' }, address_text: { type: 'string' }, city: { type: 'string' }, working_hours: { type: 'object' }, description: { type: 'string' }, rating: { type: 'number', example: 4.5 }, total_orders: { type: 'integer' }, total_reviews: { type: 'integer' }, services_count: { type: 'integer' }, is_verified: { type: 'boolean' }, created_at: { type: 'string', format: 'date-time' } } },
      UserOrLaundry: { oneOf: [{ $ref: '#/components/schemas/User' }, { $ref: '#/components/schemas/Laundry' }] },
      ServiceCategory: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string', example: 'Washing' }, name_urdu: { type: 'string', example: 'دھلائی' }, icon: { type: 'string' }, description: { type: 'string' }, sort_order: { type: 'integer' }, is_active: { type: 'boolean' } } },
      ClothingItem: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, name: { type: 'string', example: 'Shirt' }, name_urdu: { type: 'string', example: 'شرٹ' }, type: { type: 'string', enum: ['MEN', 'WOMEN', 'KIDS', 'HOME'] }, icon: { type: 'string' }, sort_order: { type: 'integer' }, is_active: { type: 'boolean' } } },
      LaundryService: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, laundry_id: { type: 'string', format: 'uuid' }, category_id: { type: 'string', format: 'uuid' }, name: { type: 'string', example: 'Standard Wash' }, description: { type: 'string' }, base_price: { type: 'number', example: 50 }, price_unit: { type: 'string', enum: ['PER_PIECE', 'PER_KG'] }, estimated_hours: { type: 'integer', example: 24 }, is_available: { type: 'boolean' }, category: { $ref: '#/components/schemas/ServiceCategory' }, pricing: { type: 'array', items: { $ref: '#/components/schemas/ServicePricing' } } } },
      ServicePricing: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, laundry_service_id: { type: 'string', format: 'uuid' }, clothing_item_id: { type: 'string', format: 'uuid' }, price: { type: 'number', example: 50 }, express_price: { type: 'number', example: 75 }, price_unit: { type: 'string', enum: ['PER_PIECE', 'PER_KG'] }, is_available: { type: 'boolean' }, clothing_item: { $ref: '#/components/schemas/ClothingItem' } } },
      CreateService: { type: 'object', required: ['category_id', 'name'], properties: { category_id: { type: 'string', format: 'uuid' }, name: { type: 'string', example: 'Premium Wash' }, description: { type: 'string' }, base_price: { type: 'number', example: 100 }, price_unit: { type: 'string', enum: ['PER_PIECE', 'PER_KG'], default: 'PER_PIECE' }, estimated_hours: { type: 'integer', default: 24 }, is_available: { type: 'boolean', default: true } } },
      BulkPricing: { type: 'object', required: ['pricing'], properties: { pricing: { type: 'array', items: { type: 'object', required: ['clothing_item_id', 'price'], properties: { clothing_item_id: { type: 'string', format: 'uuid' }, price: { type: 'number' }, express_price: { type: 'number' }, price_unit: { type: 'string', enum: ['PER_PIECE', 'PER_KG'] }, is_available: { type: 'boolean', default: true } } } } } },
      LaundrySearchResult: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, laundry_name: { type: 'string' }, laundry_logo: { type: 'string' }, rating: { type: 'number', example: 4.5 }, total_reviews: { type: 'integer' }, total_orders: { type: 'integer' }, distance_km: { type: 'number', example: 2.5 }, address_text: { type: 'string' }, city: { type: 'string' }, is_verified: { type: 'boolean' }, services_preview: { type: 'array', items: { type: 'string' } }, services_count: { type: 'integer' } } },
      CreateOrder: { type: 'object', required: ['laundry_id', 'pickup_address', 'pickup_latitude', 'pickup_longitude', 'pickup_date', 'items'], properties: { laundry_id: { type: 'string', format: 'uuid' }, order_type: { type: 'string', enum: ['STANDARD', 'EXPRESS'], default: 'STANDARD' }, pickup_address: { type: 'string', example: 'House 123, Street 5, DHA Phase 6' }, pickup_latitude: { type: 'number', example: 31.4697 }, pickup_longitude: { type: 'number', example: 74.2728 }, pickup_date: { type: 'string', format: 'date-time' }, pickup_time_slot: { type: 'string', example: '09:00-11:00' }, pickup_notes: { type: 'string' }, delivery_address: { type: 'string' }, delivery_latitude: { type: 'number' }, delivery_longitude: { type: 'number' }, delivery_notes: { type: 'string' }, items: { type: 'array', minItems: 1, items: { type: 'object', required: ['service_id', 'clothing_item_id'], properties: { service_id: { type: 'string', format: 'uuid' }, clothing_item_id: { type: 'string', format: 'uuid' }, quantity: { type: 'integer', minimum: 1, default: 1 }, weight_kg: { type: 'number' }, special_notes: { type: 'string' } } } }, promo_code: { type: 'string', example: 'WELCOME50' }, special_instructions: { type: 'string' } } },
      Order: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, order_number: { type: 'string', example: 'ORD-20250115-0001' }, customer_id: { type: 'string', format: 'uuid' }, laundry_id: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'PICKUP_SCHEDULED', 'PICKED_UP', 'PROCESSING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'] }, order_type: { type: 'string', enum: ['STANDARD', 'EXPRESS'] }, pickup_address: { type: 'string' }, pickup_date: { type: 'string', format: 'date-time' }, pickup_time_slot: { type: 'string' }, delivery_address: { type: 'string' }, expected_delivery_date: { type: 'string', format: 'date-time' }, subtotal: { type: 'number' }, delivery_fee: { type: 'number' }, express_fee: { type: 'number' }, discount: { type: 'number' }, promo_code: { type: 'string' }, total_amount: { type: 'number' }, payment_status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] }, payment_method: { type: 'string', enum: ['COD', 'JAZZCASH', 'EASYPAISA', 'CARD'] }, items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } }, customer: { $ref: '#/components/schemas/User' }, laundry: { $ref: '#/components/schemas/Laundry' }, created_at: { type: 'string', format: 'date-time' } } },
      OrderItem: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, clothing_item: { $ref: '#/components/schemas/ClothingItem' }, quantity: { type: 'integer' }, weight_kg: { type: 'number' }, unit_price: { type: 'number' }, price_unit: { type: 'string' }, total_price: { type: 'number' } } },
      OrderTimeline: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, event: { type: 'string', example: 'ORDER_PLACED' }, title: { type: 'string', example: 'Order Placed' }, description: { type: 'string' }, icon: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' } } },
      CreateReview: { type: 'object', required: ['rating'], properties: { rating: { type: 'number', minimum: 1, maximum: 5, example: 4.5 }, comment: { type: 'string' }, service_rating: { type: 'number', minimum: 1, maximum: 5 }, delivery_rating: { type: 'number', minimum: 1, maximum: 5 }, value_rating: { type: 'number', minimum: 1, maximum: 5 }, images: { type: 'array', items: { type: 'string' }, maxItems: 5 } } },
      Review: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, order_id: { type: 'string', format: 'uuid' }, customer_id: { type: 'string', format: 'uuid' }, laundry_id: { type: 'string', format: 'uuid' }, rating: { type: 'number' }, comment: { type: 'string' }, service_rating: { type: 'number' }, delivery_rating: { type: 'number' }, value_rating: { type: 'number' }, images: { type: 'array', items: { type: 'string' } }, laundry_reply: { type: 'string' }, replied_at: { type: 'string', format: 'date-time' }, customer: { $ref: '#/components/schemas/User' }, created_at: { type: 'string', format: 'date-time' } } },
      Notification: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, type: { type: 'string', enum: ['ORDER_UPDATE', 'PROMO', 'SYSTEM', 'REVIEW', 'WELCOME'] }, title: { type: 'string' }, body: { type: 'string' }, data: { type: 'object' }, is_read: { type: 'boolean' }, created_at: { type: 'string', format: 'date-time' } } },
      CustomerDashboard: { type: 'object', properties: { active_orders: { type: 'integer' }, completed_orders: { type: 'integer' }, total_spent: { type: 'number' }, favorite_laundry: { type: 'object', properties: { id: { type: 'string' }, laundry_name: { type: 'string' }, laundry_logo: { type: 'string' }, orders_count: { type: 'integer' } } }, recent_orders: { type: 'array', items: { $ref: '#/components/schemas/Order' } }, unread_notifications: { type: 'integer' } } },
      LaundryDashboard: { type: 'object', properties: { today: { type: 'object', properties: { new_orders: { type: 'integer' }, completed_orders: { type: 'integer' }, revenue: { type: 'number' }, pending_pickups: { type: 'integer' } } }, this_week: { type: 'object', properties: { total_orders: { type: 'integer' }, revenue: { type: 'number' }, new_customers: { type: 'integer' } } }, this_month: { type: 'object', properties: { total_orders: { type: 'integer' }, revenue: { type: 'number' } } }, overview: { type: 'object', properties: { rating: { type: 'number' }, total_reviews: { type: 'integer' }, total_orders: { type: 'integer' }, services_count: { type: 'integer' } } }, pending_actions: { type: 'object', properties: { pending_orders: { type: 'integer' }, ready_for_delivery: { type: 'integer' } } }, recent_orders: { type: 'array', items: { $ref: '#/components/schemas/Order' } }, unread_notifications: { type: 'integer' } } },
    },
  },
};

export default swaggerSpec;
