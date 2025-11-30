import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const { participant, assignedCondition } = await prisma.$transaction(
      async (tx) => {
        // ---------------------------
        // 1. ConditionCounter を FOR UPDATE 行ロック
        // ---------------------------
        let counter: any[] = await tx.$queryRawUnsafe(
          `SELECT * FROM "ConditionCounter" WHERE id = 1 FOR UPDATE`
        );

        // → counter が empty の場合、初期行を作る
        if (counter.length === 0) {
          await tx.$executeRawUnsafe(
            `INSERT INTO "ConditionCounter"(id, control, "modelText", "aiWcf")
             VALUES (1, 0, 0, 0)`
          );

          counter = [
            { id: 1, control: 0, modelText: 0, aiWcf: 0 }
          ];
        }

        const { control, modelText, aiWcf } = counter[0];

        // ---------------------------
        // 2. グループの自動割り振り
        // ---------------------------
        let conditionToUse =
          typeof body.condition === "string"
            ? body.condition.trim().toLowerCase()
            : "";

        if (!conditionToUse) {
          const minCount = Math.min(control, modelText, aiWcf);

          if (control === minCount) conditionToUse = "control";
          else if (modelText === minCount) conditionToUse = "model text";
          else conditionToUse = "ai-wcf";

          await tx.$executeRawUnsafe(
            `UPDATE "ConditionCounter"
             SET control = control + $1,
                 "modelText" = "modelText" + $2,
                 "aiWcf" = "aiWcf" + $3
             WHERE id = 1`,
            conditionToUse === "control" ? 1 : 0,
            conditionToUse === "model text" ? 1 : 0,
            conditionToUse === "ai-wcf" ? 1 : 0
          );
        }

        // ---------------------------
        // 3. Participant を upsert
        // ---------------------------
        const participantRecord = await tx.participant.upsert({
          where: { id: body.studentId },
          update: {
            name: body.name,
            className: body.className,
            condition: conditionToUse,
            currentStep: body.currentStep ?? 0,
            brainstorm: body.brainstorm || "",
            pretest: body.pretest || "",
            wcfResult: body.wcfResult || "",
            posttest: body.posttest || "",
            survey: body.survey || {},
            brainstormElapsed: body.brainstormElapsed ?? 0,
            pretestElapsed: body.pretestElapsed ?? 0,
            reflectionElapsed: body.reflectionElapsed ?? 0,
            posttestElapsed: body.posttestElapsed ?? 0,
          },
          create: {
            id: body.studentId,
            name: body.name,
            className: body.className,
            condition: conditionToUse,
            currentStep: body.currentStep ?? 0,
            brainstorm: body.brainstorm || "",
            pretest: body.pretest || "",
            wcfResult: body.wcfResult || "",
            posttest: body.posttest || "",
            survey: body.survey || {},
            brainstormElapsed: body.brainstormElapsed ?? 0,
            pretestElapsed: body.pretestElapsed ?? 0,
            reflectionElapsed: body.reflectionElapsed ?? 0,
            posttestElapsed: body.posttestElapsed ?? 0,
          },
        });

        return {
          participant: participantRecord,
          assignedCondition: conditionToUse,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return NextResponse.json({
      ...participant,
      condition: assignedCondition,
      survey: participant.survey
        ? JSON.parse(JSON.stringify(participant.survey))
        : {},
    });
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "保存に失敗しました", detail: error?.message },
      { status: 500 }
    );
  }
}

