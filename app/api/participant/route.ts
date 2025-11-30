import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const result = await prisma.$transaction(async (tx) => {
      let conditionToUse =
        typeof body.condition === "string"
          ? body.condition.trim().toLowerCase()
          : "";

      // ============================
      // Queue 方式（最強・デッドロックなし）
      // ============================

      // ① Queue に自分の順番行を追加
      const myQueue = await tx.assignQueue.create({
        data: {},
      });

      // ② 自分より前の並び順が終わるまで待つ
      await tx.$queryRawUnsafe(`
        SELECT id FROM "AssignQueue"
        WHERE id < ${myQueue.id}
        FOR UPDATE
      `);

      // ③ 安全に ConditionCounter を読み取り
      const counter = await tx.conditionCounter.upsert({
        where: { id: 1 },
        create: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
        update: {},
      });

      const { control, modelText, aiWcf } = counter;

      if (!conditionToUse) {
        const minCount = Math.min(control, modelText, aiWcf);
        if (control === minCount) conditionToUse = "control";
        else if (modelText === minCount) conditionToUse = "model text";
        else conditionToUse = "ai-wcf";

        // カウンタ更新
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

      // ④ Participant を登録
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
    });

    const { participant, assignedCondition } = result;

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
      {
        error: "保存に失敗しました",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

