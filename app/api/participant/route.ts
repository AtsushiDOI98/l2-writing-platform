import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const { participant, assignedCondition } = await prisma.$transaction(
      async (tx) => {
        // -------------------------------------------
        // ① ConditionCounter を SELECT ... FOR UPDATE で行ロック
        // -------------------------------------------
        let counterRaw: any[] = await tx.$queryRawUnsafe(
          `SELECT * FROM "ConditionCounter" WHERE id = 1 FOR UPDATE`
        );

        let counter = counterRaw.length > 0 ? counterRaw[0] : null;

        // -------------------------------------------
        // ② 初回（まだ行が存在しない場合）
        // -------------------------------------------
        if (!counter) {
          await tx.conditionCounter.create({
            data: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
          });

          counter = { id: 1, control: 0, modeltext: 0, aiwcf: 0 };
        }

        // PrismaRaw のカラム名は小文字になる可能性があるので対応
        const control = counter.control ?? counter.control ?? 0;
        const modelText = counter.modelText ?? counter.modeltext ?? 0;
        const aiWcf = counter.aiWcf ?? counter.aiwcf ?? 0;

        // -------------------------------------------
        // ③ 最小のカウンターを持つ条件へ割り当て
        // -------------------------------------------
        const minCount = Math.min(control, modelText, aiWcf);

        let conditionToUse = "";
        if (control === minCount) conditionToUse = "control";
        else if (modelText === minCount) conditionToUse = "model text";
        else conditionToUse = "ai-wcf";

        // -------------------------------------------
        // ④ カウンターを +1 更新
        // -------------------------------------------
        await tx.conditionCounter.update({
          where: { id: 1 },
          data: {
            control: control + (conditionToUse === "control" ? 1 : 0),
            modelText: modelText + (conditionToUse === "model text" ? 1 : 0),
            aiWcf: aiWcf + (conditionToUse === "ai-wcf" ? 1 : 0),
          },
        });

        // -------------------------------------------
        // ⑤ Participant upsert（Elapsed 系なし）
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
