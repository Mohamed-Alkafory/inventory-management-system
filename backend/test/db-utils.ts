import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const url =
  process.env['DATABASE_URL'] ||
  'postgresql://inventory:change_me@localhost:5433/inventory_db?schema=public';

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
