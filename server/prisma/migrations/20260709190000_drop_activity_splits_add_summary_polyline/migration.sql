-- ActivitySplit was removed from the schema while the database was managed via
-- `db push`; record the drop here so migration history matches the live DB.
DROP TABLE IF EXISTS "activity_splits";

-- AlterTable
ALTER TABLE "activities" ADD COLUMN "summary_polyline" TEXT;
