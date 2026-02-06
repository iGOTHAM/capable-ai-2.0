-- AlterTable: Add provider and aiModel columns to projects
ALTER TABLE "projects" ADD COLUMN "provider" TEXT;
ALTER TABLE "projects" ADD COLUMN "aiModel" TEXT;
