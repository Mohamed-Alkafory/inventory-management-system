import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolve the path aliases declared in tsconfig.json natively (Vite 8+).
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
  },
});
