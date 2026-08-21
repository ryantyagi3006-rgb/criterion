-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "aiCriterionScores" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "criterionScores" TEXT NOT NULL DEFAULT '{}';

