import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const { participant, assignedCondition } = await prisma.$transaction(
      async (tx) => {
        // -------------------------------------------
        // ① ConditionCounter を行ロック（SELECT FOR UPDATE）
        // -------------------------------------------
        let counter = await tx.$queryRawUnsafe(
          `SELECT * FROM "ConditionCounter" WHERE id = 1 FOR UPDATE`
        );

        // クエリ結果（Raw）は配列なので調整
        counter = counter?.[0] || null;

        // 初回（行が存在しない場合）
        if (!counter) {
          await tx.conditionCounter.create({
            data: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
          });
          counter = { id: 1, control: 0, modeltext: 0, aiwcf: 0 };
        }

        // -------------------------------------------
        // ② 最小のカウンターを持つグループに追加
        --------------------------------------------
        const { control, modelText, aiWcf } = counter;

        const minCount = Math.min(control, modelText, aiWcf);
        let conditionToUse = "";

        if (control === minCount) conditionToUse = "control";
        else if (modelText === minCount) conditionToUse = "model text";
        else conditionToUse = "ai-wcf";

        // カウンターを +1 更新
        await tx.conditionCounter.update({
          where: { id: 1 },
          data: {
            control: control + (conditionToUse === "control" ? 1 : 0),
            modelText: modelText + (conditionToUse === "model text" ? 1 : 0),
            aiWcf: aiWcf + (conditionToUse === "ai-wcf" ? 1 : 0),
          },
        });

        // -------------------------------------------
        // ③ Participant を upsert（Elapsed 系なし）
        // -------------------------------------------
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
      { isolationLevel: "Serializable" }
    );

    return NextResponse.json({
      ...participant,
      condition: assignedCondition,
    });
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        error: "保存に失敗しました",
        detail: error?.message,
      },
      { status: 500 }
    );
  }
}

