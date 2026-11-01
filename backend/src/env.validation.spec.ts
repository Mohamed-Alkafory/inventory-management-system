import {
  envValidation,
  JWT_SECRET_MIN_LENGTH,
  JWT_SECRET_PLACEHOLDERS,
} from './env.validation.js';
import { CLOUDINARY_ENV_NAMES } from './storage/image-storage.interface.js';

const STRONG_SECRET = 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0';

const baseConfig = () => ({
  DATABASE_URL: 'postgresql://inventory:inventory@localhost:5432/inventory',
  JWT_SECRET: STRONG_SECRET,
  CORS_ORIGIN: 'http://localhost:5173',
});

describe('envValidation', () => {
  describe('DATABASE_URL', () => {
    it('is required', () => {
      const config = baseConfig();
      delete (config as Partial<typeof config>).DATABASE_URL;

      expect(() => envValidation(config)).toThrow('DATABASE_URL is required');
    });
  });

  describe('JWT_SECRET outside production', () => {
    it('accepts a short secret', () => {
      const config = { ...baseConfig(), JWT_SECRET: 'short' };

      expect(() => envValidation(config)).not.toThrow();
    });

    it.each(JWT_SECRET_PLACEHOLDERS)(
      'accepts the placeholder %s because CI and e2e use throwaway values',
      (placeholder) => {
        const config = { ...baseConfig(), JWT_SECRET: placeholder };

        expect(() => envValidation(config)).not.toThrow();
      },
    );

    it('still rejects an empty secret', () => {
      const config = { ...baseConfig(), JWT_SECRET: '   ' };

      expect(() => envValidation(config)).toThrow('JWT_SECRET is required');
    });
  });

  describe('JWT_SECRET in production', () => {
    const production = (secret: string) => ({
      ...baseConfig(),
      NODE_ENV: 'production',
      JWT_SECRET: secret,
    });

    it('accepts a long random secret', () => {
      expect(() => envValidation(production(STRONG_SECRET))).not.toThrow();
    });

    it(`rejects a secret shorter than ${JWT_SECRET_MIN_LENGTH} characters`, () => {
      const short = 'a'.repeat(JWT_SECRET_MIN_LENGTH - 1);

      expect(() => envValidation(production(short))).toThrow(
        `at least ${JWT_SECRET_MIN_LENGTH} characters`,
      );
    });

    it.each(JWT_SECRET_PLACEHOLDERS)(
      'rejects the placeholder %s',
      (placeholder) => {
        const secret = placeholder.padEnd(JWT_SECRET_MIN_LENGTH, 'x');

        expect(() => envValidation(production(secret))).toThrow(
          /placeholder value/,
        );
      },
    );

    it('matches placeholders case-insensitively', () => {
      const secret = 'ChAnGe_Me'.padEnd(JWT_SECRET_MIN_LENGTH, 'x');

      expect(() => envValidation(production(secret))).toThrow(
        /placeholder value/,
      );
    });

    it('never echoes the secret in the error message', () => {
      const secret = 'super-secret-value-that-is-long-enough';

      let message = '';
      try {
        envValidation(production(secret));
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).not.toBe('');
      expect(message).not.toContain(secret);
    });
  });

  describe('CORS_ORIGIN', () => {
    it('is required', () => {
      const config = baseConfig();
      delete (config as Partial<typeof config>).CORS_ORIGIN;

      expect(() => envValidation(config)).toThrow('CORS_ORIGIN is required');
    });

    it('returns the normalised origin list', () => {
      const config = {
        ...baseConfig(),
        CORS_ORIGIN: ' https://app.example.com/ , http://localhost:5173 ',
      };

      const validated = envValidation(config);

      expect(validated.CORS_ORIGIN).toEqual([
        'https://app.example.com',
        'http://localhost:5173',
      ]);
    });

    it('rejects a wildcard', () => {
      const config = { ...baseConfig(), CORS_ORIGIN: '*' };

      expect(() => envValidation(config)).toThrow(/\*/);
    });

    it('rejects an invalid URL', () => {
      const config = { ...baseConfig(), CORS_ORIGIN: 'not-a-url' };

      expect(() => envValidation(config)).toThrow(/invalid URL/);
    });
  });

  describe('TRUST_PROXY', () => {
    it('defaults to 0 (off)', () => {
      expect(envValidation(baseConfig()).TRUST_PROXY).toBe(0);
    });

    it('accepts an integer hop count', () => {
      const config = { ...baseConfig(), TRUST_PROXY: '1' };

      expect(envValidation(config).TRUST_PROXY).toBe(1);
    });

    it.each(['-1', '1.5', 'abc', 'Infinity'])('rejects %s', (value) => {
      const config = { ...baseConfig(), TRUST_PROXY: value };

      expect(() => envValidation(config)).toThrow(/TRUST_PROXY/);
    });
  });

  describe('SWAGGER_ENABLED', () => {
    it('is optional', () => {
      expect(envValidation(baseConfig())).not.toHaveProperty(
        'SWAGGER_ENABLED',
      );
    });

    it('normalises a valid boolean string', () => {
      const config = { ...baseConfig(), SWAGGER_ENABLED: ' TRUE ' };

      expect(envValidation(config).SWAGGER_ENABLED).toBe('true');
    });

    it.each(['yes', '1', 'enabled'])('rejects %s', (value) => {
      const config = { ...baseConfig(), SWAGGER_ENABLED: value };

      expect(() => envValidation(config)).toThrow(/SWAGGER_ENABLED/);
    });
  });

  describe('PORT', () => {
    it('defaults to 3000', () => {
      expect(envValidation(baseConfig()).PORT).toBe(3000);
    });

    it('rejects an invalid port', () => {
      const config = { ...baseConfig(), PORT: '70000' };

      expect(() => envValidation(config)).toThrow(/valid port number/);
    });
  });

  describe('DIRECT_URL', () => {
    it('is optional', () => {
      expect(() => envValidation(baseConfig())).not.toThrow();
    });

    it('accepts a non-empty direct URL', () => {
      const config = {
        ...baseConfig(),
        DIRECT_URL: 'postgresql://user:password@direct.example.com:5432/db',
      };

      expect(envValidation(config).DIRECT_URL).toBe(config.DIRECT_URL);
    });

    it.each(['', '   '])('rejects an empty value: %j', (value) => {
      const config = { ...baseConfig(), DIRECT_URL: value };

      expect(() => envValidation(config)).toThrow(/DIRECT_URL/);
    });
  });

  describe('PG_POOL_MAX / PG_CONNECTION_TIMEOUT_MS / PG_IDLE_TIMEOUT_MS', () => {
    it('normalises the defaults', () => {
      const validated = envValidation(baseConfig());

      expect(validated.PG_POOL_MAX).toBe(5);
      expect(validated.PG_CONNECTION_TIMEOUT_MS).toBe(10_000);
      expect(validated.PG_IDLE_TIMEOUT_MS).toBe(10_000);
    });

    it('normalises configured positive integers to numbers', () => {
      const config = {
        ...baseConfig(),
        PG_POOL_MAX: '10',
        PG_CONNECTION_TIMEOUT_MS: '5000',
        PG_IDLE_TIMEOUT_MS: '20000',
      };

      const validated = envValidation(config);

      expect(validated.PG_POOL_MAX).toBe(10);
      expect(validated.PG_CONNECTION_TIMEOUT_MS).toBe(5000);
      expect(validated.PG_IDLE_TIMEOUT_MS).toBe(20000);
    });

    it.each([
      ['PG_POOL_MAX', '0'],
      ['PG_CONNECTION_TIMEOUT_MS', '-100'],
      ['PG_IDLE_TIMEOUT_MS', 'abc'],
    ])('rejects an invalid %s: %s', (name, value) => {
      const config = { ...baseConfig(), [name]: value };

      expect(() => envValidation(config)).toThrow(new RegExp(name));
    });
  });

  describe('IMAGE_STORAGE', () => {
    const cloudinaryConfig = (overrides: Record<string, unknown> = {}) => ({
      ...baseConfig(),
      IMAGE_STORAGE: 'cloudinary',
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
      ...overrides,
    });

    it('defaults to local disk', () => {
      expect(envValidation(baseConfig()).IMAGE_STORAGE).toBe('local');
    });

    it('normalises the local value', () => {
      const config = { ...baseConfig(), IMAGE_STORAGE: ' LOCAL ' };

      expect(envValidation(config).IMAGE_STORAGE).toBe('local');
    });

    it('accepts cloudinary when all credentials are present', () => {
      expect(envValidation(cloudinaryConfig()).IMAGE_STORAGE).toBe(
        'cloudinary',
      );
    });

    it.each(['s3', 'Cloudinary ', 'false'])(
      'rejects the unknown mode %j',
      (value) => {
        const config = { ...baseConfig(), IMAGE_STORAGE: value };

        expect(() => envValidation(config)).toThrow(/IMAGE_STORAGE/);
      },
    );

    it.each(CLOUDINARY_ENV_NAMES)(
      'requires %s when cloudinary is selected',
      (name) => {
        const config = cloudinaryConfig({ [name]: '   ' });

        expect(() => envValidation(config)).toThrow(
          new RegExp(`${name} is required`),
        );
      },
    );

    it('never echoes credential values in the error message', () => {
      const secret = 'super-secret-cloudinary-value';

      let message = '';
      try {
        envValidation(
          cloudinaryConfig({
            CLOUDINARY_CLOUD_NAME: '',
            CLOUDINARY_API_KEY: secret,
          }),
        );
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain('CLOUDINARY_CLOUD_NAME');
      expect(message).not.toContain(secret);
    });
  });
});
