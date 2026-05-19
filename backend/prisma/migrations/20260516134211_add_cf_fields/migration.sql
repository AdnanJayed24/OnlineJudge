-- AlterTable
ALTER TABLE "problems" ADD COLUMN     "cf_contest_id" INTEGER,
ADD COLUMN     "cf_index" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'local';
