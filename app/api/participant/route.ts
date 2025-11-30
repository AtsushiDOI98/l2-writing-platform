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

      // ===================================
      // ① ConditionCounter 行のロック
      // ===================================
      const counter = await tx.$queryRawUnsafe<{
        control: number;
        modelText: number;
        aiWcf: number;
      }[]>(`
        SELECT * FROM "ConditionCounter"
        WHERE id = 1
        FOR UPDATE
      `);

      let { control, modelText, aiWcf } = counter[0];

      // ===================================
      // ② 自動割り当て
      // ===================================
      if (!conditionToUse) {
        const min = Math.min(control, modelText, aiWcf);
        if (control === min) conditionToUse = "control";
        else if (modelText === min) conditionToUse = "model text";
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

      // ===================================
      // ③ Participant 保存
      // ===================================
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

      return { participant, conditionToUse };
    });

    return NextResponse.json({
      ...result.participant,
      condition: result.conditionToUse,
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Error", detail: error.message }, { status: 500 });
  }
}



