import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // -------------------------------------------------------
      // ① ConditionCounter のアトミック更新 (行ロック不要)
      // -------------------------------------------------------

      // カウンタ行がなければ自動作成
      let counter = await tx.conditionCounter.findUnique({ where: { id: 1 } });

      if (!counter) {
        counter = await tx.conditionCounter.create({
          data: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
        });
      }

      // 次の割り当てを判定
      const { control, modelText, aiWcf } = counter;

      let assignedCondition = "";
      const minVal = Math.min(control, modelText, aiWcf);

      if (control === minVal) assignedCondition = "control";
      else if (modelText === minVal) assignedCondition = "model text";
      else assignedCondition = "ai-wcf";

      // 割り当てたグループのカウンタを +1（アトミック更新）
      if (assignedCondition === "control") {
        await tx.conditionCounter.update({
          where: { id: 1 },
          data: { control: { increment: 1 } },
        });
      } else if (assignedCondition === "model text") {
        await tx.conditionCounter.update({
          where: { id: 1 },
          data: { modelText: { increment: 1 } },
        });
      } else {
        await tx.conditionCounter.update({
          where: { id: 1 },
          data: { aiWcf: { increment: 1 } },
        });
      }

      // -------------------------------------------------------
      // ② Participant の作成 or 更新
      // -------------------------------------------------------
      const participant = await tx.participant.upsert({
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
          survey: body.survey || null,
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
          survey: body.survey || null,
        },
      });

      return { participant, assignedCondition };
    });

    return NextResponse.json({
      ...result.participant,
      condition: result.assignedCondition,
    });
  } catch (e: any) {
    console.error("API error:", e);
    return NextResponse.json(
      { error: "Internal Server Error", detail: e.message || e },
      { status: 500 }
    );
  }
}

