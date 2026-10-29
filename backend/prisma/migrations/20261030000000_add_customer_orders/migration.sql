-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD');

-- AlterTable
ALTER TABLE "orders"
    ADD COLUMN "customer_id" UUID,
    ADD COLUMN "recipient_name" VARCHAR(100),
    ADD COLUMN "recipient_phone" VARCHAR(20),
    ADD COLUMN "shipping_address" TEXT,
    ADD COLUMN "shipping_city" VARCHAR(100),
    ADD COLUMN "payment_method" "PaymentMethod" NOT NULL DEFAULT 'COD';

-- CreateIndex
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
