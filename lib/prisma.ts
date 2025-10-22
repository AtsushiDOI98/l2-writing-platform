// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

// 🔹 PrismaClient のインスタンスをグローバルにキャッシュする
//    （サーバーレス環境では、リクエストごとに新しいインスタンスが作られるため、
//     グローバル変数で再利用することで「Too many clients」エラーを防ぐ）
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 🔹 PrismaClient を1回だけ生成
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // 本番環境でのログを最小化（エラーと警告のみ）
    log: ["error", "warn"],
  });

// 🔹 本番環境でもキャッシュを有効にする（RenderやVercelでも有効）
//    → NODE_ENV が "production" でも再生成されないようにする
globalForPrisma.prisma = prisma;
