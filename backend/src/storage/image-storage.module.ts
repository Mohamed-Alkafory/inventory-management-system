import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudinaryImageStorageService } from './cloudinary-image-storage.service.js';
import {
  IMAGE_STORAGE,
  resolveImageStorageMode,
  type ImageStorage,
} from './image-storage.interface.js';
import { ImageStorageService } from './image-storage.service.js';

/** Picks the configured backend; exported so it can be unit tested. */
export function createImageStorage(config: ConfigService): ImageStorage {
  return resolveImageStorageMode(config.get<string>('IMAGE_STORAGE')) ===
    'cloudinary'
    ? new CloudinaryImageStorageService(config)
    : new ImageStorageService(config);
}

@Module({
  providers: [
    {
      provide: IMAGE_STORAGE,
      inject: [ConfigService],
      useFactory: createImageStorage,
    },
  ],
  exports: [IMAGE_STORAGE],
})
export class ImageStorageModule {}
