import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  MAX_IMAGE_SIZE_BYTES,
  ProductImageService,
  type UploadedImageFile,
} from './product-image.service.js';

const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
  Buffer.alloc(32),
]);

// 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 ', 'ascii'),
  Buffer.alloc(32),
]);

const asFile = (buffer: Buffer, originalname = 'upload.bin'): UploadedImageFile => ({
  buffer,
  size: buffer.length,
  mimetype: 'application/octet-stream',
  originalname,
});

describe('ProductImageService', () => {
  let directory: string;
  let service: ProductImageService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'inventory-product-images-'));
    service = new ProductImageService({
      get: () => directory,
    } as never);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it.each([
    ['JPEG', JPEG, '.jpg'],
    ['PNG', PNG, '.png'],
    ['WebP', WEBP, '.webp'],
  ])('saves a valid %s file using the detected extension', async (_name, buffer, extension) => {
    const imageUrl = await service.save(asFile(buffer, 'client-file.png'));

    expect(imageUrl.startsWith('/uploads/products/')).toBe(true);
    expect(imageUrl.endsWith(extension)).toBe(true);
    // The client filename is never used.
    expect(imageUrl).not.toContain('client-file');

    const filename = imageUrl.slice('/uploads/products/'.length);
    const written = await readFile(join(service.productsDir, filename));
    expect(written.equals(buffer)).toBe(true);
  });

  it('rejects a fake .png with non-image content', async () => {
    await expect(
      service.save(asFile(Buffer.from('not really a png'), 'fake.png')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unsupported real image type (GIF)', async () => {
    const gif = Buffer.from('GIF89a', 'ascii');

    await expect(service.save(asFile(gif, 'animation.gif'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a file larger than 2 MB', async () => {
    const tooLarge = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1);

    await expect(service.save(asFile(tooLarge))).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
  });

  it('rejects an empty or missing file', async () => {
    await expect(service.save(undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.save(asFile(Buffer.alloc(0)))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('deletes an existing local file', async () => {
    const imageUrl = await service.save(asFile(PNG));
    const filename = imageUrl.slice('/uploads/products/'.length);
    const absolutePath = join(service.productsDir, filename);

    await service.remove(imageUrl);

    await expect(stat(absolutePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('ignores a missing file', async () => {
    await expect(
      service.remove('/uploads/products/does-not-exist.png'),
    ).resolves.toBeUndefined();
  });

  it('never deletes external URLs', async () => {
    const external = 'https://example.com/image.png';
    expect(service.resolveLocalPath(external)).toBeNull();

    await expect(service.remove(external)).resolves.toBeUndefined();
  });

  it('refuses path traversal and nested paths', async () => {
    const outside = join(directory, 'secret.png');
    await writeFile(outside, PNG);

    for (const candidate of [
      '/uploads/products/../secret.png',
      '/uploads/products/..\\secret.png',
      '/uploads/products/nested/image.png',
      '/uploads/other/image.png',
      'uploads/products/image.png',
    ]) {
      expect(service.resolveLocalPath(candidate)).toBeNull();
      await expect(service.remove(candidate)).resolves.toBeUndefined();
    }

    await expect(stat(outside)).resolves.toBeDefined();
  });
});
