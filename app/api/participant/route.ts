import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json();

  try {
    // ===================================================
    // ① 条件割り振り（DB 関数で学籍番号ごとに1回だけ）
    //   同じ学籍番号なら再読み込み・二重送信でも同じ条件が返る。
    //   共用PCに前の人の条件が残っていても使わないよう、
    //   クライアントから送られた condition は無視する。
    // ===================================================
    const studentId = String(body.studentId ?? "").trim();
    if (!studentId) {
      return NextResponse.json(
        { error: "studentId is required" },
        { status: 400 }
      );
    }
    const rows = await prisma.$queryRaw<{ condition: string }[]>`
      SELECT "public"."assign_condition"(${studentId}) AS condition
    `;
    const condition = rows[0].condition;

    // ===================================================
    // ② Supabase(PostgreSQL) へ参加者情報保存
    // ===================================================
    const participant = await prisma.participant.upsert({
      where: { id: studentId },
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
        id: studentId,
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

