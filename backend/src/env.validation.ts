export function envValidation(config: Record<string, unknown>) {
  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  if (!config.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN is required');
  }

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

  return {
    ...config,
    PORT: port,
  };
}
