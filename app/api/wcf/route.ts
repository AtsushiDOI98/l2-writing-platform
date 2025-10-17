// app/api/wcf/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from "openai/resources/chat/completions";
import fs from "fs/promises";
import path from "path";
import pLimit from "p-limit"; 

// ファイル存在確認
async function fileExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

let TASK_CONTEXT_CACHE: string | null = null;

// タスクコンテキスト読み込み
async function loadTaskContext(): Promise<string> {
  if (TASK_CONTEXT_CACHE !== null) return TASK_CONTEXT_CACHE;
  const inline = process.env.TASK_CONTEXT_TEXT;
  if (inline && inline.trim()) {
    TASK_CONTEXT_CACHE = inline.trim();
    return TASK_CONTEXT_CACHE;
  }

  const resolvePath = (p: string) =>
    path.isAbsolute(p) ? p : path.join(process.cwd(), p);

  const envPath = process.env.TASK_CONTEXT_PATH ? resolvePath(process.env.TASK_CONTEXT_PATH) : null;
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

// Task images loader (URL ベース, task-images フォルダ対応)
async function loadTaskImages(maxImages = 15): Promise<{ url: string }[]> {
  const publicDir = path.join(process.cwd(), "public");
  const pagesDir = path.join(publicDir, "task-images"); 
  const exts = new Set([".png", ".jpg", ".jpeg"]);
  const out: { url: string }[] = [];
  try {
    await fs.access(pagesDir);
  } catch {
    return out;
  }
  const files = (await fs.readdir(pagesDir))
    .filter((f) => exts.has(path.extname(f).toLowerCase()))
    .sort((a, b) => {
      const na = (a.match(/\d+/)?.[0] ?? "");
      const nb = (b.match(/\d+/)?.[0] ?? "");
      return na && nb ? Number(na) - Number(nb) : a.localeCompare(b);
    })
    .slice(0, maxImages);

  for (const f of files) {
    out.push({ url: `/task-images/${f}` }); // 
  }
  return out;
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

  const taskImages = await loadTaskImages();
  console.log("Loaded image URLs:", taskImages.map(i => i.url));

  if (taskImages.length > 0) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://l2-writing-platform.onrender.com";
    const parts: ChatCompletionContentPart[] = [
      { type: "text", text },
      ...taskImages.map(
        (img) =>
          ({
            type: "image_url",
            image_url: { url: `${baseUrl}${img.url}` },
          } as ChatCompletionContentPart)
      ),
    ];
    messages.push({ role: "user", content: parts });
  } else {
    messages.push({ role: "user", content: text });
  }

  const completion = await limit(() =>
  client.chat.completions.create({
    model: "gpt-5",
    messages,
    max_tokens: 400,
  })
);

return NextResponse.json({ result: completion.choices[0].message.content });
}


