-- AlterTable
ALTER TABLE "deployments" ADD COLUMN     "deployMethod" TEXT,
ADD COLUMN     "dropletId" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "size" TEXT;

-- CreateTable
CREATE TABLE "digitalocean_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "doAccountEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digitalocean_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "digitalocean_accounts_userId_key" ON "digitalocean_accounts"("userId");

-- AddForeignKey
ALTER TABLE "digitalocean_accounts" ADD CONSTRAINT "digitalocean_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
