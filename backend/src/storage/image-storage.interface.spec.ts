import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_STORAGE_MODE,
  resolveImageStorageMode,
  servesLocalUploads,
} from './image-storage.interface.js';

describe('image storage mode', () => {
  it('defaults to local disk', () => {
    expect(DEFAULT_IMAGE_STORAGE_MODE).toBe('local');
    expect(resolveImageStorageMode(undefined)).toBe('local');
    expect(resolveImageStorageMode(null)).toBe('local');
    expect(resolveImageStorageMode('')).toBe('local');
    expect(resolveImageStorageMode('local')).toBe('local');
  });

  it('selects Cloudinary only for the cloudinary value', () => {
    expect(resolveImageStorageMode('cloudinary')).toBe('cloudinary');
    expect(resolveImageStorageMode(' CLOUDINARY ')).toBe('cloudinary');
    expect(resolveImageStorageMode('s3')).toBe('local');
  });

  it('serves /uploads statically only in local mode', () => {
    expect(servesLocalUploads(undefined)).toBe(true);
    expect(servesLocalUploads('local')).toBe(true);
    expect(servesLocalUploads('cloudinary')).toBe(false);
  });
});
