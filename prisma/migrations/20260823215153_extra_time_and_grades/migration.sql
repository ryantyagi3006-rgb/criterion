-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "criterionLevels" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "extraMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "grade" INTEGER;

