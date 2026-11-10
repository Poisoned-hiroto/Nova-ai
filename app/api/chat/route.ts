import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to use SMARTY AI." }, { status: 401 });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "OpenRouter is not configured." }, { status: 503 });

  try {
    const body = await request.json();
    const model = typeof body.model === "string" ? body.model : "meta-llama/llama-3.3-70b-instruct:free";
    const webSearch = body.webSearch === true;
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
      signal: AbortSignal.timeout(48_000),
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        ...(webSearch ? { tools: [{ type: "openrouter:web_search", max_total_results: 5 }] } : {}),
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({ error: data?.error?.message ?? "Provider error " + response.status }, { status: response.status });
    }

    const message = data?.choices?.[0]?.message;
    const reply = message?.content;
    if (!reply) return NextResponse.json({ error: "The model returned an empty response. Try another model." }, { status: 502 });
    const sources = Array.isArray(message?.annotations)
      ? message.annotations.filter((item: any) => item?.type === "url_citation").map((item: any) => ({
          title: item.url_citation?.title ?? item.url_citation?.url ?? "Source",
          url: item.url_citation?.url,
        })).filter((item: any) => item.url)
      : [];

    return NextResponse.json({ reply, model: data.model ?? model, usage: data.usage ?? null, sources });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "The model request timed out. Try again or choose a faster model." : error instanceof Error ? error.message : "Unexpected server error" },
      { status: timedOut ? 504 : 500 }
    );
  }
}
