import { NextRequest, NextResponse } from "next/server";
import { getAholoHeaders } from "@/lib/aholo/config";

function upstreamHeaders(target: URL): HeadersInit {
  const host = target.hostname.toLowerCase();
  if (
    host.includes("aholo") ||
    host.includes("myqcloud") ||
    host.includes("cos.")
  ) {
    try {
      return getAholoHeaders();
    } catch {
      return {};
    }
  }
  return {};
}

/** Proxies splat files so the browser viewer can load them without CORS issues. */
export async function HEAD(req: NextRequest) {
  const res = await GET(req);
  return new NextResponse(null, {
    status: res.status,
    headers: res.headers,
  });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }

    const upstream = await fetch(url, { headers: upstreamHeaders(parsed) });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const body = await upstream.arrayBuffer();

    return new NextResponse(body, {
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to proxy model",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
