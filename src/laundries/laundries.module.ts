import { Module } from '@nestjs/common';
import { LaundriesController } from './laundries.controller';
import { LaundriesService } from './laundries.service';

@Module({
  controllers: [LaundriesController],
  providers: [LaundriesService],
  exports: [LaundriesService],
})
export class LaundriesModule {}
