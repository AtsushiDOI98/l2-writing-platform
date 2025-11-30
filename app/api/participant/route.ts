export async function POST(req: Request) {
  const body = await req.json();

  // 🔥 ランダムディレイを入れて同時アクセスを自然に散らす
  // 50ms〜150ms のランダム遅延
  await new Promise((r) => setTimeout(r, Math.random() * 100 + 50));

  try {
    const { participant, assignedCondition } = await prisma.$transaction(
      async (tx) => {
        let conditionToUse =
          typeof body.condition === "string"
            ? body.condition.trim().toLowerCase()
            : "";

        if (!conditionToUse) {
          await tx.$executeRawUnsafe(
            `LOCK TABLE "ConditionCounter" IN EXCLUSIVE MODE`
          );

          const counter = await tx.conditionCounter.upsert({
            where: { id: 1 },
            create: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
            update: {},
          });

          const { control, modelText, aiWcf } = counter;
          const minCount = Math.min(control, modelText, aiWcf);

          if (control === minCount) {
            conditionToUse = "control";
          } else if (modelText === minCount) {
            conditionToUse = "model text";
          } else {
            conditionToUse = "ai-wcf";
          }

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

        const participantRecord = await tx.participant.upsert({
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

        return { participant: participantRecord, assignedCondition: conditionToUse };
      },
      {
        timeout: 60000,
        isolationLevel: "Serializable",
      }
    );

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


