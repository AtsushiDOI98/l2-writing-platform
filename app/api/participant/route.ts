import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const { participant, assignedCondition } = await prisma.$transaction(
      async (tx) => {
        let conditionToUse =
          typeof body.condition === "string"
            ? body.condition.trim().toLowerCase()
            : "";

        if (!conditionToUse) {
          // ✅ 行ロックをSQLで明示的に実行
          await tx.$executeRawUnsafe(
            `SELECT * FROM "ConditionCounter" WHERE id = 1 FOR UPDATE`
          );

          // カウンタ取得（ロック済み状態）
          let counter = await tx.conditionCounter.findUnique({
            where: { id: 1 },
          });

          // カウンタがなければ作成（upsertで安全に）
          if (!counter) {
            counter = await tx.conditionCounter.upsert({
              where: { id: 1 },
              update: {},
              create: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
            });
          }

          const { control, modelText, aiWcf } = counter;

          // ✅ 最も少ないグループを選択
          const minCount = Math.min(control, modelText, aiWcf);
          if (control === minCount) {
            conditionToUse = "control";
          } else if (modelText === minCount) {
            conditionToUse = "model text";
          } else {
            conditionToUse = "ai-wcf";
          }

          // ✅ 選ばれたグループのカウントを +1
          await tx.conditionCounter.update({
            where: { id: 1 },
            data: {
              control:
                conditionToUse === "control" ? control + 1 : control,
              modelText:
                conditionToUse === "model text" ? modelText + 1 : modelText,
              aiWcf:
                conditionToUse === "ai-wcf" ? aiWcf + 1 : aiWcf,
            },
          });
        }

        // ✅ Participant の登録・更新
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
          },
        });

        return { participant: participantRecord, assignedCondition: conditionToUse };
      },
      { timeout: 30000 } // ← 30秒に延長
    );

    // JSONシリアライズ安全化
    const safeParticipant = {
      ...participant,
      condition: assignedCondition,
      survey: participant.survey
        ? JSON.parse(JSON.stringify(participant.survey))
        : {},
    };

    return NextResponse.json(safeParticipant);
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "保存に失敗しました", detail: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}



