import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    let conditionToUse =
      typeof body.condition === "string"
        ? body.condition.trim().toLowerCase()
        : "";

    // ================================
    // ① 自動割り当て（原子的インクリメント方式）
    // ================================
    if (!conditionToUse) {
      const updated = await prisma.$queryRaw<{
        assigned: string;
        control: number;
        modelText: number;
        aiWcf: number;
      }[]>`
        UPDATE "ConditionCounter"
        SET
          control = control + CASE
                      WHEN control <= "modelText" AND control <= "aiWcf"
                        THEN 1 ELSE 0 END,
          "modelText" = "modelText" + CASE
                      WHEN "modelText" < control AND "modelText" <= "aiWcf"
                        THEN 1 ELSE 0 END,
          "aiWcf" = "aiWcf" + CASE
                      WHEN "aiWcf" < control AND "aiWcf" < "modelText"
                        THEN 1 ELSE 0 END
        WHERE id = 1
        RETURNING
          CASE
            WHEN control <= "modelText" AND control <= "aiWcf"
              THEN 'control'
            WHEN "modelText" < control AND "modelText" <= "aiWcf"
              THEN 'model text'
            ELSE 'ai-wcf'
          END AS assigned,
          control,
          "modelText",
          "aiWcf";
      `;

      conditionToUse = updated[0].assigned;
    }

    // ================================
    // ② Participant 保存
    // ================================
    const participant = await prisma.participant.upsert({
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

    // 返却
    return NextResponse.json({
      ...participant,
      condition: conditionToUse,
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



