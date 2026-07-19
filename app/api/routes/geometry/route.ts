import { NextRequest, NextResponse } from "next/server";
import { gzipSync } from "node:zlib";
import { buildRouteNetworkGeometry } from "@/lib/map/routeGeometry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const zRaw = req.nextUrl.searchParams.get("z");
  const zoom = zRaw != null ? Number(zRaw) : 11;
  if (!Number.isFinite(zoom) || zoom < 0 || zoom > 22) {
    return NextResponse.json(
      { error: "z must be a number 0–22" },
      { status: 400 },
    );
  }

  try {
    const built = await buildRouteNetworkGeometry(zoom);
    const body = JSON.stringify(built.collection);
    const etag = `"geom-${built.feedSha256.slice(0, 16)}-z${Math.floor(zoom)}-t${built.toleranceMetres}"`;

    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control":
            "public, max-age=3600, stale-while-revalidate=86400",
        },
      });
    }

    const gzipped = gzipSync(Buffer.from(body, "utf8"));
    const headers: Record<string, string> = {
      "Content-Type": "application/geo+json; charset=utf-8",
      ETag: etag,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "X-Feed-Version-Id": String(built.feedVersionId),
      "X-Simplify-Tolerance-M": String(built.toleranceMetres),
      "X-Geometry-Lines": String(built.lineCount),
      "X-Geometry-Stops": String(built.stopCount),
      "X-Geometry-Gzip-Bytes": String(gzipped.byteLength),
    };

    const accept = req.headers.get("accept-encoding") ?? "";
    if (accept.includes("gzip")) {
      headers["Content-Encoding"] = "gzip";
      return new NextResponse(gzipped, { status: 200, headers });
    }

    return new NextResponse(body, { status: 200, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("No active GTFS") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
