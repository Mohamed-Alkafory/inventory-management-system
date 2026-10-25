import 'dotenv/config';

/**
 * The e2e suites replace Prisma with an in-memory fake, so they must not depend
 * on a developer's local `.env` (or a running database) to boot the app module.
 * Only fill in defaults that are missing; real environment values win.
 */
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_SECRET ??= "test-only-secret-not-for-production";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
