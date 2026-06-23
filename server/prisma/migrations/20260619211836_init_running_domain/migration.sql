-- CreateEnum
CREATE TYPE "workout_type" AS ENUM ('EASY_OR_LONG', 'INTERVAL', 'HILL_REPEATS');

-- CreateEnum
CREATE TYPE "lap_type" AS ENUM ('RUN', 'WORKOUT', 'REST', 'STEADY', 'WARMUP', 'COOLDOWN', 'ACTIVITY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strava_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stravaAthleteId" BIGINT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strava_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stravaId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sport_type" TEXT,
    "workout_type" "workout_type" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "distance_km" DOUBLE PRECISION,
    "moving_time_sec" INTEGER NOT NULL,
    "pace_raw_sec_km" DOUBLE PRECISION,
    "elevation_gain_m" DOUBLE PRECISION,
    "average_bpm" DOUBLE PRECISION,
    "max_bpm" DOUBLE PRECISION,
    "average_cadence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_splits" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "split_index" INTEGER NOT NULL,
    "distance_km" DOUBLE PRECISION NOT NULL,
    "moving_time_sec" INTEGER NOT NULL,
    "pace_min_km" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "activity_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_seconds" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "second_index" INTEGER NOT NULL,
    "distance_total_m" DOUBLE PRECISION NOT NULL,
    "distance_delta_m" DOUBLE PRECISION NOT NULL,
    "speed_m_s" DOUBLE PRECISION,
    "pace_sec_km" DOUBLE PRECISION,
    "elevation_m" DOUBLE PRECISION,
    "heart_rate" INTEGER,
    "cadence" DOUBLE PRECISION,

    CONSTRAINT "activity_seconds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_laps" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "lap_index" INTEGER NOT NULL,
    "lap_type" "lap_type" NOT NULL,
    "start_sec" INTEGER NOT NULL,
    "end_sec" INTEGER NOT NULL,
    "total_duration_sec" INTEGER NOT NULL,
    "moving_duration_sec" INTEGER NOT NULL,
    "distance_m" DOUBLE PRECISION NOT NULL,
    "avg_pace_sec_km" DOUBLE PRECISION NOT NULL,
    "avg_hr" DOUBLE PRECISION NOT NULL,
    "elev_gain_m" DOUBLE PRECISION NOT NULL,
    "avg_grade_percent" DOUBLE PRECISION,
    "vam" DOUBLE PRECISION,
    "avg_cadence" DOUBLE PRECISION,

    CONSTRAINT "activity_laps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "strava_accounts_userId_key" ON "strava_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "strava_accounts_stravaAthleteId_key" ON "strava_accounts"("stravaAthleteId");

-- CreateIndex
CREATE UNIQUE INDEX "activities_stravaId_key" ON "activities"("stravaId");

-- CreateIndex
CREATE INDEX "activities_userId_start_date_idx" ON "activities"("userId", "start_date");

-- CreateIndex
CREATE INDEX "activity_splits_activityId_idx" ON "activity_splits"("activityId");

-- CreateIndex
CREATE INDEX "activity_seconds_activityId_second_index_idx" ON "activity_seconds"("activityId", "second_index");

-- CreateIndex
CREATE INDEX "activity_laps_activityId_lap_index_idx" ON "activity_laps"("activityId", "lap_index");

-- CreateIndex
CREATE INDEX "activity_laps_activityId_lap_type_idx" ON "activity_laps"("activityId", "lap_type");

-- AddForeignKey
ALTER TABLE "strava_accounts" ADD CONSTRAINT "strava_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_splits" ADD CONSTRAINT "activity_splits_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_seconds" ADD CONSTRAINT "activity_seconds_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_laps" ADD CONSTRAINT "activity_laps_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
