import { NextResponse } from "next/server";
import overrides from "@/components/map/styleOverrides.json";
import { getEnv } from "@/lib/env";
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
    return NextResponse.json(
      {
        error: "STADIA_API_KEY is not configured",
        hint: "Set STADIA_API_KEY in .env (server-only; never NEXT_PUBLIC_).",
      },
      { status: 503 },
    );
  }

  const upstream = appendApiKey(STYLE_URL, STADIA_API_KEY);
  const res = await fetch(upstream, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `Stadia style fetch failed: HTTP ${res.status}` },
      { status: 502 },
    );
  }

  const style = (await res.json()) as Record<string, unknown>;
  const clientStyle = prepareClientStyle(
    style,
    overrides as StyleOverride[],
  );

  return NextResponse.json(clientStyle, {
    headers: {
      "Cache-Control": "private, max-age=300",
    },
  });
}
