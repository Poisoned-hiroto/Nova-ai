import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function POST(request: NextRequest) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "Add OPENROUTER_API_KEY to your server environment variables first." }, { status: 503 });
  try {
    const body = await request.json();
    const model = typeof body.model === "string" ? body.model : "meta-llama/llama-3.3-70b-instruct:free";
    if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 40) {
      return NextResponse.json({ error: "Send between 1 and 40 messages." }, { status: 400 });
    }
    const messages: ChatMessage[] = body.messages.map((m: any) => ({
      role: ["user", "assistant", "system"].includes(m.role) ? m.role : "user",
      content: String(m.content ?? "").slice(0, 20000),
    }));
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "SMARTY AI",
      },
      body: JSON.stringify({ model, messages, temperature: 0.7 }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.error?.message ?? "Provider error " + response.status }, { status: response.status });
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return NextResponse.json({ error: "The model returned an empty response. Try another model." }, { status: 502 });
    return NextResponse.json({ reply, model: data.model ?? model, usage: data.usage ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}
