import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { appendApiKey, STADIA_HOSTS } from "@/lib/map/stadiaStyle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy Stadia tiles / glyphs / sprites. Path is forwarded to tiles.stadiamaps.com
 * with the server-side API key. Browser never sees the key.
 *
 * Example: /api/map/stadia/data/openmaptiles/10/512/340.pbf
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { STADIA_API_KEY } = getEnv();
  if (!STADIA_API_KEY) {
    return new NextResponse("STADIA_API_KEY not configured", { status: 503 });
  }

  const { path: parts = [] } = await ctx.params;
  if (!parts.length) {
    return new NextResponse("missing path", { status: 400 });
  }

  const upstreamPath = parts.map(encodeURIComponent).join("/");
  const search = req.nextUrl.search || "";
  const upstream = appendApiKey(
    `https://tiles.stadiamaps.com/${upstreamPath}${search}`,
    STADIA_API_KEY,
  );

  const host = new URL(upstream).hostname;
  if (!STADIA_HOSTS.has(host)) {
    return new NextResponse("forbidden host", { status: 403 });
  }

  const res = await fetch(upstream, {
    headers: {
      Accept: req.headers.get("accept") ?? "*/*",
      "User-Agent": "busTracker-map-proxy/1.0",
    },
  });

  const headers = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) headers.set("Content-Type", ct);
  const cache = res.headers.get("cache-control");
  headers.set("Cache-Control", cache ?? "public, max-age=3600");

  return new NextResponse(res.body, { status: res.status, headers });
}
