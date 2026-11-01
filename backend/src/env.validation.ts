import { parseCorsOrigins } from './common/cors-origins.js';
import { parsePgPoolSettings } from './prisma/pool-options.js';
import {
  CLOUDINARY_ENV_NAMES,
  IMAGE_STORAGE_MODES,
  resolveImageStorageMode,
  type ImageStorageMode,
} from './storage/image-storage.interface.js';

/** Minimum `JWT_SECRET` length accepted in production. */
export const JWT_SECRET_MIN_LENGTH = 32;

/**
 * Substrings that mark a value as an obvious placeholder. Matching is
 * case-insensitive and only enforced in production; CI and the e2e setup keep
 * using short throwaway secrets outside production.
 */
export const JWT_SECRET_PLACEHOLDERS = [
  'change_me',
  'changeme',
  'secret',
  'password',
  'example',
  'ci_secret',
] as const;

/** True when the process runs with `NODE_ENV=production`. */
function isProductionEnv(config: Record<string, unknown>): boolean {
  return config.NODE_ENV === 'production';
}

function validateJwtSecret(config: Record<string, unknown>): void {
  const secret = config.JWT_SECRET;

  if (typeof secret !== 'string' || secret.trim() === '') {
    throw new Error('JWT_SECRET is required');
  }

  if (!isProductionEnv(config)) {
    return;
  }

  if (secret.length < JWT_SECRET_MIN_LENGTH) {
    // Never include the value: it is a secret.
    throw new Error(
      `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters in production`,
    );
  }

  const lowered = secret.toLowerCase();
  if (JWT_SECRET_PLACEHOLDERS.some((placeholder) => lowered.includes(placeholder))) {
    throw new Error(
      'JWT_SECRET must not be a placeholder value in production; use a long random string',
    );
  }
}

function validateSwaggerEnabled(config: Record<string, unknown>): string | undefined {
  const value = config.SWAGGER_ENABLED;

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error('SWAGGER_ENABLED must be "true" or "false" when provided');
  }

  const normalized = value.trim().toLowerCase();
  if (normalized !== 'true' && normalized !== 'false') {
    throw new Error('SWAGGER_ENABLED must be "true" or "false" when provided');
  }

  return normalized;
}

function validateDirectUrl(config: Record<string, unknown>): void {
  const value = config.DIRECT_URL;

  if (value === undefined) {
    return;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('DIRECT_URL must be a non-empty string when provided');
  }
}

function validateImageStorage(config: Record<string, unknown>): ImageStorageMode {
  const raw = config.IMAGE_STORAGE;

  if (raw === undefined) {
    return resolveImageStorageMode(undefined);
  }

  if (typeof raw !== 'string') {
    throw new Error('IMAGE_STORAGE must be "local" or "cloudinary"');
  }

  const normalized = raw.trim().toLowerCase();
  if (!(IMAGE_STORAGE_MODES as readonly string[]).includes(normalized)) {
    throw new Error('IMAGE_STORAGE must be "local" or "cloudinary"');
  }

  if (normalized === 'cloudinary') {
    for (const name of CLOUDINARY_ENV_NAMES) {
      // Only the variable name is reported; values are never echoed.
      const value = config[name];
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(
          `${name} is required when IMAGE_STORAGE is "cloudinary"`,
        );
      }
    }
  }

  return normalized as ImageStorageMode;
}

function validateTrustProxy(config: Record<string, unknown>): number {
  const value = config.TRUST_PROXY;

  if (value === undefined) {
    return 0;
  }

  const hops = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error('TRUST_PROXY must be an integer greater than or equal to 0');
  }

  return hops;
}

export function envValidation(config: Record<string, unknown>) {
  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  validateJwtSecret(config);

  if (!config.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN is required');
  }

  // Throws on a wildcard, an invalid URL or an empty list.
  const corsOrigins = parseCorsOrigins(config.CORS_ORIGIN);

  validateDirectUrl(config);

  // Throws when a PG_* value is not a positive integer; also normalises the
  // defaults for the returned config.
  const poolSettings = parsePgPoolSettings(config);

  // Defaults to local disk; requires the Cloudinary credentials when selected.
  const imageStorage = validateImageStorage(config);

  const port = config.PORT === undefined ? 3000 : Number(config.PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid port number');
  }

  if (
    config.UPLOADS_DIR !== undefined &&
    (typeof config.UPLOADS_DIR !== 'string' ||
      config.UPLOADS_DIR.trim() === '')
  ) {
    throw new Error('UPLOADS_DIR must be a non-empty string when provided');
  }

  const swaggerEnabled = validateSwaggerEnabled(config);

  return {
    ...config,
    PORT: port,
    CORS_ORIGIN: corsOrigins,
    TRUST_PROXY: validateTrustProxy(config),
    PG_POOL_MAX: poolSettings.max,
    PG_CONNECTION_TIMEOUT_MS: poolSettings.connectionTimeoutMillis,
    PG_IDLE_TIMEOUT_MS: poolSettings.idleTimeoutMillis,
    IMAGE_STORAGE: imageStorage,
    ...(swaggerEnabled === undefined ? {} : { SWAGGER_ENABLED: swaggerEnabled }),
  };
}
