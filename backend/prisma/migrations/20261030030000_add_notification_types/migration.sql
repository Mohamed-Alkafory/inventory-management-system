-- Additive enum values only (existing notification rows are unaffected).
-- The positions match the Prisma schema so `prisma migrate diff` stays empty.
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_CONFIRMED' AFTER 'ORDER_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'CONTACT_MESSAGE_RECEIVED' AFTER 'PURCHASE_ORDER_RECEIVED';
