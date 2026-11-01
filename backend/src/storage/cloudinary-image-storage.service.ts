import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import type {
  ImageStorage,
  UploadedImageFile,
} from './image-storage.interface.js';
import {
  FOLDER_PATTERN,
  MAX_IMAGE_SIZE_BYTES,
  validateImageUpload,
} from './image-validation.js';

/** Every asset we create lives under this remote folder. */
export const CLOUDINARY_FOLDER_PREFIX = 'inventory';

const CLOUDINARY_HOST = 'res.cloudinary.com';
const VERSION_SEGMENT = /^v\d+$/;

function requiredSetting(config: ConfigService, name: string): string {
  const value = config.get<string>(name)?.trim();
  if (!value) {
    // The variable name is safe to log; the value is never included.
    throw new Error(`${name} is required when IMAGE_STORAGE is "cloudinary"`);
  }
  return value;
}

function isNotFound(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const httpCode = (error as { http_code?: number }).http_code;
  return httpCode === 404 || /not found/i.test(error.message);
}

/**
 * Cloudinary-backed image storage for hosts with an ephemeral disk.
 *
 * Uploads use the same validation as the local implementation before the
 * in-memory buffer is streamed to Cloudinary. Assets are stored under
 * `inventory/<folder>/<uuid>`; only URLs from our account and that folder
 * prefix are ever deleted.
 */
@Injectable()
export class CloudinaryImageStorageService implements ImageStorage {
  private readonly logger = new Logger(CloudinaryImageStorageService.name);
  private readonly cloudName: string;

  constructor(config: ConfigService) {
    this.cloudName = requiredSetting(config, 'CLOUDINARY_CLOUD_NAME');
    const apiKey = requiredSetting(config, 'CLOUDINARY_API_KEY');
    const apiSecret = requiredSetting(config, 'CLOUDINARY_API_SECRET');

    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  async save(
    file: UploadedImageFile | undefined,
    folder: string,
    maxBytes = MAX_IMAGE_SIZE_BYTES,
  ): Promise<string> {
    const { buffer, extension } = await validateImageUpload(
      file,
      folder,
      maxBytes,
    );

    const result = await new Promise<{ secure_url: string }>(
      (resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          {
            folder: `${CLOUDINARY_FOLDER_PREFIX}/${folder}`,
            public_id: randomUUID(),
            resource_type: 'image',
            format: extension,
          },
          (error, response) => {
            if (error) {
              reject(error);
              return;
            }
            if (!response?.secure_url) {
              reject(new Error('Cloudinary upload returned no secure URL'));
              return;
            }
            resolve(response);
          },
        );

        upload.end(buffer);
      },
    );

    return result.secure_url;
  }

  /**
   * Derives the remote public id from one of our secure URLs:
   * `https://res.cloudinary.com/<cloud>/image/upload/v<version>/inventory/<folder>/<uuid>.<ext>`
   * becomes `inventory/<folder>/<uuid>`. Returns null for external URLs,
   * legacy `/uploads/...` paths and any other account or folder.
   */
  publicIdFromUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) {
      return null;
    }

    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      return null;
    }

    if (parsed.protocol !== 'https:' || parsed.hostname !== CLOUDINARY_HOST) {
      return null;
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (
      segments[0] !== this.cloudName ||
      segments[1] !== 'image' ||
      segments[2] !== 'upload'
    ) {
      return null;
    }

    let index = 3;
    // Cloudinary URLs may or may not carry a `v<timestamp>` segment.
    if (VERSION_SEGMENT.test(segments[index] ?? '')) {
      index += 1;
    }

    const [prefix, folder, filename, ...extra] = segments.slice(index);
    if (
      extra.length > 0 ||
      prefix !== CLOUDINARY_FOLDER_PREFIX ||
      !folder ||
      !FOLDER_PATTERN.test(folder) ||
      !filename
    ) {
      return null;
    }

    // Strip the extension; the public id never includes it.
    const extensionIndex = filename.lastIndexOf('.');
    if (extensionIndex <= 0) {
      return null;
    }

    const publicId = filename.slice(0, extensionIndex);
    if (!publicId) {
      return null;
    }

    return `${CLOUDINARY_FOLDER_PREFIX}/${folder}/${publicId}`;
  }

  async delete(imageUrl: string | null | undefined): Promise<void> {
    const publicId = this.publicIdFromUrl(imageUrl);
    if (!publicId) {
      // External URLs and legacy local paths are not ours to delete.
      this.logger.debug(
        'Skipping image deletion: URL is not stored in this Cloudinary account',
      );
      return;
    }

    try {
      const result = (await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
      })) as { result?: string } | undefined;

      if (result?.result !== 'ok' && result?.result !== 'not found') {
        this.logger.debug(
          `Cloudinary did not delete ${publicId}: ${result?.result ?? 'unknown result'}`,
        );
      }
    } catch (error) {
      if (isNotFound(error)) {
        this.logger.debug(`Cloudinary image ${publicId} was already gone`);
        return;
      }

      this.logger.warn(
        `Could not delete Cloudinary image ${publicId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
