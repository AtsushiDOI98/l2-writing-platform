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

        // ✅ 自動割り当て（ConditionCounter を使用）
        if (!conditionToUse) {
          // カウンタテーブルをロック
          await tx.$executeRaw`LOCK TABLE "ConditionCounter" IN EXCLUSIVE MODE`;

          // カウンタがなければ作成
          let counter = await tx.conditionCounter.findUnique({
            where: { id: 1 },
          });
          if (!counter) {
            counter = await tx.conditionCounter.create({ data: {} });
          }

          // 現在のカウントを取得
          const { control, modelText, aiWcf } = counter;

          // 最も少ないグループを選択
          const minCount = Math.min(control, modelText, aiWcf);
          if (control === minCount) {
            conditionToUse = "control";
          } else if (modelText === minCount) {
            conditionToUse = "model text";
          } else {
            conditionToUse = "ai-wcf";
          }

          // ✅ 選ばれたグループのカウントを+1
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
      { timeout: 10000 } // 10秒タイムアウト（同時アクセスに余裕を持たせる）
    );

    // JSON シリアライズ（エラー防止）
    const safeParticipant = {
      ...participant,
      condition: assignedCondition,
      survey: participant.survey
        ? JSON.parse(JSON.stringify(participant.survey))
        : {},
    };

    return NextResponse.json(safeParticipant);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "保存に失敗しました" },
      { status: 500 }
    );
  }
}


