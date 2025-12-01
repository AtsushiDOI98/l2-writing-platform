import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  const body = await req.json();

  let condition: string =
    typeof body.condition === "string"
      ? body.condition.trim().toLowerCase()
      : "";

  try {
    // ===================================================
    // ① Redis のハッシュ condition:counts を読み込む
    // ===================================================
    let counts = await redis.hgetall("condition:counts");

    // もし初期状態なら、自動で全フィールド = 0 で初期化
    if (!counts || Object.keys(counts).length === 0) {
      await redis.hset("condition:counts", {
        control: 0,
        modelText: 0,
        aiWcf: 0,
      });
      counts = { control: "0", modelText: "0", aiWcf: "0" };
    }

    let cControl = Number(counts.control || 0);
    let cModel = Number(counts.modelText || 0);
    let cAi = Number(counts.aiWcf || 0);

    // ===================================================
    // ② 自動条件割り振りロジック（フェア制）
    // ===================================================
    if (!condition) {
      const min = Math.min(cControl, cModel, cAi);

      if (cControl === min) condition = "control";
      else if (cModel === min) condition = "model text";
      else condition = "ai-wcf";

      // ③ Redis 内のカウンターをインクリメント
      await redis.hincrby(
        "condition:counts",
        condition === "control"
          ? "control"
          : condition === "model text"
          ? "modelText"
          : "aiWcf",
        1
      );
    }

    // ===================================================
    // ④ Supabase(PostgreSQL) へ参加者情報保存
    // ===================================================
    const participant = await prisma.participant.upsert({
      where: { id: body.studentId },
      update: {
        name: body.name,
        className: body.className,
        condition,
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
        condition,
        currentStep: body.currentStep ?? 0,
        brainstorm: body.brainstorm || "",
        pretest: body.pretest || "",
        wcfResult: body.wcfResult || "",
        posttest: body.posttest || "",
        survey: body.survey || {},
      },
    });

    return NextResponse.json(participant);
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Server Error", detail: error.message },
      { status: 500 }
    );
  }
}


