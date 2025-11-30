import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ① 自動割り当て（condition が client で指定されていない場合）
      let conditionToUse =
        typeof body.condition === "string"
          ? body.condition.trim().toLowerCase()
          : "";

      if (!conditionToUse) {
        // ConditionCounter がなければ作成
        await tx.conditionCounter.upsert({
          where: { id: 1 },
          create: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
          update: {},
        });

        // 現在のカウントを取得
        const counter = await tx.conditionCounter.findUnique({
          where: { id: 1 },
        });

        const { control, modelText, aiWcf } = counter!;
        const minCount = Math.min(control, modelText, aiWcf);

        if (control === minCount) conditionToUse = "control";
        else if (modelText === minCount) conditionToUse = "model text";
        else conditionToUse = "ai-wcf";

        // 割り当てたカウントを increment
        await tx.conditionCounter.update({
          where: { id: 1 },
          data: {
            control: control + (conditionToUse === "control" ? 1 : 0),
            modelText: modelText + (conditionToUse === "model text" ? 1 : 0),
            aiWcf: aiWcf + (conditionToUse === "ai-wcf" ? 1 : 0),
          },
        });
      }

      // ② Participant 登録/更新
      const participant = await tx.participant.upsert({
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

      return { participant, assignedCondition: conditionToUse };
    }); // トランザクション終了

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
        error: "保存失敗",
        detail: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

