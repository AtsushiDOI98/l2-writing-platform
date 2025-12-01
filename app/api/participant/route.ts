import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export async function POST(req: Request) {
  const body = await req.json();
  let condition = body.condition?.trim().toLowerCase() || "";

  try {
    // =====================================
    // Redis atomic increment で公平割り振り
    // =====================================
    if (!condition) {
      const [c1, c2, c3] = await Promise.all([
        redis.incr("cond:control"),
        redis.incr("cond:modelText"),
        redis.incr("cond:aiWcf"),
      ]);

      const min = Math.min(c1, c2, c3);
      if (c1 === min) condition = "control";
      else if (c2 === min) condition = "model text";
      else condition = "ai-wcf";
    }

    // =====================================
    // Supabase(PostgreSQL)へ保存
    // =====================================
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
    console.error(error);
    return NextResponse.json(
      { error: "Server Error", detail: error.message },
      { status: 500 }
    );
  }
}



