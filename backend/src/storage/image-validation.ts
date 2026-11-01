import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import type { UploadedImageFile } from './image-storage.interface.js';

/** 2 MB default, shared by the product image interceptor and the service. */
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

/** Avatars are smaller; enforced by the interceptor and the service. */
export const MAX_AVATAR_SIZE_BYTES = 1 * 1024 * 1024;

/** Extensions produced by `file-type` for the formats we accept. */
export const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'png', 'webp']);

/** One safe path segment, e.g. `products` or `avatars`. */
export const FOLDER_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export interface ValidatedImage {
  buffer: Buffer;
  extension: string;
}

/**
 * Shared upload validation: folder name, presence, size limit and magic-byte
 * type detection. The extension comes from the detected bytes, never from the
 * client-provided filename or mimetype.
 */
export async function validateImageUpload(
  file: UploadedImageFile | undefined,
  folder: string,
  maxBytes = MAX_IMAGE_SIZE_BYTES,
): Promise<ValidatedImage> {
  if (!FOLDER_PATTERN.test(folder)) {
    throw new BadRequestException('Invalid upload folder');
  }

  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('An image file is required');
  }

  if (file.size > maxBytes || file.buffer.length > maxBytes) {
    throw new PayloadTooLargeException(
      `Image must be ${maxBytes / (1024 * 1024)} MB or smaller`,
    );
  }

  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !ALLOWED_IMAGE_EXTENSIONS.has(detected.ext)) {
    throw new BadRequestException(
      'Unsupported image type. Allowed types: JPEG, PNG, WebP',
    );
  }

  return { buffer: file.buffer, extension: detected.ext };
}
