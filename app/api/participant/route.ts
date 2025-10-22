import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    // Prisma トランザクション開始
    const { participant, assignedCondition } = await prisma.$transaction(
      async (tx) => {
        let conditionToUse =
          typeof body.condition === "string"
            ? body.condition.trim().toLowerCase()
            : "";

        // ✅ 自動割り当て（ConditionCounterを使う場合のみ）
        if (!conditionToUse) {
          // ✅ テーブルロックで排他制御（同時アクセス防止）
          await tx.$executeRawUnsafe(
            `LOCK TABLE "ConditionCounter" IN EXCLUSIVE MODE`
          );

          // ✅ 1行だけ存在するConditionCounterを安全に取得・作成
          const counter = await tx.conditionCounter.upsert({
            where: { id: 1 },
            create: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
            update: {}, // 既存の場合は何もしない
          });

          const { control, modelText, aiWcf } = counter;

          // ✅ 最小値の条件を自動選択
          const minCount = Math.min(control, modelText, aiWcf);
          if (control === minCount) {
            conditionToUse = "control";
          } else if (modelText === minCount) {
            conditionToUse = "model text";
          } else {
            conditionToUse = "ai-wcf";
          }

          // ✅ 選ばれたグループのカウントを+1更新
          await tx.conditionCounter.update({
            where: { id: 1 },
            data: {
              control: conditionToUse === "control" ? control + 1 : control,
              modelText:
                conditionToUse === "model text" ? modelText + 1 : modelText,
              aiWcf: conditionToUse === "ai-wcf" ? aiWcf + 1 : aiWcf,
            },
          });
        }

        // ✅ Participant（参加者）の登録・更新
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

        // 返却データ
        return { participant: participantRecord, assignedCondition: conditionToUse };
      },
      {
        timeout: 60000,              // ← 長めに余裕を取る
        isolationLevel: "Serializable",
      }
    );

    // JSONシリアライズ安全化（Prismaオブジェクトを純粋JSON化）
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
      {
        error: "保存に失敗しました",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}


