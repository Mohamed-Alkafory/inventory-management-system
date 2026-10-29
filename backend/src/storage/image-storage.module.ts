import { Module } from '@nestjs/common';
import { ImageStorageService } from './image-storage.service.js';

@Module({
  providers: [ImageStorageService],
  exports: [ImageStorageService],
})
export class ImageStorageModule {}
