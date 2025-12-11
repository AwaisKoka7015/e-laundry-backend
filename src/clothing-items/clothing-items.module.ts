import { Module } from '@nestjs/common';
import { ClothingItemsController } from './clothing-items.controller';
import { ClothingItemsService } from './clothing-items.service';

@Module({
  controllers: [ClothingItemsController],
  providers: [ClothingItemsService],
  exports: [ClothingItemsService],
})
export class ClothingItemsModule {}
