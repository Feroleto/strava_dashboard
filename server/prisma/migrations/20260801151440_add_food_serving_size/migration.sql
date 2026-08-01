-- AlterTable
ALTER TABLE "food_logs" ADD COLUMN     "entered_as_serving" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "foods" ADD COLUMN     "serving_grams" DOUBLE PRECISION,
ADD COLUMN     "serving_label" TEXT;
