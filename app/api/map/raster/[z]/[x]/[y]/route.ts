import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAMS = [
  (z: string, x: string, y: string) =>
    `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
  (z: string, x: string, y: string) =>
    `https://b.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
  (z: string, x: string, y: string) =>
    `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
];

async function fetchTile(url: string): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "busTracker-dev/0.1 (local demo)",
        Accept: "image/png",
      },
      signal: controller.signal,
      // Avoid Next Data Cache stampede on many parallel tile misses
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 1×1 light-grey PNG so MapLibre still paints a cell if all upstreams fail. */
function placeholderPng(): ArrayBuffer {
  // Precomputed 1x1 PNG #e8ebe6
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const bin = Buffer.from(b64, "base64");
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
}

/**
 * Same-origin raster tile proxy for the no-Stadia demo basemap.
 * Tries Carto then OSM; never throws 500 on upstream timeout.
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

  for (const build of UPSTREAMS) {
    const body = await fetchTile(build(z, x, y));
    if (body && body.byteLength > 0) {
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
  }

  return new NextResponse(placeholderPng(), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60",
      "X-Basemap-Fallback": "placeholder",
    },
  });
}
