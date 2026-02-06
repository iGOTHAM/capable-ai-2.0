-- AlterTable: Convert mode from ProjectMode enum to plain String
ALTER TABLE "projects" ALTER COLUMN "mode" SET DATA TYPE TEXT;

-- Set all existing rows to AUTONOMOUS
UPDATE "projects" SET "mode" = 'AUTONOMOUS' WHERE "mode" IN ('DRAFT_ONLY', 'ASK_FIRST');

-- Set default
ALTER TABLE "projects" ALTER COLUMN "mode" SET DEFAULT 'AUTONOMOUS';

-- Drop the enum type
DROP TYPE IF EXISTS "ProjectMode";
