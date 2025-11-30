import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    // ---------------------------------------------------------
    // ① ConditionCounter をロックして group を決める
    // ---------------------------------------------------------
    const assignedCondition = await prisma.$transaction(
      async (tx) => {
        // テーブルロック（完全3等分の要）
        await tx.$executeRawUnsafe(
          `LOCK TABLE "ConditionCounter" IN EXCLUSIVE MODE`
        );

        // 行が無い場合は作成
        const counter = await tx.conditionCounter.upsert({
          where: { id: 1 },
          create: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
          update: {},
        });

        const { control, modelText, aiWcf } = counter;

        // 最小値を判定（完全3等分の決定ロジック）
        const minCount = Math.min(control, modelText, aiWcf);
        let conditionToUse = "";

        if (control === minCount) conditionToUse = "control";
        else if (modelText === minCount) conditionToUse = "model text";
        else conditionToUse = "ai-wcf";

        // 選ばれた条件のカウントを +1
        await tx.conditionCounter.update({
          where: { id: 1 },
          data: {
            control: conditionToUse === "control" ? control + 1 : control,
            modelText: conditionToUse === "model text" ? modelText + 1 : modelText,
            aiWcf: conditionToUse === "ai-wcf" ? aiWcf + 1 : aiWcf,
          },
        });

        return conditionToUse;
      },
      {
        isolationLevel: "Serializable",
        timeout: 20000, // 20秒（安全）
      }
    );

    // ---------------------------------------------------------
    // ② Participant の upsert（ロックなし、軽く高速）
    // ---------------------------------------------------------
    const participant = await prisma.participant.upsert({
      where: { id: body.studentId },
      update: {
        name: body.name,
        className: body.className,
        condition: assignedCondition,
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
        condition: assignedCondition,
        currentStep: body.currentStep ?? 0,
        brainstorm: body.brainstorm || "",
        pretest: body.pretest || "",
        wcfResult: body.wcfResult || "",
        posttest: body.posttest || "",
        survey: body.survey || {},
      },
    });

    // ---------------------------------------------------------
    // ③ JSON-safe で返す
    // ---------------------------------------------------------
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


