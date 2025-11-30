-- CreateTable
CREATE TABLE "public"."Participant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "brainstorm" TEXT NOT NULL DEFAULT '',
    "pretest" TEXT NOT NULL DEFAULT '',
    "wcfResult" TEXT NOT NULL DEFAULT '',
    "posttest" TEXT NOT NULL DEFAULT '',
    "survey" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConditionCounter" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "control" INTEGER NOT NULL DEFAULT 0,
    "modelText" INTEGER NOT NULL DEFAULT 0,
    "aiWcf" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConditionCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssignQueue" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignQueue_pkey" PRIMARY KEY ("id")
);
