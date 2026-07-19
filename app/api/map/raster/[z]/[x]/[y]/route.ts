import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Same-origin raster tile proxy for the no-Stadia demo basemap.
 * Upstream: OSM standard tiles (tile.openstreetmap.org).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await ctx.params;
  if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) {
    return new NextResponse("bad tile coords", { status: 400 });
  }
  const zi = Number(z);
  if (zi < 0 || zi > 19) {
    return new NextResponse("zoom out of range", { status: 400 });
  }

  const upstream = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  const res = await fetch(upstream, {
    headers: {
      // OSM tile usage policy requires a valid identifying User-Agent.
      "User-Agent": "busTracker-dev/0.1 (local demo; contact: localhost)",
      Accept: "image/png",
    },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    return new NextResponse(`upstream ${res.status}`, { status: 502 });
  }

  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
