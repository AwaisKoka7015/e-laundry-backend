-- CreateTable
CREATE TABLE "favourites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "laundry_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favourites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "favourites_user_id_idx" ON "favourites"("user_id");

-- CreateIndex
CREATE INDEX "favourites_laundry_id_idx" ON "favourites"("laundry_id");

-- CreateIndex
CREATE UNIQUE INDEX "favourites_user_id_laundry_id_key" ON "favourites"("user_id", "laundry_id");

-- AddForeignKey
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favourites" ADD CONSTRAINT "favourites_laundry_id_fkey" FOREIGN KEY ("laundry_id") REFERENCES "laundries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
