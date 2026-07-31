-- AlterEnum
ALTER TYPE "meal_type" ADD VALUE 'SUPPER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "daily_carbs_goal" INTEGER NOT NULL DEFAULT 250,
ADD COLUMN     "daily_fat_goal" INTEGER NOT NULL DEFAULT 65,
ADD COLUMN     "daily_kcal_goal" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "daily_protein_goal" INTEGER NOT NULL DEFAULT 150;
