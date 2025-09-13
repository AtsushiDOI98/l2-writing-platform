/*
  Warnings:

  - You are about to drop the `Session` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Session" DROP CONSTRAINT "Session_participantId_fkey";

-- AlterTable
ALTER TABLE "public"."Participant" ADD COLUMN     "brainstorm" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "posttest" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pretest" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "survey" JSONB,
ADD COLUMN     "wcfResult" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "wlEntries" JSONB;

-- DropTable
DROP TABLE "public"."Session";
