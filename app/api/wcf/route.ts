export const runtime = "nodejs";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from "openai/resources/chat/completions";
import fs from "fs/promises";
import path from "path";
import pLimit from "p-limit";

//
// ✅ Cloudflare Pages CDNに対応
//
const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  "https://l2-writing-platform.pages.dev/task-images";

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

//
// ファイル存在確認（Cloudflare上では常にfalse扱い）
//
async function fileExists(p: string) {
  if (process.env.CF_PAGES === "1") return false; // ✅ Cloudflare PagesではローカルI/O禁止
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

let TASK_CONTEXT_CACHE: string | null = null;

//
// タスクコンテキスト読み込み
//
async function loadTaskContext(): Promise<string> {
  if (TASK_CONTEXT_CACHE !== null) return TASK_CONTEXT_CACHE;

  const inline = process.env.TASK_CONTEXT_TEXT;
  if (inline && inline.trim()) {
    TASK_CONTEXT_CACHE = inline.trim();
    return TASK_CONTEXT_CACHE;
  }

  //
  // ✅ Cloudflare Pagesではfetchで読み込みに切り替え
  //
  if (process.env.CF_PAGES === "1") {
    try {
      const txtUrl = `${DEFAULT_BASE_URL.replace("/task-images", "")}/task-context.txt`;
      const res = await fetch(txtUrl);
      if (res.ok) {
        const text = await res.text();
        TASK_CONTEXT_CACHE = text;
        return text;
      }
    } catch {
      TASK_CONTEXT_CACHE = "";
      return "";
    }
  }

  //
  // ✅ Render/Vercelなど通常Node環境では従来通りファイル読み込み
  //
  const resolvePath = (p: string) =>
    path.isAbsolute(p) ? p : path.join(process.cwd(), p);

  const envPath = process.env.TASK_CONTEXT_PATH
    ? resolvePath(process.env.TASK_CONTEXT_PATH)
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

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const limit = pLimit(3);

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server misconfigured: OPENAI_API_KEY is missing" },
      { status: 500 }
    );
  }

  const client = new OpenAI({ apiKey });
  const { text } = await req.json();

  const taskContextRaw = await loadTaskContext();
  const taskContext = taskContextRaw ? taskContextRaw.slice(0, 8000) : "";

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `This is an essay written by English as foreign language (EFL) learner.
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
        "Use these instructions together with the provided step-by-step images to fully understand the writing task.\n\n" +
        taskContext,
    });
  }

  if (TASK_IMAGE_URLS.length > 0) {
    const parts: ChatCompletionContentPart[] = [{ type: "text", text }];
    for (const file of TASK_IMAGE_URLS) {
      parts.push({
        type: "image_url",
        image_url: { url: `${DEFAULT_BASE_URL}/${file}` },
      });
    }
    messages.push({ role: "user", content: parts });
  } else {
    messages.push({ role: "user", content: text });
  }

  const completion = await limit(() =>
    client.chat.completions.create({
      model: "gpt-5",
      messages,
      max_completion_tokens: 400,
    })
  );

  return NextResponse.json({ result: completion.choices[0].message.content });
}

