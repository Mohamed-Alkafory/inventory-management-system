import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { CloudinaryImageStorageService } from './cloudinary-image-storage.service.js';
import { createImageStorage } from './image-storage.module.js';
import { ImageStorageService } from './image-storage.service.js';

function configService(
  env: Record<string, string | undefined>,
): ConfigService {
  return { get: (name: string) => env[name] } as unknown as ConfigService;
}

describe('createImageStorage', () => {
  it('provides the local disk implementation by default', () => {
    const storage = createImageStorage(configService({}));

    expect(storage).toBeInstanceOf(ImageStorageService);
  });

  it('provides the local disk implementation for IMAGE_STORAGE=local', () => {
    const storage = createImageStorage(
      configService({ IMAGE_STORAGE: 'local' }),
    );

    expect(storage).toBeInstanceOf(ImageStorageService);
  });

  it('provides the Cloudinary implementation when selected', () => {
    const storage = createImageStorage(
      configService({
        IMAGE_STORAGE: 'cloudinary',
        CLOUDINARY_CLOUD_NAME: 'demo-cloud',
        CLOUDINARY_API_KEY: 'test-key',
        CLOUDINARY_API_SECRET: 'test-secret',
      }),
    );

    expect(storage).toBeInstanceOf(CloudinaryImageStorageService);
  });
});
