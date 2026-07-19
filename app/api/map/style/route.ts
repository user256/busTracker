import { NextResponse } from "next/server";
import overrides from "@/components/map/styleOverrides.json";
import { getEnv } from "@/lib/env";
import { buildDummyBasemapStyle } from "@/lib/map/dummyBasemap";
import {
  appendApiKey,
  prepareClientStyle,
  type StyleOverride,
} from "@/lib/map/stadiaStyle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STYLE_URL =
  "https://tiles.stadiamaps.com/styles/alidade_smooth.json";

export async function GET() {
  const { STADIA_API_KEY } = getEnv();
  if (!STADIA_API_KEY) {
    return NextResponse.json(buildDummyBasemapStyle(), {
      headers: {
        "Cache-Control": "private, max-age=60",
        "X-Basemap-Provider": "dummy",
      },
    });
  }

  const upstream = appendApiKey(STYLE_URL, STADIA_API_KEY);
  const res = await fetch(upstream, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    // Fall back to demo basemap rather than hard-failing the map shell.
    return NextResponse.json(buildDummyBasemapStyle(), {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=60",
        "X-Basemap-Provider": "dummy",
        "X-Basemap-Fallback-Reason": `stadia_http_${res.status}`,
      },
    });
  }

  const style = (await res.json()) as Record<string, unknown>;
  const clientStyle = prepareClientStyle(
    style,
    overrides as StyleOverride[],
  );

  return NextResponse.json(clientStyle, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "X-Basemap-Provider": "stadia",
    },
  });
}
