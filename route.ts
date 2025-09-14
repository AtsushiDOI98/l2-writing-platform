import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();
  let assignedCondition = body.condition;

  try {
    // --- 条件を自動割当 ---
    if (!assignedCondition) {
      const counts = await prisma.participant.groupBy({
        by: ["condition"],
        _count: { condition: true },
      });

      const conditions = ["Control", "Model text", "AI-WCF"];
      const conditionCounts = conditions.map((c) => {
        const found = counts.find((item) => item.condition === c);
        return { condition: c, count: found?._count.condition ?? 0 };
      });

      // 人数が一番少ない条件を選択
      conditionCounts.sort((a, b) => a.count - b.count);
      assignedCondition = conditionCounts[0].condition;
    }

    // --- DB に保存（アップサート）---
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
        wlEntries: body.wlEntries || [],
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
        wlEntries: body.wlEntries || [],
      },
    });

    // --- JSONに安全に変換 ---
    const safeParticipant = {
      ...participant,
      survey: participant.survey ? JSON.parse(JSON.stringify(participant.survey)) : {},
      wlEntries: participant.wlEntries ? JSON.parse(JSON.stringify(participant.wlEntries)) : [],
    };

    // サーバーログに出力（Render で確認用）
    console.log("API が返すデータ:", safeParticipant);

    return NextResponse.json(safeParticipant);
  } catch (error) {
    console.error("API エラー:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
