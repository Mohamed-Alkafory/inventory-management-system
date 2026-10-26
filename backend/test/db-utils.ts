import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const url =
  process.env['DATABASE_URL'] ||
  'postgresql://inventory:change_me@localhost:5432/inventory_test?schema=public';

/**
 * `resetDb()` truncates every table, so it must never point at a development
 * or production database. e2e tests use `inventory_test` (see
 * `vitest.config.e2e.ts`); this guard is the last line of defence.
 */
const databaseName = new URL(url).pathname.replace(/^\//, '');
if (!/test/i.test(databaseName)) {
  throw new Error(
    `Refusing to run destructive database tests against "${databaseName}". ` +
      'Set E2E_DATABASE_URL (or DATABASE_URL) to a dedicated test database.',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

export async function resetDb() {
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  if (!tables) return;

  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  } catch (error) {
    console.error('Error resetting database:', error);
  }
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
