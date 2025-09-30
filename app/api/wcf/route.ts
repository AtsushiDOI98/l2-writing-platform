// app/api/wcf/route.ts
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionContentPart } from "openai/resources/chat/completions";
import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";

async function fileExists(p: string) {
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
  const inline = process.env.TASK_CONTEXT_TEXT;
  if (inline && inline.trim()) {
    TASK_CONTEXT_CACHE = inline.trim();
    return TASK_CONTEXT_CACHE;
  }

  const resolvePath = (p: string) => (path.isAbsolute(p) ? p : path.join(process.cwd(), p));

  const envPath = process.env.TASK_CONTEXT_PATH ? resolvePath(process.env.TASK_CONTEXT_PATH) : null;
  const publicDir = path.join(process.cwd(), "public");
  const defaultTxt = path.join(publicDir, "task-context.txt");
  const defaultPdf = path.join(publicDir, "task.pdf");

  const tryTxt = async (p: string) => (await fileExists(p) ? (await fs.readFile(p, "utf8")).toString() : "");

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

// 📊 Rubric loader from Excel
async function loadRubricFromExcel(): Promise<string> {
  const rubricPath = path.join(process.cwd(), "public", "rubric.xlsx");
  if (!(await fileExists(rubricPath))) return "";

  const buf = await fs.readFile(rubricPath);
  const workbook = XLSX.read(buf, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

  // Convert Excel rows into text (pipe-delimited)
  return json.map((row) => row.join(" | ")).join("\n");
}

async function loadTaskImages(maxImages = 20): Promise<{ dataUrl: string }[]> {
  const publicDir = path.join(process.cwd(), "public");
  const pagesDir = path.join(publicDir, "task-pages");
  const exts = new Set([".png", ".jpg", ".jpeg"]);
  const out: { dataUrl: string }[] = [];
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
    const full = path.join(pagesDir, f);
    try {
      const buf = await fs.readFile(full);
      const ext = path.extname(f).toLowerCase();
      const mime = ext === ".png" ? "image/png" : "image/jpeg";
      const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
      out.push({ dataUrl });
    } catch {
      // ignore individual file errors
    }
  }
  return out;
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
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

  const rubric = await loadRubricFromExcel();

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `I would like you to mark an essay written by an English as a foreign language (EFL) learner. 
Each essay is assigned a rating of 0 to 9, with 9 being the highest and 0 the lowest. 
You don’t have to explain why you assign that specific score. Just report the score only.

After reporting the score, rewrite the essay into an improved version based on the IELTS Writing rubric. 
Keep the original meaning, but improve vocabulary, grammar, coherence, and cohesion. 
Present only the score and the improved essay, without explanation.

When you provide feedback, I would like you to use all words below once if you can replace.

Words: ripe, harvest, sack, weigh, load, transport, roast, shell, stir, pulverize, mold`
    }
  ];

  if (rubric) {
    messages.push({
      role: "system",
      content: "Here is the IELTS Writing rubric (Band 1–9 descriptors):\n\n" + rubric,
    });
  }

  if (taskContext) {
    messages.push({
      role: "system",
      content:
        "Task instructions/context extracted from the provided PDF or text. Use this to better understand the writing task.\n\n" +
        taskContext,
    });
  }

  const taskImages = await loadTaskImages();
  if (taskImages.length > 0) {
    const parts: ChatCompletionContentPart[] = [
      { type: "text", text },
      ...taskImages.map((img) => ({
        type: "image_url",
        image_url: { url: img.dataUrl },
      }) as ChatCompletionContentPart),
    ];
    messages.push({ role: "user", content: parts });
  } else {
    messages.push({ role: "user", content: text });
  }

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.3,
  });

  return NextResponse.json({ result: completion.choices[0].message.content });
}

