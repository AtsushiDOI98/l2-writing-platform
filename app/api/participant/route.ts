import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  let assignedCondition = body.condition;

  try {
    // もしフロントから condition が送られてこなかったらサーバー側で自動割当
    if (!assignedCondition) {
      const counts = await prisma.participant.groupBy({
        by: ["condition"],
        _count: { condition: true },
      });

      // 3条件のカウントを取得（存在しない条件は0で補完）
      const conditions = ["Control", "Model text", "AI-WCF"];
      const conditionCounts = conditions.map((c) => {
        const found = counts.find((item) => item.condition === c);
        return { condition: c, count: found?._count.condition ?? 0 };
      });

      // 一番人数が少ない条件を選択
      conditionCounts.sort((a, b) => a.count - b.count);
      assignedCondition = conditionCounts[0].condition;
    }

    const participant = await prisma.participant.upsert({
      where: { id: body.id },
      update: {
        name: body.name,
        className: body.className,
        condition: assignedCondition,
        currentStep: body.currentStep,
        brainstorm: body.brainstorm || "",
        pretest: body.pretest || "",
        wcfResult: body.wcfResult || "",
        posttest: body.posttest || "",
        survey: body.survey || {},
        wlEntries: body.wlEntries || {},
      },
      create: {
        id: body.id,
        name: body.name,
        className: body.className,
        condition: assignedCondition,
        currentStep: body.currentStep,
        brainstorm: body.brainstorm || "",
        pretest: body.pretest || "",
        wcfResult: body.wcfResult || "",
        posttest: body.posttest || "",
        survey: body.survey || {},
        wlEntries: body.wlEntries || {},
      },
    });

    return NextResponse.json(participant);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
