import { BadRequestException, Logger, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { configMock, uploadStreamMock, destroyMock } = vi.hoisted(() => ({
  configMock: vi.fn(),
  uploadStreamMock: vi.fn(),
  destroyMock: vi.fn(),
}));

vi.mock('cloudinary', () => ({
  v2: {
    config: configMock,
    uploader: {
      upload_stream: uploadStreamMock,
      destroy: destroyMock,
    },
  },
}));

import { CloudinaryImageStorageService } from './cloudinary-image-storage.service.js';
import type { UploadedImageFile } from './image-storage.interface.js';
import { MAX_AVATAR_SIZE_BYTES } from './image-validation.js';

// 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const CLOUD_NAME = 'demo-cloud';
const UUID = '1f0f2b3c-4d5e-4f60-8a9b-0c1d2e3f4a5b';

const asFile = (
  buffer: Buffer,
  originalname = 'client-file.png',
): UploadedImageFile => ({
  buffer,
  size: buffer.length,
  mimetype: 'application/octet-stream',
  originalname,
});

const configService = (
  overrides: Record<string, string | undefined> = {},
): ConfigService => {
  const values: Record<string, string | undefined> = {
    CLOUDINARY_CLOUD_NAME: CLOUD_NAME,
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
    ...overrides,
  };

  return { get: (name: string) => values[name] } as unknown as ConfigService;
};

const secureUrl = (
  path: string,
  options: { version?: number | null; account?: string } = {},
) => {
  const account = options.account ?? CLOUD_NAME;
  const segment =
    options.version === null ? '' : `v${options.version ?? 1712345678}/`;
  return `https://res.cloudinary.com/${account}/image/upload/${segment}${path}`;
};

describe('CloudinaryImageStorageService', () => {
  let service: CloudinaryImageStorageService;
  let uploadEnd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    uploadEnd = vi.fn();
    uploadStreamMock.mockReturnValue({ end: uploadEnd });
    destroyMock.mockResolvedValue({ result: 'ok' });

    service = new CloudinaryImageStorageService(configService());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('configures the SDK with the account credentials and secure URLs', () => {
    expect(configMock).toHaveBeenCalledWith({
      cloud_name: CLOUD_NAME,
      api_key: 'test-key',
      api_secret: 'test-secret',
      secure: true,
    });
  });

  it.each([
    ['CLOUDINARY_CLOUD_NAME'],
    ['CLOUDINARY_API_KEY'],
    ['CLOUDINARY_API_SECRET'],
  ])('requires %s', (name) => {
    expect(
      () => new CloudinaryImageStorageService(configService({ [name]: '  ' })),
    ).toThrow(new RegExp(`${name} is required`));
  });

  describe('save', () => {
    it('streams the buffer into inventory/<folder> with a generated UUID id and returns secure_url', async () => {
      const url = secureUrl(`inventory/products/${UUID}.png`);
      uploadStreamMock.mockImplementation(
        (
          _options: unknown,
          callback: (error: unknown, result: { secure_url: string }) => void,
        ) => {
          callback(undefined, { secure_url: url });
          return { end: uploadEnd };
        },
      );

      const saved = await service.save(asFile(PNG, 'my-photo.png'), 'products');

      expect(saved).toBe(url);
      expect(uploadStreamMock).toHaveBeenCalledTimes(1);

      const [options] = uploadStreamMock.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(options).toMatchObject({
        folder: 'inventory/products',
        resource_type: 'image',
        format: 'png',
      });
      expect(options.public_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(options.public_id).not.toContain('my-photo');
      expect(uploadEnd).toHaveBeenCalledWith(PNG);
    });

    it('rejects a fake image before calling Cloudinary', async () => {
      await expect(
        service.save(asFile(Buffer.from('not an image')), 'products'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(uploadStreamMock).not.toHaveBeenCalled();
    });

    it('rejects an oversized avatar before calling Cloudinary', async () => {
      await expect(
        service.save(
          asFile(Buffer.alloc(MAX_AVATAR_SIZE_BYTES + 1)),
          'avatars',
          MAX_AVATAR_SIZE_BYTES,
        ),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);

      expect(uploadStreamMock).not.toHaveBeenCalled();
    });

    it('rejects an unsafe folder before calling Cloudinary', async () => {
      await expect(
        service.save(asFile(PNG), '../outside'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(uploadStreamMock).not.toHaveBeenCalled();
    });

    it('propagates an upload failure', async () => {
      uploadStreamMock.mockImplementation(
        (
          _options: unknown,
          callback: (
            error: { message: string; http_code: number },
            result: undefined,
          ) => void,
        ) => {
          callback({ message: 'upload exploded', http_code: 500 }, undefined);
          return { end: uploadEnd };
        },
      );

      await expect(
        service.save(asFile(PNG), 'products'),
      ).rejects.toMatchObject({ message: 'upload exploded' });
      expect(destroyMock).not.toHaveBeenCalled();
    });

    it('rejects when Cloudinary returns no secure URL', async () => {
      uploadStreamMock.mockImplementation(
        (
          _options: unknown,
          callback: (error: unknown, result: undefined) => void,
        ) => {
          callback(undefined, undefined);
          return { end: uploadEnd };
        },
      );

      await expect(service.save(asFile(PNG), 'products')).rejects.toThrow(
        'no secure URL',
      );
    });
  });

  describe('delete', () => {
    it('derives the public id from a versioned URL and destroys it', async () => {
      const url = secureUrl(`inventory/avatars/${UUID}.png`);

      await service.delete(url);

      expect(destroyMock).toHaveBeenCalledTimes(1);
      expect(destroyMock).toHaveBeenCalledWith(`inventory/avatars/${UUID}`, {
        resource_type: 'image',
      });
    });

    it('derives the public id from a URL without a version segment', async () => {
      const url = secureUrl(`inventory/products/${UUID}.webp`, {
        version: null,
      });

      await service.delete(url);

      expect(destroyMock).toHaveBeenCalledWith(`inventory/products/${UUID}`, {
        resource_type: 'image',
      });
    });

    it.each([
      ['an external URL', 'https://example.com/image.png'],
      ['a legacy local path', `/uploads/avatars/${UUID}.png`],
      ['a relative URL', 'image.png'],
      ['another Cloudinary account', secureUrl(`inventory/avatars/${UUID}.png`, { account: 'someone-else' })],
      ['another folder prefix', secureUrl(`other/avatars/${UUID}.png`)],
      ['a non-image resource', `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/v1/inventory/avatars/${UUID}.mp4`],
      ['a nested extra segment', secureUrl(`inventory/avatars/extra/${UUID}.png`)],
      ['an empty value', ''],
    ])('skips %s without calling Cloudinary', async (_label, url) => {
      const debug = vi
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation(() => undefined);

      await expect(service.delete(url)).resolves.toBeUndefined();

      expect(destroyMock).not.toHaveBeenCalled();
      expect(debug).toHaveBeenCalled();
    });

    it('ignores a "not found" destroy result', async () => {
      destroyMock.mockResolvedValue({ result: 'not found' });

      await expect(
        service.delete(secureUrl(`inventory/avatars/${UUID}.png`)),
      ).resolves.toBeUndefined();
    });

    it('ignores a 404 error from the SDK', async () => {
      destroyMock.mockRejectedValue(
        Object.assign(new Error('Resource not found'), { http_code: 404 }),
      );

      await expect(
        service.delete(secureUrl(`inventory/avatars/${UUID}.png`)),
      ).resolves.toBeUndefined();
    });

    it('logs and swallows other destroy failures so callers keep working', async () => {
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      destroyMock.mockRejectedValue(new Error('network down'));

      await expect(
        service.delete(secureUrl(`inventory/avatars/${UUID}.png`)),
      ).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('network down'),
      );
    });
  });

  describe('publicIdFromUrl', () => {
    it.each([
      ['with version', secureUrl(`inventory/products/${UUID}.jpg`)],
      ['without version', secureUrl(`inventory/products/${UUID}.jpg`, { version: null })],
    ])('strips the version and extension (%s)', (_label, url) => {
      expect(service.publicIdFromUrl(url)).toBe(`inventory/products/${UUID}`);
    });

    it('returns null for malformed URLs', () => {
      expect(service.publicIdFromUrl('not a url')).toBeNull();
      expect(service.publicIdFromUrl(null)).toBeNull();
      expect(service.publicIdFromUrl(undefined)).toBeNull();
    });

    it('returns null when the filename has no extension', () => {
      expect(
        service.publicIdFromUrl(secureUrl(`inventory/products/${UUID}`)),
      ).toBeNull();
    });
  });
});
