/**
 * Storage abstraction for uploaded images.
 *
 * Both implementations (local disk and Cloudinary) validate uploads exactly the
 * same way and return the URL to persist in the database.
 */
export interface UploadedImageFile {
  buffer: Buffer;
  size: number;
  mimetype?: string;
  originalname?: string;
}

export interface ImageStorage {
  /**
   * Validates and stores one image in `folder`, returning the URL to persist.
   * The caller owns cleanup if the subsequent database write fails.
   */
  save(
    file: UploadedImageFile | undefined,
    folder: string,
    maxBytes?: number,
  ): Promise<string>;

  /**
   * Removes a previously stored image. Implementations only delete images they
   * own; external URLs and legacy paths are skipped.
   */
  delete(imageUrl: string | null | undefined): Promise<void>;
}

/** Nest injection token for the selected `ImageStorage` implementation. */
export const IMAGE_STORAGE = Symbol('IMAGE_STORAGE');

export const IMAGE_STORAGE_MODES = ['local', 'cloudinary'] as const;

/** Required only when `IMAGE_STORAGE=cloudinary`; never logged. */
export const CLOUDINARY_ENV_NAMES = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
] as const;

export type ImageStorageMode = (typeof IMAGE_STORAGE_MODES)[number];

export const DEFAULT_IMAGE_STORAGE_MODE: ImageStorageMode = 'local';

/**
 * Maps `IMAGE_STORAGE` to a mode. Anything other than "cloudinary" keeps the
 * local disk default (env validation rejects unknown values at startup).
 */
export function resolveImageStorageMode(
  value: string | null | undefined,
): ImageStorageMode {
  return value?.trim().toLowerCase() === 'cloudinary' ? 'cloudinary' : 'local';
}

/** The `/uploads` static mount exists only for the local disk backend. */
export function servesLocalUploads(
  value: string | null | undefined,
): boolean {
  return resolveImageStorageMode(value) === 'local';
}
