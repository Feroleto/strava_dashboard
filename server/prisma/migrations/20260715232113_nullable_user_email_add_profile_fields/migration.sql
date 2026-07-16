-- AlterTable
ALTER TABLE "users" ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "profile_img_url" TEXT,
ALTER COLUMN "email" DROP NOT NULL;
