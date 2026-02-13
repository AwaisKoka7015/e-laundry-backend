import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    // Check if already initialized
    if (admin.apps.length > 0) {
      this.logger.log('Firebase already initialized');
      return;
    }

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not found. Firebase features will be disabled.');
      return;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // Handle escaped newlines in private key
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      this.logger.log('Firebase initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase:', error);
    }
  }

  /**
   * Verify Firebase ID token and extract user info
   * @param idToken - Firebase ID token from mobile app
   * @returns Decoded token with phone number
   */
  async verifyIdToken(idToken: string): Promise<{
    uid: string;
    phone_number: string;
  }> {
    if (admin.apps.length === 0) {
      throw new Error('Firebase not initialized');
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);

    if (!decodedToken.phone_number) {
      throw new Error('Phone number not found in token');
    }

    return {
      uid: decodedToken.uid,
      phone_number: decodedToken.phone_number,
    };
  }

  /**
   * Check if Firebase is properly initialized
   */
  isInitialized(): boolean {
    return admin.apps.length > 0;
  }

  /**
   * Get Firebase Auth instance for advanced operations
   */
  getAuth() {
    if (admin.apps.length === 0) {
      throw new Error('Firebase not initialized');
    }
    return admin.auth();
  }

  /**
   * Send push notification to a single device
   * @param fcmToken - Device FCM token
   * @param title - Notification title
   * @param body - Notification body
   * @param data - Additional data payload
   */
  async sendPushNotification(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isInitialized()) {
      this.logger.warn('Firebase not initialized, skipping push notification');
      return { success: false, error: 'Firebase not initialized' };
    }

    if (!fcmToken) {
      this.logger.warn('No FCM token provided, skipping push notification');
      return { success: false, error: 'No FCM token provided' };
    }

    try {
      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'order_updates',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Push notification sent successfully: ${response}`);
      return { success: true, messageId: response };
    } catch (error) {
      this.logger.error('Failed to send push notification:', error);

      // Handle invalid token - token might be expired or unregistered
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        return { success: false, error: 'Invalid or expired FCM token' };
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification to multiple devices
   * @param fcmTokens - Array of FCM tokens
   * @param title - Notification title
   * @param body - Notification body
   * @param data - Additional data payload
   */
  async sendPushNotificationToMultiple(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.isInitialized()) {
      this.logger.warn('Firebase not initialized, skipping push notifications');
      return { successCount: 0, failureCount: fcmTokens.length };
    }

    const validTokens = fcmTokens.filter(token => token && token.length > 0);
    if (validTokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: validTokens,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'order_updates',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(`Push notifications sent: ${response.successCount} success, ${response.failureCount} failed`);
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      this.logger.error('Failed to send multicast push notifications:', error);
      return { successCount: 0, failureCount: validTokens.length };
    }
  }
}
