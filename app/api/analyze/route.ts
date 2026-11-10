import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "Image analysis is not configured yet. Add a new GEMINI_API_KEY." }, { status: 503 });
  try {
    const { dataUrl, prompt } = await request.json();
    if (typeof dataUrl !== "string" || dataUrl.length > 6_000_000) return NextResponse.json({ error: "Upload an image smaller than 4 MB." }, { status: 413 });
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([\s\S]+)$/);
    if (!match) return NextResponse.json({ error: "Supported image formats: PNG, JPG and WEBP." }, { status: 400 });
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + key, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [
        { text: String(prompt || "Describe this image in detail.").slice(0, 4000) },
        { inline_data: { mime_type: match[1], data: match[2] } },
      ] }] }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.error?.message ?? "Gemini error " + response.status }, { status: response.status });
    const analysis = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    if (!analysis) return NextResponse.json({ error: "Gemini returned no image analysis." }, { status: 502 });
    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image analysis failed" }, { status: 500 });
  }
}
