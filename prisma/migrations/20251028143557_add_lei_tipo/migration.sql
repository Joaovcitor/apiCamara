-- CreateEnum
CREATE TYPE "LeiTipo" AS ENUM ('LEI', 'COMPLEMENTAR');

-- AlterTable
ALTER TABLE "leis" ADD COLUMN     "tipo" "LeiTipo" NOT NULL DEFAULT 'LEI';
