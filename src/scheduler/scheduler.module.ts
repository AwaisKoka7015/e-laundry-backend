import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LaundryAutoApprovalService } from './laundry-auto-approval.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule],
  providers: [LaundryAutoApprovalService],
  exports: [LaundryAutoApprovalService],
})
export class SchedulerModule {}
