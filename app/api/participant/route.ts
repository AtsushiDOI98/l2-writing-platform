import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  // 🔥 同時アクセスをばらけさせる（50〜150ms）
  await new Promise((r) => setTimeout(r, Math.random() * 100 + 50));

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        let conditionToUse =
          typeof body.condition === "string"
            ? body.condition.trim().toLowerCase()
            : "";

        // ---------------------------
        // ① condition が未指定なら均等自動割り当て
        // ---------------------------
        if (!conditionToUse) {
          // -------- ①-1 アトミック SQL による自動 +1 更新 --------
          const counter = await tx.$queryRaw<
            { control: number; modelText: number; aiWcf: number }[]
          >`
            UPDATE "ConditionCounter"
            SET
              control = control + CASE 
                          WHEN control <= "modelText" AND control <= "aiWcf" THEN 1
                          ELSE 0
                        END,
              "modelText" = "modelText" + CASE
                                WHEN "modelText" < control AND "modelText" <= "aiWcf" THEN 1
                                ELSE 0
                              END,
              "aiWcf" = "aiWcf" + CASE
                            WHEN "aiWcf" < control AND "aiWcf" < "modelText" THEN 1
                            ELSE 0
                          END
            WHERE id = 1
            RETURNING control, "modelText", "aiWcf";
          `;

          const updated = counter[0];

          // -------- ①-2 割り当てられたグループを逆算 --------
          if (
            updated.control >= updated.modelText &&
            updated.control >= updated.aiWcf
          ) {
            conditionToUse = "control";
          } else if (
            updated.modelText >= updated.control &&
            updated.modelText >= updated.aiWcf
          ) {
            conditionToUse = "model text";
          } else {
            conditionToUse = "ai-wcf";
          }
        }

        // ---------------------------
        // ② Participant upsert
        // ---------------------------
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

        return { participant, assigned: conditionToUse };
      },

      // ---------------------------
      // トランザクション設定
      // ---------------------------
      {
        timeout: 60000,
        isolationLevel: "Serializable", // ← 衝突を安全に排除
      }
    );

    // ---------------------------
    // ③ JSON返却（安全化）
    // ---------------------------
    return NextResponse.json({
      ...result.participant,
      condition: result.assigned,
      survey: result.participant.survey
        ? JSON.parse(JSON.stringify(result.participant.survey))
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


