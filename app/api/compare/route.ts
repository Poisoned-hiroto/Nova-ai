import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to compare models." }, { status: 401 });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "OpenRouter is not configured." }, { status: 503 });

  try {
    const body = await request.json();
    const modelA = typeof body.modelA === "string" ? body.modelA : "";
    const modelB = typeof body.modelB === "string" ? body.modelB : "";
    const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 12000) : "";
    if (!modelA || !modelB || modelA === modelB || !prompt) {
      return NextResponse.json({ error: "Choose two different models and enter a prompt." }, { status: 400 });
    }

    const messages = Array.isArray(body.messages)
      ? body.messages.slice(-12).map((m: any) => ({
          role: ["user", "assistant"].includes(m.role) ? m.role : "user",
          content: String(m.content ?? "").slice(0, 8000),
        }))
      : [{ role: "user", content: prompt }];

    async function ask(model: string) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
          "X-Title": "SMARTY AI Model Comparison",
        },
        signal: AbortSignal.timeout(48_000),
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          ...(body.webSearch === true ? { tools: [{ type: "openrouter:web_search", max_results: 4 }] } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message ?? `${model} returned HTTP ${response.status}`);
      const reply = data?.choices?.[0]?.message?.content;
      if (!reply) throw new Error(`${model} returned an empty response.`);
      return { model: data.model ?? model, reply };
    }

    const results = await Promise.allSettled([ask(modelA), ask(modelB)]);
    const output = results.map((result, index) => ({
      requestedModel: index === 0 ? modelA : modelB,
      ...(result.status === "fulfilled" ? { ...result.value, ok: true } : { ok: false, error: result.reason instanceof Error ? result.reason.message : "Model request failed." }),
    }));
    return NextResponse.json({ results: output });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "Model comparison timed out. Try again with faster models." : error instanceof Error ? error.message : "Comparison failed." },
      { status: timedOut ? 504 : 500 }
    );
  }
}
