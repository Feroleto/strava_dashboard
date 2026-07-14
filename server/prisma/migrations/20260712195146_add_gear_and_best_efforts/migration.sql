-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "best_efforts_synced_at" TIMESTAMP(3),
ADD COLUMN     "gear_id" TEXT;

-- CreateTable
CREATE TABLE "gears" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand_name" TEXT,
    "model_name" TEXT,
    "distance" INTEGER NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gears_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_best_efforts" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL,
    "moving_time" INTEGER NOT NULL,
    "elapsed_time" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "pr_rank" INTEGER,
    "start_index" INTEGER,
    "end_index" INTEGER,

    CONSTRAINT "activity_best_efforts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gears_userId_idx" ON "gears"("userId");

-- CreateIndex
CREATE INDEX "activity_best_efforts_name_moving_time_idx" ON "activity_best_efforts"("name", "moving_time");

-- CreateIndex
CREATE INDEX "activity_best_efforts_activityId_idx" ON "activity_best_efforts"("activityId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_gear_id_fkey" FOREIGN KEY ("gear_id") REFERENCES "gears"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gears" ADD CONSTRAINT "gears_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_best_efforts" ADD CONSTRAINT "activity_best_efforts_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
