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
      this.logger.warn(
        'Firebase credentials not found. Firebase features will be disabled.',
      );
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
}
