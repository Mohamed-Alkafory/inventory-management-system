import { describe, expect, it } from 'vitest';
import {
  PG_POOL_DEFAULTS,
  PG_POOL_ENV_NAMES,
  parsePgPoolSettings,
} from './pool-options.js';

describe('parsePgPoolSettings', () => {
  it('applies bounded defaults when nothing is configured', () => {
    expect(parsePgPoolSettings({})).toEqual({
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
    });
  });

  it('keeps the defaults for blank values', () => {
    expect(
      parsePgPoolSettings({
        [PG_POOL_ENV_NAMES.max]: '',
        [PG_POOL_ENV_NAMES.connectionTimeoutMillis]: '   ',
        [PG_POOL_ENV_NAMES.idleTimeoutMillis]: '',
      }),
    ).toEqual(PG_POOL_DEFAULTS);
  });

  it('reads positive integers from the environment', () => {
    expect(
      parsePgPoolSettings({
        [PG_POOL_ENV_NAMES.max]: '12',
        [PG_POOL_ENV_NAMES.connectionTimeoutMillis]: '2500',
        [PG_POOL_ENV_NAMES.idleTimeoutMillis]: '30000',
      }),
    ).toEqual({
      max: 12,
      connectionTimeoutMillis: 2500,
      idleTimeoutMillis: 30000,
    });
  });

  it('accepts numeric values (not only strings)', () => {
    expect(
      parsePgPoolSettings({
        [PG_POOL_ENV_NAMES.max]: 8,
        [PG_POOL_ENV_NAMES.connectionTimeoutMillis]: 1500,
        [PG_POOL_ENV_NAMES.idleTimeoutMillis]: 5000,
      }),
    ).toEqual({
      max: 8,
      connectionTimeoutMillis: 1500,
      idleTimeoutMillis: 5000,
    });
  });

  it.each([
    ['max', '0'],
    ['max', '-1'],
    ['max', '1.5'],
    ['max', 'abc'],
    ['connectionTimeoutMillis', '0'],
    ['connectionTimeoutMillis', 'forever'],
    ['idleTimeoutMillis', '-2000'],
    ['idleTimeoutMillis', 'NaN'],
  ] as const)('rejects an invalid %s value: %s', (field, value) => {
    expect(() =>
      parsePgPoolSettings({ [PG_POOL_ENV_NAMES[field]]: value }),
    ).toThrow(new RegExp(PG_POOL_ENV_NAMES[field]));
  });

  it('defaults to process.env when no argument is given', () => {
    const original = process.env[PG_POOL_ENV_NAMES.max];

    try {
      process.env[PG_POOL_ENV_NAMES.max] = '7';

      expect(parsePgPoolSettings().max).toBe(7);
    } finally {
      if (original === undefined) {
        delete process.env[PG_POOL_ENV_NAMES.max];
      } else {
        process.env[PG_POOL_ENV_NAMES.max] = original;
      }
    }
  });
});
