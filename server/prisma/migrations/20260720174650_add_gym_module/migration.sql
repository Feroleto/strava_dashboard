-- CreateEnum
CREATE TYPE "exercise_source" AS ENUM ('SEED', 'USER');

-- CreateEnum
CREATE TYPE "muscle_group" AS ENUM ('CHEST', 'BACK', 'LATS', 'TRAPS', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS', 'ABDOMINALS', 'QUADRICEPS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ADDUCTORS', 'ABDUCTORS', 'LOWER_BACK', 'NECK', 'CARDIO', 'FULL_BODY');

-- CreateEnum
CREATE TYPE "equipment" AS ENUM ('BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODY_ONLY', 'KETTLEBELLS', 'BANDS', 'MEDICINE_BALL', 'EXERCISE_BALL', 'FOAM_ROLL', 'EZ_CURL_BAR', 'OTHER');

-- CreateEnum
CREATE TYPE "exercise_level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'EXPERT');

-- CreateEnum
CREATE TYPE "exercise_force" AS ENUM ('PUSH', 'PULL', 'STATIC');

-- CreateEnum
CREATE TYPE "exercise_mechanic" AS ENUM ('COMPOUND', 'ISOLATION');

-- CreateEnum
CREATE TYPE "set_type" AS ENUM ('WARMUP', 'WORKING', 'DROPSET');

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "force" "exercise_force",
    "level" "exercise_level",
    "mechanic" "exercise_mechanic",
    "equipment" "equipment",
    "primary_muscles" "muscle_group"[],
    "secondary_muscles" "muscle_group"[],
    "instructions" TEXT[],
    "image_urls" TEXT[],
    "source" "exercise_source" NOT NULL DEFAULT 'SEED',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_exercises" (
    "id" TEXT NOT NULL,
    "workout_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "superset_group_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sets" (
    "id" TEXT NOT NULL,
    "workout_exercise_id" TEXT NOT NULL,
    "set_number" INTEGER NOT NULL,
    "weight_kg" DECIMAL(6,2),
    "reps" INTEGER,
    "rpe" DECIMAL(3,1),
    "set_type" "set_type" NOT NULL DEFAULT 'WORKING',
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_slug_key" ON "exercises"("slug");

-- CreateIndex
CREATE INDEX "exercises_source_idx" ON "exercises"("source");

-- CreateIndex
CREATE INDEX "workouts_userId_started_at_idx" ON "workouts"("userId", "started_at");

-- CreateIndex
CREATE INDEX "workout_exercises_workout_id_idx" ON "workout_exercises"("workout_id");

-- CreateIndex
CREATE INDEX "workout_exercises_exercise_id_idx" ON "workout_exercises"("exercise_id");

-- CreateIndex
CREATE INDEX "workout_sets_workout_exercise_id_idx" ON "workout_sets"("workout_exercise_id");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "workout_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
