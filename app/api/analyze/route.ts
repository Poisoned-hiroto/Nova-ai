import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "gemini-3.5-flash-lite";
const REQUEST_TIMEOUT_MS = 45_000;

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Sign in to use image analysis." }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Image analysis is not configured. Add GEMINI_API_KEY in Vercel Environment Variables." },
      { status: 503 }
    );
  }

  try {
    const { dataUrl, prompt } = await request.json();

    if (typeof dataUrl !== "string" || dataUrl.length > 6_000_000) {
      return NextResponse.json({ error: "Upload an image smaller than 4 MB." }, { status: 413 });
    }

    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/);
    if (!match) {
      return NextResponse.json({ error: "Supported image formats: PNG, JPG and WEBP." }, { status: 400 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: String(prompt || "Describe and analyze this image clearly.").slice(0, 2000) },
              { inline_data: { mime_type: match[1], data: match[2] } },
            ],
          }],
          generationConfig: { maxOutputTokens: 2048 },
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data?.error?.message ?? `Gemini returned HTTP ${response.status}.`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const analysis = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("") ?? "";

    if (!analysis) {
      return NextResponse.json({ error: "Gemini returned no image analysis. Try a clearer or smaller image." }, { status: 502 });
    }

    return NextResponse.json({ analysis, model: MODEL });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Image analysis timed out after 45 seconds. Try a smaller image or retry shortly." },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image analysis failed." },
      { status: 500 }
    );
  }
}
