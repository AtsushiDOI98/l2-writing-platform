import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  // 🔥 同時アクセスの集中を少し散らす（50–150ms）
  await new Promise((r) => setTimeout(r, Math.random() * 100 + 50));

  try {
    const result = await prisma.$transaction(async (tx) => {
      //
      // ① アトミックに ConditionCounter を更新（最小値のグループを1つ増やす）
      //
      const counter = await tx.$queryRaw<
        { control: number; modeltext: number; aiwcf: number }[]
      >`
        UPDATE "ConditionCounter"
        SET
          control = control + CASE 
                      WHEN control <= modelText AND control <= aiWcf THEN 1
                      ELSE 0
                    END,
          modelText = modelText + CASE
                        WHEN modelText < control AND modelText <= aiWcf THEN 1
                        ELSE 0
                      END,
          aiWcf = aiWcf + CASE
                    WHEN aiWcf < control AND aiWcf < modelText THEN 1
                    ELSE 0
                  END
        WHERE id = 1
        RETURNING control, modelText, aiWcf;
      `;

      const updated = counter[0];

      //
      // ② 今回割り当てられた条件を逆算
      //
      let conditionToUse = "";
      if (
        updated.control >= updated.modeltext &&
        updated.control >= updated.aiwcf
      ) {
        conditionToUse = "control";
      } else if (
        updated.modeltext >= updated.control &&
        updated.modeltext >= updated.aiwcf
      ) {
        conditionToUse = "model text";
      } else {
        conditionToUse = "ai-wcf";
      }

      //
      // ③ Participant の作成/更新
      //
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

    return NextResponse.json(result);
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



