import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

/**
 * Development seed data (deterministic, safe to rerun — every write is an upsert).
 *
 * Run: `npx prisma db seed` from backend/ (command registered in prisma.config.ts).
 * Requires a migrated database; never run against production.
 *
 * Development-only credentials (change or remove for any shared environment):
 *   admin@example.com / Admin123! (ADMIN)
 *   staff@example.com / Staff123! (STAFF)
 *   customer@example.com / Customer123! (CUSTOMER)
 *   support@example.com / Support123! (SUPPORT)
 * Passwords are stored as bcrypt hashes, never plaintext.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
  }),
});

function lineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

// Fixed ids for rows without a natural unique key (suppliers have no unique
// column), so reruns upsert the same rows instead of duplicating them.
const SUPPLIER_ACME_ID = '11111111-1111-4111-8111-111111111111';
const SUPPLIER_GLOBAL_ID = '22222222-2222-4222-8222-222222222222';

async function main(): Promise<void> {
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const staffPasswordHash = await bcrypt.hash('Staff123!', 10);
  const customerPasswordHash = await bcrypt.hash('Customer123!', 10);
  const supportPasswordHash = await bcrypt.hash('Support123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      name: 'Admin User',
      role: 'ADMIN',
      passwordHash: adminPasswordHash,
    },
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: 'staff@example.com' },
    update: {
      name: 'Staff User',
      role: 'STAFF',
      passwordHash: staffPasswordHash,
    },
    create: {
      name: 'Staff User',
      email: 'staff@example.com',
      passwordHash: staffPasswordHash,
      role: 'STAFF',
    },
  });

  await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {
      name: 'Customer User',
      role: 'CUSTOMER',
      passwordHash: customerPasswordHash,
    },
    create: {
      name: 'Customer User',
      email: 'customer@example.com',
      passwordHash: customerPasswordHash,
      role: 'CUSTOMER',
    },
  });

  await prisma.user.upsert({
    where: { email: 'support@example.com' },
    update: {
      name: 'Support User',
      role: 'SUPPORT',
      passwordHash: supportPasswordHash,
    },
    create: {
      name: 'Support User',
      email: 'support@example.com',
      passwordHash: supportPasswordHash,
      role: 'SUPPORT',
    },
  });

  const categories = await Promise.all(
    [
      { name: 'Electronics', description: 'Devices and accessories' },
      { name: 'Apparel', description: 'Clothing and wearables' },
      { name: 'Home & Kitchen', description: 'Home and kitchen goods' },
      { name: 'Office Supplies', description: 'Stationery and office goods' },
    ].map((c) =>
      prisma.category.upsert({
        where: { name: c.name },
        update: { description: c.description },
        create: c,
      }),
    ),
  );
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

  const acme = await prisma.supplier.upsert({
    where: { id: SUPPLIER_ACME_ID },
    update: {
      companyName: 'Acme Corp',
      email: 'sales@acme.example',
      phone: '+1-555-0100',
    },
    create: {
      id: SUPPLIER_ACME_ID,
      companyName: 'Acme Corp',
      email: 'sales@acme.example',
      phone: '+1-555-0100',
      address: '100 Market St, Springfield',
    },
  });

  const global = await prisma.supplier.upsert({
    where: { id: SUPPLIER_GLOBAL_ID },
    update: {
      companyName: 'Global Traders',
      email: 'hello@globaltraders.example',
    },
    create: {
      id: SUPPLIER_GLOBAL_ID,
      companyName: 'Global Traders',
      email: 'hello@globaltraders.example',
      phone: '+1-555-0200',
      address: '200 Harbor Ave, Shelbyville',
    },
  });

  const productInputs = [
    {
      sku: 'ELE-LAP-001',
      name: 'Laptop Pro 14',
      barcode: '100000000001',
      price: 1299.99,
      costPrice: 950.0,
      quantity: 25,
      minStock: 5,
      categoryId: categoryByName.get('Electronics') as string,
      supplierId: acme.id,
    },
    {
      sku: 'ELE-MOU-002',
      name: 'Wireless Mouse',
      barcode: '100000000002',
      price: 29.99,
      costPrice: 12.5,
      quantity: 200,
      minStock: 20,
      categoryId: categoryByName.get('Electronics') as string,
      supplierId: acme.id,
    },
    {
      sku: 'APP-TSH-001',
      name: 'Cotton T-Shirt',
      barcode: '100000000003',
      price: 19.99,
      costPrice: 8.0,
      quantity: 150,
      minStock: 30,
      categoryId: categoryByName.get('Apparel') as string,
      supplierId: global.id,
    },
    {
      sku: 'HOM-MUG-001',
      name: 'Ceramic Mug',
      barcode: '100000000004',
      price: 12.5,
      costPrice: 4.25,
      quantity: 80,
      minStock: 10,
      categoryId: categoryByName.get('Home & Kitchen') as string,
      supplierId: global.id,
    },
    {
      sku: 'OFF-NBK-001',
      name: 'Notebook A5',
      barcode: '100000000005',
      price: 6.99,
      costPrice: 2.1,
      quantity: 300,
      minStock: 50,
      categoryId: categoryByName.get('Office Supplies') as string,
      supplierId: acme.id,
    },
    {
      sku: 'OFF-PEN-002',
      name: 'Ballpoint Pen',
      barcode: null,
      price: 1.99,
      costPrice: null,
      quantity: 500,
      minStock: 100,
      categoryId: categoryByName.get('Office Supplies') as string,
      supplierId: null,
    },
  ];

  const products = await Promise.all(
    productInputs.map((p) =>
      prisma.product.upsert({
        where: { sku: p.sku },
        update: {
          name: p.name,
          price: p.price,
          costPrice: p.costPrice,
          quantity: p.quantity,
          minStock: p.minStock,
          categoryId: p.categoryId,
          supplierId: p.supplierId,
        },
        create: {
          sku: p.sku,
          name: p.name,
          barcode: p.barcode,
          price: p.price,
          costPrice: p.costPrice,
          quantity: p.quantity,
          minStock: p.minStock,
          categoryId: p.categoryId,
          supplierId: p.supplierId,
        },
      }),
    ),
  );
  const productBySku = new Map(products.map((p) => [p.sku, p]));

  const orderInputs = [
    {
      orderNumber: 'ORD-0001',
      status: 'CONFIRMED' as const,
      customerName: 'Jane Doe',
      customerPhone: '+1-555-0300',
      createdById: staff.id,
      items: [
        { sku: 'ELE-LAP-001', quantity: 2 },
        { sku: 'ELE-MOU-002', quantity: 5 },
      ],
    },
    {
      orderNumber: 'ORD-0002',
      status: 'PENDING' as const,
      customerName: 'John Smith',
      customerPhone: '+1-555-0400',
      createdById: admin.id,
      items: [{ sku: 'APP-TSH-001', quantity: 10 }],
    },
  ];

  for (const o of orderInputs) {
    const items = o.items.map((item) => {
      const product = productBySku.get(item.sku);
      if (!product) {
        throw new Error(`Seed product missing for sku ${item.sku}`);
      }
      const unitPrice = Number(product.price);
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unitPrice,
        lineTotal: lineTotal(item.quantity, unitPrice),
      };
    });
    const totalAmount = items.reduce((sum, i) => sum + i.lineTotal, 0);

    const order = await prisma.order.upsert({
      where: { orderNumber: o.orderNumber },
      update: {
        status: o.status,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        totalAmount,
        createdById: o.createdById,
      },
      create: {
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        totalAmount,
        createdById: o.createdById,
      },
    });

    for (const item of items) {
      await prisma.orderItem.upsert({
        where: {
          orderId_productId: { orderId: order.id, productId: item.productId },
        },
        update: {
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        },
        create: {
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        },
      });
    }
  }

  console.log(
    `Seed complete: 4 users, 4 categories, 2 suppliers, 6 products, 2 orders.`,
  );
}

main()
  .catch((e: unknown) => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
