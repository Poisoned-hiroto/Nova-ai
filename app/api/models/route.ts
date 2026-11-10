import { NextResponse } from "next/server";
export const runtime = "nodejs";

export async function GET() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ configured: false, models: [] });
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: "Bearer " + key },
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error("OpenRouter model list returned " + response.status);
    const data = await response.json();
    const models = (data.data ?? [])
      .filter((m: any) => m.id && (m.id.endsWith(":free") || m.id.includes("free")))
      .map((m: any) => ({ id: m.id, name: m.name ?? m.id }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    return NextResponse.json({ configured: true, models });
  } catch (error) {
    return NextResponse.json({ configured: true, models: [], error: error instanceof Error ? error.message : "Could not load models" }, { status: 502 });
  }
}
