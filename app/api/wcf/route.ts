export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import fs from "fs/promises";
import path from "path";
import pLimit from "p-limit";

// --- 環境変数とベースURL設定 ---------------------------------------

type EnvMap = Record<string, string | undefined>;
const env: EnvMap =
  typeof process !== "undefined" && process?.env ? process.env : {};

const CAN_USE_FS = typeof process !== "undefined" && env.CF_PAGES !== "1";

const DEFAULT_BASE_URL = (env.NEXT_PUBLIC_BASE_URL ??
  "https://l2-writing-platform.pages.dev").replace(/\/$/, "");

const TASK_IMAGE_BASE = `${DEFAULT_BASE_URL}/task-images`;

const TASK_IMAGE_URLS: readonly string[] = [
  "01-ripe.png",
  "02-harvest.png",
  "03.png",
  "04.png",
  "05.png",
  "06-sack.png",
  "07-weigh.png",
  "08-heave.png",
  "09.png",
  "10.png",
  "11-roast.png",
  "12-layer.png",
  "13-pulverize.png",
  "14-agitate.png",
  "15-mold.png",
  "16.png",
];

// --- コンテキスト読み込み --------------------------------------------

async function fileExists(p: string) {
  if (!CAN_USE_FS) return false;
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

let TASK_CONTEXT_CACHE: string | null = null;

async function loadTaskContext(): Promise<string> {
  if (TASK_CONTEXT_CACHE !== null) return TASK_CONTEXT_CACHE;

  const inline = env.TASK_CONTEXT_TEXT;
  if (inline && inline.trim()) {
    TASK_CONTEXT_CACHE = inline.trim();
    return TASK_CONTEXT_CACHE;
  }

  // Cloudflare Pages 実行時（fs不可）
  if (!CAN_USE_FS) {
    if (env.CF_PAGES === "1") {
      try {
        const res = await fetch(`${DEFAULT_BASE_URL}/task-context.txt`);
        if (res.ok) {
          const text = await res.text();
          TASK_CONTEXT_CACHE = text;
          return text;
        }
      } catch {
        // ネットワークエラー時は無視
      }
    }
    TASK_CONTEXT_CACHE = "";
    return "";
  }

  const resolvePath = (p: string) =>
    path.isAbsolute(p) ? p : path.join(process.cwd(), p);

  const envPath = env.TASK_CONTEXT_PATH
    ? resolvePath(env.TASK_CONTEXT_PATH)
    : null;
  const publicDir = path.join(process.cwd(), "public");
  const defaultTxt = path.join(publicDir, "task-context.txt");
  const defaultPdf = path.join(publicDir, "task.pdf");

  const tryTxt = async (p: string) =>
    (await fileExists(p) ? (await fs.readFile(p, "utf8")).toString() : "");

  const tryPdf = async (p: string) => {
    if (!(await fileExists(p))) return "";
    try {
      const buf = await fs.readFile(p);
      const mod = await import("pdf-parse");
      const pdfParse = (mod as any).default ?? (mod as any);
      const res = await pdfParse(Buffer.from(buf));
      return (res as any)?.text || "";
    } catch {
      return "";
    }
  };

  if (envPath) {
    if (envPath.toLowerCase().endsWith(".txt")) {
      const t = await tryTxt(envPath);
      if (t) {
        TASK_CONTEXT_CACHE = t;
        return t;
      }
    } else if (envPath.toLowerCase().endsWith(".pdf")) {
      const t = await tryPdf(envPath);
      if (t) {
        TASK_CONTEXT_CACHE = t;
        return t;
      }
    }
  }

  const txt = await tryTxt(defaultTxt);
  if (txt) {
    TASK_CONTEXT_CACHE = txt;
    return txt;
  }

  const pdf = await tryPdf(defaultPdf);
  if (pdf) {
    TASK_CONTEXT_CACHE = pdf;
    return pdf;
  }

  TASK_CONTEXT_CACHE = "";
  return "";
}

// --- OpenAI呼び出し用リトライラッパー ------------------------------

async function callOpenAIWithRetry(
  client: OpenAI,
  payload: any,
  retries = 3
): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await client.chat.completions.create(payload);
      return result;
    } catch (error: any) {
      const code = error?.code || "";
      const msg = error?.message || "";

      if (
        attempt < retries &&
        (code === "invalid_image_url" ||
          msg.includes("Failed to download image") ||
          msg.includes("timed out") ||
          msg.includes("fetch failed"))
      ) {
        console.warn(
          `⚠️ [Retry ${attempt}/${retries}] OpenAI image fetch failed: ${msg}`
        );
        await new Promise((r) => setTimeout(r, 1000 * attempt)); // バックオフ
        continue;
      }

      throw error;
    }
  }
}

