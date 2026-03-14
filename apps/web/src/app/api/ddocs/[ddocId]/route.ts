import { NextRequest, NextResponse } from "next/server";

// GET /api/ddocs/[ddocId]?apiKey=xxx
// Polls Fileverse ddoc API for the shareable link of a document.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ddocId: string }> },
) {
  const { ddocId } = await params;

  const apiKey =
    req.nextUrl.searchParams.get("apiKey") ??
    process.env.FILEVERSE_API_KEY ??
    process.env.NEXT_PUBLIC_FILEVERSE_API_KEY ??
    "";

  if (!apiKey) {
    return NextResponse.json({ error: "Missing Fileverse API key" }, { status: 400 });
  }

  if (!ddocId) {
    return NextResponse.json({ error: "Missing ddocId" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://ddocs.fileverse.io/api/v1/ddocs/${encodeURIComponent(ddocId)}`, {
      headers: {
        "x-api-key": apiKey,
      },
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        (typeof data === "object" && data !== null && (data as Record<string, unknown>).message) ||
        (typeof data === "object" && data !== null && (data as Record<string, unknown>).error) ||
        `Fileverse API returned HTTP ${res.status}`;
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    // Extract link from response — may be at root or nested under .data
    const link =
      (data as Record<string, unknown>)?.link ??
      ((data as Record<string, unknown>)?.data as Record<string, unknown>)?.link ??
      null;

    return NextResponse.json({ ddocId, link });
  } catch (err) {
    console.error("[/api/ddocs GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch ddoc status" },
      { status: 500 },
    );
  }
}
