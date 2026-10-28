import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileTypeFromBuffer } from 'file-type';

/** 2 MB, shared by the multer interceptor and the service-level check. */
export const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

/** Public URL prefix served by the static-assets middleware (`main.ts`). */
export const IMAGE_URL_PREFIX = '/uploads/products/';

/** Extensions produced by `file-type` for the formats we accept. */
const ALLOWED_EXTENSIONS = new Set(['jpg', 'png', 'webp']);

/**
 * Resolves `UPLOADS_DIR` to an absolute directory. Relative values are
 * relative to the process working directory (the Docker workdir in prod).
 */
export function resolveUploadsDir(configured?: string): string {
  const value = configured?.trim() || 'uploads';
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

/**
 * The subset of multer's file object we need. Defining it locally keeps the
 * service trivial to unit test and avoids depending on Express.Multer globals.
 */
export interface UploadedImageFile {
  buffer: Buffer;
  size: number;
  mimetype?: string;
  originalname?: string;
}

/**
 * Disk storage for product images.
 *
 * - Files live in `<UPLOADS_DIR>/products/`.
 * - Names are generated UUIDs; client filenames are never used.
 * - The extension comes from the detected magic bytes, not the mimetype or
 *   the client-provided filename.
 * - Only relative `/uploads/products/...` URLs are owned by this service;
 *   external URLs are never deleted.
 */
@Injectable()
export class ProductImageService implements OnModuleInit {
  private readonly logger = new Logger(ProductImageService.name);
  readonly uploadsDir: string;
  readonly productsDir: string;

  constructor(config: ConfigService) {
    this.uploadsDir = resolveUploadsDir(config.get<string>('UPLOADS_DIR'));
    this.productsDir = join(this.uploadsDir, 'products');
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.productsDir, { recursive: true });
  }

  /**
   * Validates and writes one image. Returns the relative URL to persist in
   * `Product.imageUrl`. The caller owns cleanup if the subsequent DB write
   * fails.
   */
  async save(file?: UploadedImageFile): Promise<string> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('An image file is required');
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES || file.buffer.length > MAX_IMAGE_SIZE_BYTES) {
      throw new PayloadTooLargeException(
        `Image must be ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB or smaller`,
      );
    }

    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_EXTENSIONS.has(detected.ext)) {
      throw new BadRequestException(
        'Unsupported image type. Allowed types: JPEG, PNG, WebP',
      );
    }

    await mkdir(this.productsDir, { recursive: true });
    const filename = `${randomUUID()}.${detected.ext}`;
    const absolutePath = join(this.productsDir, filename);

    await writeFile(absolutePath, file.buffer, { flag: 'wx' });

    return `${IMAGE_URL_PREFIX}${filename}`;
  }

  /**
   * Deletes a local image if (and only if) it is a generated
   * `/uploads/products/...` path. Missing files are ignored, and external
   * URLs are left untouched.
   */
  async remove(imageUrl: string | null | undefined): Promise<void> {
    const absolutePath = this.resolveLocalPath(imageUrl);
    if (!absolutePath) {
      return;
    }

    try {
      await unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      this.logger.warn(
        `Could not delete product image ${absolutePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Maps a stored URL to a path inside `productsDir`, or null when the URL is
   * external or would escape the directory.
   */
  resolveLocalPath(imageUrl: string | null | undefined): string | null {
    if (!imageUrl || !imageUrl.startsWith(IMAGE_URL_PREFIX)) {
      return null;
    }

    const filename = imageUrl.slice(IMAGE_URL_PREFIX.length);
    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename !== basename(filename)
    ) {
      return null;
    }

    const absolutePath = resolve(this.productsDir, filename);
    if (dirname(absolutePath) !== resolve(this.productsDir)) {
      return null;
    }

    return absolutePath;
  }
}
