import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    // ① queue に順番券を発行
    const queueItem = await prisma.assignQueue.create({
      data: {},
    });

    const myTurn = queueItem.id;

    // ② 自分の番になるまで待つ（順番方式）
    //   → これで衝突ゼロになる
    while (true) {
      const smallest = await prisma.assignQueue.findFirst({
        orderBy: { id: "asc" },
      });

      if (smallest && smallest.id === myTurn) break;

      // CPU使用率を上げないよう少し待つ
      await new Promise((r) => setTimeout(r, 50));
    }

    // ③ ここから「自分の番」なので安全に割り当て処理
    let conditionToUse =
      typeof body.condition === "string"
        ? body.condition.trim().toLowerCase()
        : "";

    if (!conditionToUse) {
      // ConditionCounter を取得（なければ作成）
      const counter = await prisma.conditionCounter.upsert({
        where: { id: 1 },
        create: { id: 1, control: 0, modelText: 0, aiWcf: 0 },
        update: {},
      });

      const { control, modelText, aiWcf } = counter;

      const minVal = Math.min(control, modelText, aiWcf);
      if (control === minVal) conditionToUse = "control";
      else if (modelText === minVal) conditionToUse = "model text";
      else conditionToUse = "ai-wcf";

      await prisma.conditionCounter.update({
        where: { id: 1 },
        data: {
          control: conditionToUse === "control" ? control + 1 : control,
          modelText: conditionToUse === "model text" ? modelText + 1 : modelText,
          aiWcf: conditionToUse === "ai-wcf" ? aiWcf + 1 : aiWcf,
        },
      });
    }

    // ④ Participant を upsert
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

    // ⑤ 最後に queue から自分を削除（次の人が処理できる）
    await prisma.assignQueue.delete({
      where: { id: myTurn },
    });

    return NextResponse.json({
      ...participant,
      condition: conditionToUse,
    });
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "保存に失敗しました", detail: error?.message },
      { status: 500 }
    );
  }
}


