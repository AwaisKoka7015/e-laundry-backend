import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AccountStatus } from '@prisma/client';

@Injectable()
export class LaundryAutoApprovalService {
  private readonly logger = new Logger(LaundryAutoApprovalService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Runs every minute to check for laundries that should be auto-approved.
   * Approves laundries where:
   *   - status is PENDING/PENDING_LOCATION/PENDING_ROLE
   *   - setup_at is set (admin has set up the laundry)
   *   - approved_at is null (not yet approved)
   *   - setup_at is older than LAUNDRY_AUTO_APPROVE_MINUTES (default 5 for dev)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleAutoApproval() {
    const autoApproveMinutes = parseInt(
      process.env.LAUNDRY_AUTO_APPROVE_MINUTES || '5',
      10,
    );
    const cutoffTime = new Date(Date.now() - autoApproveMinutes * 60 * 1000);

    this.logger.debug(
      `Checking for laundries to auto-approve (setup before ${cutoffTime.toISOString()}, ${autoApproveMinutes}min window)`,
    );

    try {
      const pendingStatuses = [
        AccountStatus.PENDING,
        AccountStatus.PENDING_LOCATION,
        AccountStatus.PENDING_ROLE,
      ];

      // Find laundries that have been set up by admin but not yet approved
      const laundriesToApprove = await this.prisma.laundry.findMany({
        where: {
          status: { in: pendingStatuses },
          setup_at: { not: null, lte: cutoffTime },
          approved_at: null,
        },
        select: {
          id: true,
          laundry_name: true,
          phone_number: true,
          setup_at: true,
        },
      });

      if (laundriesToApprove.length === 0) {
        this.logger.debug('No laundries to auto-approve');
        return;
      }

      this.logger.log(
        `Found ${laundriesToApprove.length} laundries to auto-approve`,
      );

      // Approve all eligible laundries in a transaction
      const approved = await this.prisma.$transaction(
        laundriesToApprove.map((laundry) =>
          this.prisma.laundry.update({
            where: { id: laundry.id },
            data: {
              status: AccountStatus.ACTIVE,
              is_verified: true,
              is_open: true,
              approved_at: new Date(),
            },
          }),
        ),
      );

      for (const laundry of approved) {
        this.logger.log(
          `Auto-approved laundry: ${laundry.laundry_name || laundry.phone_number} (${laundry.id})`,
        );
      }

      this.logger.log(
        `Successfully auto-approved ${approved.length} laundries`,
      );
    } catch (error) {
      this.logger.error('Error during auto-approval process', error);
    }
  }

  /**
   * Get the current auto-approve configuration
   */
  getAutoApproveConfig() {
    const autoApproveMinutes = parseInt(
      process.env.LAUNDRY_AUTO_APPROVE_MINUTES || '5',
      10,
    );
    return {
      auto_approve_minutes: autoApproveMinutes,
      auto_approve_hours: autoApproveMinutes / 60,
    };
  }
}
