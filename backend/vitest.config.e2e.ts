import { defineConfig } from 'vitest/config';

/**
 * E2E suites reset their database between tests. Point them at a dedicated
 * test database so a developer's local `.env` can never make `resetDb()`
 * truncate development data.
 */
const testDatabaseUrl =
  process.env.E2E_DATABASE_URL ??
  'postgresql://inventory:change_me@localhost:5432/inventory_test?schema=public';

export default defineConfig({
  // Resolve the path aliases declared in tsconfig.json natively (Vite 8+).
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // The real-database suites call resetDb(); running them in parallel would
    // truncate each other's fixtures.
    fileParallelism: false,
    setupFiles: ['./test/setup-env.ts'],
    env: {
      DATABASE_URL: testDatabaseUrl,
    },
  },
});
