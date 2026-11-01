/**
 * Pool settings for the `pg` adapter used by Prisma 7.
 *
 * `pg` defaults to `connectionTimeoutMillis: 0` (wait forever), which means a
 * suspended Neon compute can hold a request until the hosting platform kills
 * it. The defaults below bound that wait and keep the pool small enough for a
 * free-tier database.
 */
export const PG_POOL_DEFAULTS = {
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
} as const;

export type PgPoolSettings = {
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
};

/** Environment variable feeding each pool setting. */
export const PG_POOL_ENV_NAMES = {
  max: 'PG_POOL_MAX',
  connectionTimeoutMillis: 'PG_CONNECTION_TIMEOUT_MS',
  idleTimeoutMillis: 'PG_IDLE_TIMEOUT_MS',
} as const;

function parsePositiveInt(
  value: unknown,
  fallback: number,
  name: string,
): number {
  // Missing or blank values keep the safe default.
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;

  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer when provided`);
  }

  return parsed;
}

/**
 * Reads `PG_POOL_MAX`, `PG_CONNECTION_TIMEOUT_MS` and `PG_IDLE_TIMEOUT_MS`
 * from the given environment (defaults to `process.env`) and applies the safe
 * defaults when a value is missing. Invalid values throw so startup fails
 * fast instead of silently keeping an unbounded connection.
 */
export function parsePgPoolSettings(
  env: Record<string, unknown> = process.env,
): PgPoolSettings {
  return {
    max: parsePositiveInt(env[PG_POOL_ENV_NAMES.max], PG_POOL_DEFAULTS.max, PG_POOL_ENV_NAMES.max),
    connectionTimeoutMillis: parsePositiveInt(
      env[PG_POOL_ENV_NAMES.connectionTimeoutMillis],
      PG_POOL_DEFAULTS.connectionTimeoutMillis,
      PG_POOL_ENV_NAMES.connectionTimeoutMillis,
    ),
    idleTimeoutMillis: parsePositiveInt(
      env[PG_POOL_ENV_NAMES.idleTimeoutMillis],
      PG_POOL_DEFAULTS.idleTimeoutMillis,
      PG_POOL_ENV_NAMES.idleTimeoutMillis,
    ),
  };
}
