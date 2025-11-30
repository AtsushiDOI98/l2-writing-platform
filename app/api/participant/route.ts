// /app/api/participant/route.ts
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

        // -------------------------
        // 1. 自動割り振り（行ロック版）
        // -------------------------
        if (!conditionToUse) {
          // ConditionCounter の1行だけをロック（高速・安全）
          let counter = await tx.conditionCounter.findUnique({
            where: { id: 1 },
            lock: { mode: "update" }, // ← 行ロック発動
          });

          // 初回（まだ行がない場合）
          if (!counter) {
            counter = await tx.conditionCounter.create({
              data: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
            });
          }

          const { control, modelText, aiWcf } = counter;
          const minCount = Math.min(control, modelText, aiWcf);

          if (control === minCount) conditionToUse = "control";
          else if (modelText === minCount) conditionToUse = "model text";
          else conditionToUse = "ai-wcf";

          // カウンタ更新
          await tx.conditionCounter.update({
            where: { id: 1 },
            data: {
              control: control + (conditionToUse === "control" ? 1 : 0),
              modelText: modelText + (conditionToUse === "model text" ? 1 : 0),
              aiWcf: aiWcf + (conditionToUse === "ai-wcf" ? 1 : 0),
            },
          });
        }

        // -------------------------
        // 2. Participant のアップサート
        // -------------------------
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

    // Prisma オブジェクトの安全変換
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


