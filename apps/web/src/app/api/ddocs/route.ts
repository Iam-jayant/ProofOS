import { NextRequest, NextResponse } from "next/server";

// POST /api/ddocs?apiKey=xxx  { title, content }
// Proxies to Fileverse ddoc API to create a new document.
export async function POST(req: NextRequest) {
  const apiKey =
    req.nextUrl.searchParams.get("apiKey") ??
    process.env.FILEVERSE_API_KEY ??
    process.env.NEXT_PUBLIC_FILEVERSE_API_KEY ??
    "";

  if (!apiKey) {
    return NextResponse.json({ error: "Missing Fileverse API key" }, { status: 400 });
  }

  let body: { title?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, content } = body;
  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 });
  }

  try {
    const res = await fetch("https://ddocs.fileverse.io/api/v1/ddocs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ title, content }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        (typeof data === "object" && data !== null && (data as Record<string, unknown>).message) ||
        (typeof data === "object" && data !== null && (data as Record<string, unknown>).error) ||
        `Fileverse API returned HTTP ${res.status}`;
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    // Fileverse may return { ddocId } or { id } or { data: { ddocId } }
    const ddocId =
      (data as Record<string, unknown>)?.ddocId ??
      (data as Record<string, unknown>)?.id ??
      ((data as Record<string, unknown>)?.data as Record<string, unknown>)?.ddocId ??
      ((data as Record<string, unknown>)?.data as Record<string, unknown>)?.id ??
      null;

    if (!ddocId) {
      return NextResponse.json(
        { error: "Fileverse returned OK but no ddocId", raw: data },
        { status: 502 },
      );
    }

    return NextResponse.json({ ddocId });
  } catch (err) {
    console.error("[/api/ddocs POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create ddoc" },
      { status: 500 },
    );
  }
}
