-- AlterTable
ALTER TABLE "verification_tokens" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'email_verification';
