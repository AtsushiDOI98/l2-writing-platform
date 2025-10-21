import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    const { participant, condition: assignedCondition } =
      await prisma.$transaction(async (tx) => {
        let conditionToUse =
          typeof body.condition === "string" ? body.condition.trim() : "";

        if (conditionToUse) {
          conditionToUse = conditionToUse.toLowerCase();
        }

        // もしフロントから condition が送られてこなかったらサーバー側で自動割当
        if (!conditionToUse) {
          await tx.$executeRaw`LOCK TABLE "Participant" IN SHARE ROW EXCLUSIVE MODE`;

          const counts = await tx.participant.groupBy({
            by: ["condition"],
            _count: { condition: true },
          });

          const conditions = ["control", "model text", "ai-wcf"];
          const conditionCounts = conditions.map((c) => {
            const found = counts.find((item) => item.condition === c);
            return { condition: c, count: found?._count.condition ?? 0 };
          });

          conditionCounts.sort((a, b) => a.count - b.count);
          conditionToUse = conditionCounts[0].condition;
        }

        const participantRecord = await tx.participant.upsert({
          where: { id: body.studentId }, // ← 学籍番号を主キーに使う
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
            id: body.studentId, // ← id = 学籍番号
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

        return { participant: participantRecord, condition: conditionToUse };
      });

    // JSON に変換して返す（必ずシリアライズ可能にする）
    const safeParticipant = {
      ...participant,
      condition: assignedCondition.toLowerCase(),
      survey: participant.survey ? JSON.parse(JSON.stringify(participant.survey)) : {},
    };

    return NextResponse.json(safeParticipant);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}


