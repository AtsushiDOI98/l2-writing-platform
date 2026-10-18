/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `ConditionCounter` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Participant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."ConditionCounter" DROP COLUMN "updatedAt",
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."Participant" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
