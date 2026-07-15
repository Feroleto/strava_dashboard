-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "hr_zones_synced_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "athlete_hr_zones" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "custom_zones" BOOLEAN NOT NULL,
    "zones" JSONB NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_hr_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_hr_zone_time" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "zone_index" INTEGER NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "time_sec" INTEGER NOT NULL,

    CONSTRAINT "activity_hr_zone_time_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_hr_zones_userId_key" ON "athlete_hr_zones"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "activity_hr_zone_time_activityId_zone_index_key" ON "activity_hr_zone_time"("activityId", "zone_index");

-- AddForeignKey
ALTER TABLE "athlete_hr_zones" ADD CONSTRAINT "athlete_hr_zones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_hr_zone_time" ADD CONSTRAINT "activity_hr_zone_time_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
