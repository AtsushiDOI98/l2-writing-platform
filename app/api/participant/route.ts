import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  // 🔥 同時アクセスをばらけさせる（50〜150ms）
  await new Promise((r) => setTimeout(r, Math.random() * 100 + 50));

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        //
        // --------------- ① 条件が指定されていなければ自動割り当て ---------------
        //
        let conditionToUse =
          typeof body.condition === "string"
            ? body.condition.trim().toLowerCase()
            : "";

        if (!conditionToUse) {
          // ConditionCounter が存在しない可能性がある → 先に保証
          await tx.conditionCounter.upsert({
            where: { id: 1 },
            create: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
            update: {},
          });

          // -------- アトミック更新（均等 3 分割） --------
          const updatedRows = await tx.$queryRaw<
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

          const updated = updatedRows[0];

          // -------- 逆算してどの condition が付与されたか決める --------
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

        //
        // --------------- ② Participant を upsert (登録 / 更新) ---------------
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

        return {
          participant,
          assignedCondition: conditionToUse,
        };
      },
      {
        timeout: 60000,
        isolationLevel: "Serializable",
      }
    );

    //
    // --------------- ③ JSON 返却 ---------------
    //
    return NextResponse.json({
      ...result.participant,
      condition: result.assignedCondition,
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