// --- メインエンドポイント --------------------------------------------

export async function POST(req: Request) {
  const apiKey = env.OPENAI_API_KEY;
  const limit = pLimit(3);

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfigured: OPENAI_API_KEY is missing" },
      { status: 500 }
    );
  }

  const client = new OpenAI({ apiKey });
  const { text } = (await req.json()) as { text: string };

  const taskContextRaw = await loadTaskContext();
  const taskContext = taskContextRaw ? taskContextRaw.slice(0, 8000) : "";

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `This is an essay written by an English as a foreign language (EFL) learner.
He or she wrote it based on the 15 steps to make chocolate as shown in the provided picture. 
      
I would like you to rewrite the essay into an improved version. 
Present the improved essay only. You do not have to provide explanations.

You must use each word from the word list in the improved essay. 
Do not skip or omit any word. Even if the learner’s essay skips a certain step, 
add a sentence that describes it using the appropriate word.

Follow the sequence of steps shown in the provided images. 
Each word must be placed in the step where it belongs in the chocolate-making process. 
Do not use a word into an incorrect step.

Word list: ripe, harvest, sack, weigh, heave, roast, layer, pulverize, agitate, mold`,
    },
  ];

  if (taskContext) {
    messages.push({
      role: "system",
      content:
        "The following text contains the official assignment instructions. " +
        "Use these together with the provided images to fully understand the writing task.\n\n" +
        taskContext,
    });
  }

  if (TASK_IMAGE_URLS.length > 0) {
    const parts: ChatCompletionContentPart[] = [{ type: "text", text }];
    for (const file of TASK_IMAGE_URLS) {
      parts.push({
        type: "image_url",
        image_url: { url: `${TASK_IMAGE_BASE}/${file}` },
      });
    }
    messages.push({ role: "user", content: parts });
  } else {
    messages.push({ role: "user", content: text });
  }

  // --- OpenAI呼び出し ---
  try {
    const completion = await limit(() =>
      callOpenAIWithRetry(
        client,
        {
          model: "gpt-5",
          messages,
          max_completion_tokens: 400,
        },
        3
      )
    );

       // ✅ GPT-5 多層フォールバック対応（最終版）
    const choice = completion?.choices?.[0];
    let resultText = "";

    // 1️⃣ 新形式 (message.content が配列)
    if (Array.isArray(choice?.message?.content)) {
      resultText = choice.message.content
        .map((c: any) => c?.text ?? "")
        .join("\n")
        .trim();
    }

    // 2️⃣ 通常形式
    if (!resultText && typeof choice?.message?.content === "string") {
      resultText = choice.message.content.trim();
    }

    // 3️⃣ output_text / output_message / output / response など多段フォールバック
    resultText =
      resultText ||
      (completion as any)?.output_text?.trim?.() ||
      (completion as any)?.output?.[0]?.content?.[0]?.text?.trim?.() ||
      (completion as any)?.output_message?.content?.[0]?.text?.trim?.() ||
      (completion as any)?.response?.output_text?.trim?.() ||
      (completion as any)?.response?.output?.[0]?.content?.[0]?.text?.trim?.() ||
      (completion as any)?.response?.message?.content?.trim?.() ||
      "";

    // 4️⃣ 念のため JSON.stringify デバッグ形式も検査
    if (!resultText && completion?.choices?.[0]) {
      resultText = JSON.stringify(completion.choices[0]);
    }

    if (!resultText) {
      console.warn("⚠️ OpenAI returned an empty response:", completion);
      return NextResponse.json(
        { error: "OpenAI returned an empty response.", detail: completion },
        { status: 502 }
      );
    }

    console.log("✅ OpenAI response received, length:", resultText.length);
    return NextResponse.json({ result: resultText });

