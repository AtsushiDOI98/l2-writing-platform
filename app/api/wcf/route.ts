// app/api/wcf/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { text } = await req.json();

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Rewrite this writing as if written by an English native speaker, keeping the meaning the same.",
      },
      { role: "user", content: text },
    ],
    temperature: 0.3,
  });
  
  return NextResponse.json({ result: completion.choices[0].message.content });
}

