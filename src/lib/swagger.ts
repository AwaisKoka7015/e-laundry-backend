export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'E-Laundry API',
    version: '1.0.0',
    description: `
## E-Laundry Backend API

Complete authentication and user management API for the E-Laundry application targeting Pakistani users.

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
    `,
    contact: {
      name: 'E-Laundry Support',
      email: 'support@elaundry.pk',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://api.elaundry.pk',
      description: 'Production server',
    },
  ],
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and registration endpoints',
    },
    {
      name: 'Profile',
      description: 'User profile management',
    },
    {
      name: 'Upload',
      description: 'File upload endpoints',
    },
  ],
  paths: {
    '/api/auth/send-otp': {
      post: {
        tags: ['Authentication'],
        summary: 'Send OTP to phone number',
        description: 'Initiates authentication by sending OTP to the provided phone number. For development, OTP is always 0000.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone_number'],
                properties: {
                  phone_number: {
                    type: 'string',
                    description: 'Phone number with country code',
                    example: '+923001234567',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'OTP sent successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'OTP sent successfully' },
                    data: {
                      type: 'object',
                      properties: {
                        phone_number: { type: 'string', example: '+923001234567' },
                        expires_in: { type: 'number', example: 300 },
                        dev_otp: { type: 'string', example: '0000', description: 'Only in development' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid phone number',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          429: {
            description: 'Too many OTP requests',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/auth/verify-otp': {
      post: {
        tags: ['Authentication'],
        summary: 'Verify OTP and create/login account',
        description: 'Verifies the OTP and creates a temporary account or logs in existing user.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone_number', 'otp'],
                properties: {
                  phone_number: {
                    type: 'string',
                    example: '+923001234567',
                  },
                  otp: {
                    type: 'string',
                    example: '0000',
                  },
                  device_info: {
                    type: 'string',
                    example: 'iPhone 14 Pro, iOS 17.0',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'OTP verified successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'OTP verified successfully' },
                    data: {
                      type: 'object',
                      properties: {
                        is_new_user: { type: 'boolean', example: true },
                        requires_role_selection: { type: 'boolean', example: true },
                        requires_location: { type: 'boolean', example: false },
                        temp_token: { type: 'string', description: 'Temporary token for new users' },
                        access_token: { type: 'string', description: 'For existing users' },
                        refresh_token: { type: 'string', description: 'For existing users' },
                        user: { $ref: '#/components/schemas/UserOrLaundry' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid OTP or phone number',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/auth/select-role': {
      post: {
        tags: ['Authentication'],
        summary: 'Select user role (CUSTOMER or LAUNDRY)',
        description: 'After OTP verification, user selects their role. This moves the account from temp to the appropriate table.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone_number', 'role'],
                properties: {
                  phone_number: {
                    type: 'string',
                    example: '+923001234567',
                  },
                  role: {
                    type: 'string',
                    enum: ['CUSTOMER', 'LAUNDRY'],
                    example: 'CUSTOMER',
                  },
                  temp_token: {
                    type: 'string',
                    description: 'Temporary token from verify-otp',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Role selected successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Role selected successfully' },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/UserOrLaundry' },
                        requires_location: { type: 'boolean', example: true },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid role or temp token',
          },
        },
      },
    },
    '/api/auth/update-location': {
      post: {
        tags: ['Authentication'],
        summary: 'Update user location',
        description: 'Updates user location after role selection. Completes the registration process.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['latitude', 'longitude'],
                properties: {
                  latitude: {
                    type: 'number',
                    example: 31.5204,
                  },
                  longitude: {
                    type: 'number',
                    example: 74.3587,
                  },
                  city: {
                    type: 'string',
                    example: 'Lahore',
                  },
                  address_text: {
                    type: 'string',
                    example: 'Gulberg III, Lahore',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Location updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Location updated and registration completed' },
                    data: {
                      type: 'object',
                      properties: {
                        access_token: { type: 'string' },
                        refresh_token: { type: 'string' },
                        user: { $ref: '#/components/schemas/UserOrLaundry' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/api/auth/refresh-token': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description: 'Get new access and refresh tokens using a valid refresh token.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh_token'],
                properties: {
                  refresh_token: {
                    type: 'string',
                    description: 'Valid refresh token',
                  },
                  device_info: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Tokens refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        access_token: { type: 'string' },
                        refresh_token: { type: 'string' },
                        access_token_expires_at: { type: 'string', format: 'date-time' },
                        refresh_token_expires_at: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Invalid or expired refresh token',
          },
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Logout user',
        description: 'Revokes the refresh token and logs out the user.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refresh_token: {
                    type: 'string',
                    description: 'Refresh token to revoke',
                  },
                  logout_all_devices: {
                    type: 'boolean',
                    default: false,
                    description: 'Logout from all devices',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Logged out successfully',
          },
          401: {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Profile'],
        summary: 'Get current user profile',
        description: 'Returns the profile of the authenticated user.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'User profile retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        user: { $ref: '#/components/schemas/UserOrLaundry' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/api/auth/update-profile': {
      put: {
        tags: ['Profile'],
        summary: 'Update user profile',
        description: 'Updates the profile of the authenticated user.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Ahmad Ali' },
                  email: { type: 'string', example: 'ahmad@email.com' },
                  gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] },
                  near_landmark: { type: 'string', example: 'Near Liberty Market' },
                  address_text: { type: 'string', example: 'House 123, Street 5, Gulberg' },
                  fcm_token: { type: 'string' },
                  laundry_name: { type: 'string', description: 'For laundry accounts only' },
                  working_hours: { type: 'object', description: 'For laundry accounts only' },
                  description: { type: 'string', description: 'For laundry accounts only' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Profile updated successfully',
          },
          401: {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/api/upload/image': {
      post: {
        tags: ['Upload'],
        summary: 'Upload image to Cloudinary',
        description: 'Uploads an image (avatar or laundry logo) to Cloudinary.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['image', 'type'],
                properties: {
                  image: {
                    type: 'string',
                    description: 'Base64 encoded image',
                  },
                  type: {
                    type: 'string',
                    enum: ['avatar', 'laundry_logo'],
                    example: 'avatar',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Image uploaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        url: { type: 'string', example: 'https://res.cloudinary.com/...' },
                        public_id: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Error message' },
          code: { type: 'string', example: 'ERROR_CODE' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          phone_number: { type: 'string', example: '+923001234567' },
          name: { type: 'string', example: 'Ahmad Ali' },
          email: { type: 'string', example: 'ahmad@email.com' },
          avatar: { type: 'string', example: 'https://res.cloudinary.com/...' },
          gender: { type: 'string', enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] },
          role: { type: 'string', example: 'CUSTOMER' },
          status: { type: 'string', enum: ['PENDING_ROLE', 'PENDING_LOCATION', 'ACTIVE', 'SUSPENDED', 'DELETED'] },
          latitude: { type: 'number', example: 31.5204 },
          longitude: { type: 'number', example: 74.3587 },
          near_landmark: { type: 'string', example: 'Near Liberty Market' },
          address_text: { type: 'string', example: 'House 123, Street 5, Gulberg' },
          city: { type: 'string', example: 'Lahore' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      Laundry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          phone_number: { type: 'string', example: '+923001234567' },
          laundry_name: { type: 'string', example: 'Clean & Fresh Laundry' },
          email: { type: 'string', example: 'laundry@email.com' },
          laundry_logo: { type: 'string', example: 'https://res.cloudinary.com/...' },
          role: { type: 'string', example: 'LAUNDRY' },
          status: { type: 'string', enum: ['PENDING_ROLE', 'PENDING_LOCATION', 'ACTIVE', 'SUSPENDED', 'DELETED'] },
          latitude: { type: 'number', example: 31.5204 },
          longitude: { type: 'number', example: 74.3587 },
          near_landmark: { type: 'string', example: 'Near Model Town Park' },
          address_text: { type: 'string', example: 'Shop 15, Main Boulevard, Model Town' },
          city: { type: 'string', example: 'Lahore' },
          working_hours: { type: 'object' },
          description: { type: 'string' },
          rating: { type: 'number', example: 4.5 },
          total_orders: { type: 'integer', example: 150 },
          total_reviews: { type: 'integer', example: 45 },
          services_count: { type: 'integer', example: 12 },
          is_verified: { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      UserOrLaundry: {
        oneOf: [
          { $ref: '#/components/schemas/User' },
          { $ref: '#/components/schemas/Laundry' },
        ],
      },
    },
  },
};

export default swaggerSpec;
