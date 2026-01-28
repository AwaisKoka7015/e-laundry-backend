import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AccountStatus } from '@prisma/client';

@Injectable()
export class LaundryAutoApprovalService {
  private readonly logger = new Logger(LaundryAutoApprovalService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Runs every minute to check for laundries that should be auto-approved
   * Auto-approves laundries that have been pending for longer than LAUNDRY_AUTO_APPROVE_MINUTES
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoApproval() {
    const autoApproveMinutes = parseInt(process.env.LAUNDRY_AUTO_APPROVE_MINUTES || '120', 10);
    const cutoffTime = new Date(Date.now() - autoApproveMinutes * 60 * 1000);

    this.logger.debug(
      `Checking for laundries to auto-approve (pending since before ${cutoffTime.toISOString()})`,
    );

    try {
      // Find laundries that are pending and created before the cutoff time
      const pendingLaundries = await this.prisma.laundry.findMany({
        where: {
          OR: [
            { status: AccountStatus.PENDING_LOCATION },
            { status: AccountStatus.PENDING_ROLE },
          ],
          created_at: { lte: cutoffTime },
        },
        select: {
          id: true,
          laundry_name: true,
          phone_number: true,
          created_at: true,
        },
      });

      if (pendingLaundries.length === 0) {
        this.logger.debug('No laundries to auto-approve');
        return;
      }

      this.logger.log(`Found ${pendingLaundries.length} laundries to auto-approve`);

      // Auto-approve each laundry
      for (const laundry of pendingLaundries) {
        await this.approvelaundry(laundry.id, laundry.laundry_name || laundry.phone_number);
      }

      this.logger.log(`Successfully auto-approved ${pendingLaundries.length} laundries`);
    } catch (error) {
      this.logger.error('Error during auto-approval process', error);
    }
  }

  /**
   * Approve a single laundry - set status to ACTIVE and is_verified to true
   */
  private async approvelaundry(laundryId: string, laundryName: string) {
    try {
      await this.prisma.laundry.update({
        where: { id: laundryId },
        data: {
          status: AccountStatus.ACTIVE,
          is_verified: true,
        },
      });

      this.logger.log(`Auto-approved laundry: ${laundryName} (${laundryId})`);

      // Optionally: Send notification to laundry about approval
      // This can be implemented later if needed
    } catch (error) {
      this.logger.error(`Failed to auto-approve laundry ${laundryId}`, error);
    }
  }

  /**
   * Get the current auto-approve configuration
   */
  getAutoApproveConfig() {
    const autoApproveMinutes = parseInt(process.env.LAUNDRY_AUTO_APPROVE_MINUTES || '120', 10);
    return {
      auto_approve_minutes: autoApproveMinutes,
      auto_approve_hours: autoApproveMinutes / 60,
    };
  }
}
