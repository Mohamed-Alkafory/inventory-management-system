import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type PrismaConfigModule = {
  default: {
    datasource?: { url?: string };
  };
};

/** Re-evaluates prisma.config.ts so env changes take effect. */
async function loadConfig(): Promise<PrismaConfigModule> {
  vi.resetModules();
  return (await import('../../prisma.config.js')) as unknown as PrismaConfigModule;
}

describe('prisma.config datasource', () => {
  const DATABASE_URL = 'postgresql://app@pooled.example.com:5432/db';
  const DIRECT_URL = 'postgresql://app@direct.example.com:5432/db';
  const originalDatabaseUrl = process.env['DATABASE_URL'];
  const originalDirectUrl = process.env['DIRECT_URL'];

  beforeEach(() => {
    process.env['DATABASE_URL'] = DATABASE_URL;
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = originalDatabaseUrl;
    }

    if (originalDirectUrl === undefined) {
      delete process.env['DIRECT_URL'];
    } else {
      process.env['DIRECT_URL'] = originalDirectUrl;
    }
  });

  it('prefers DIRECT_URL for the CLI when it is set', async () => {
    process.env['DIRECT_URL'] = DIRECT_URL;

    const { default: config } = await loadConfig();

    expect(config.datasource?.url).toBe(DIRECT_URL);
  });

  it('falls back to DATABASE_URL when DIRECT_URL is absent', async () => {
    delete process.env['DIRECT_URL'];

    const { default: config } = await loadConfig();

    expect(config.datasource?.url).toBe(DATABASE_URL);
  });

  it('falls back to DATABASE_URL when DIRECT_URL is blank', async () => {
    // dotenv does not overwrite an existing key, so the empty value survives.
    process.env['DIRECT_URL'] = '   ';

    const { default: config } = await loadConfig();

    expect(config.datasource?.url).toBe(DATABASE_URL);
  });
});
