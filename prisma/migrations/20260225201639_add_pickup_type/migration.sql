-- CreateEnum
CREATE TYPE "PickupType" AS ENUM ('RIDER_PICKUP', 'SELF_DROP_OFF');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "pickup_type" "PickupType" NOT NULL DEFAULT 'RIDER_PICKUP';
