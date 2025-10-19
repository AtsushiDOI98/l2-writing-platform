export const runtime = "nodejs";

import { NextResponse } from "next/server";
import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionContentPart,
  ChatCompletionContentPartText,
  ChatCompletionMessageParam,
  ChatCompletionMessage,
  ChatCompletionCreateParamsNonStreaming,
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
  "05-sack.png",
  "06-weigh.png",
  "07-heave.png",
  "08.png",
  "09.png",
  "10-roast.png",
  "11.png",
  "12-pulverize.png",
  "13-agitate.png",
  "14-mold.png",
  "15.png",
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
  payload: ChatCompletionCreateParamsNonStreaming,
  retries = 2
): Promise<ChatCompletion> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await client.chat.completions.create(payload);
    } catch (error: any) {
      const code = typeof error?.code === "string" ? error.code : "";
      const message = typeof error?.message === "string" ? error.message : "";
      const retriable =
        code === "invalid_image_url" ||
        message.includes("invalid_image_url") ||
        message.includes("Failed to download image") ||
        message.includes("timed out") ||
        message.includes("fetch failed");

      if (!retriable || attempt === retries) {
        throw error;
      }

      console.warn(
        `⚠️ [Retry ${attempt + 1}/${retries + 1}] OpenAI request failed: ${message}`
      );
      await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
    }
  }

  throw new Error("OpenAI request retry loop exhausted");
}

function extractAssistantText(completion: ChatCompletion): string {
  const choice = completion.choices?.[0];
  if (!choice) return "No response";

  const text = extractFromMessage(choice.message);
  if (text) return text;

  return "No response";
}

function extractFromMessage(message: ChatCompletionMessage | undefined): string {
  if (!message) return "";

  if (typeof message.refusal === "string" && message.refusal.trim()) {
    return message.refusal.trim();
  }

  const rawContent = message.content as unknown;

  if (typeof rawContent === "string") {
    return rawContent.trim();
  }

  if (Array.isArray(rawContent)) {
    const parts = rawContent
      .filter((part): part is ChatCompletionContentPartText => {
        if (!part || typeof part !== "object") return false;
        const candidate = part as { type?: unknown; text?: unknown };
        return candidate.type === "text" && typeof candidate.text === "string";
      })
      .map((part) => part.text.trim())
      .filter(Boolean);

    if (parts.length > 0) {
      return parts.join("\n");
    }
  }

  return "";
}

// --- メインエンドポイント --------------------------------------------

export async function POST(req: Request) {
  const apiKey = env.OPENAI_API_KEY;
  const limit = pLimit(2);

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

  // --- OpenAIに送るメッセージ構築 ---
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `This is an essay written by an English as a Foreign Language (EFL) learner.
He or she wrote it based on the 15 steps to make chocolate as shown in the provided images.

I would like you to rewrite the essay into an improved version.
Present the improved essay only. Do not provide explanations or comments.

You must use each word from the word list in the improved essay.
Do not skip or omit any word. Even if the learner’s essay skips a certain step,
add a sentence that describes it using the appropriate word.

Ensure that the steps are described in the same chronological order as shown in the images.
Each word must be used in the step where it belongs in the chocolate-making process.
Do not use a word in an incorrect step.

Word list (use in this order):ripe, harvest, sack, weigh, heave, roast, pulverize, agitate, mold`,
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

  // --- API呼び出し ---
  try {
    const completion = await limit(() =>
      callOpenAIWithRetry(client, {
        model: "gpt-5-mini",
        messages,
        stream: false,
      })
    );

    const resultText = extractAssistantText(completion);
    return NextResponse.json({ result: resultText });
  } catch (error: any) {
    console.error("❌ WCF API Error:", error.message || error);
    return NextResponse.json(
      { error: "Internal Server Error", detail: error.message },
      { status: 500 }
    );
  }
}

