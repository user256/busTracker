/** Brand green when GTFS route_color is missing or unreadably light on the pale basemap. */
export const BRAND_ROUTE_GREEN = "#2F8F5B";

/** Douglas–Peucker tolerances (metres, Web Mercator) by MapLibre zoom. */
export const SIMPLIFY_TOLERANCE_M: { maxZoom: number; metres: number }[] = [
  { maxZoom: 8, metres: 200 },
  { maxZoom: 10, metres: 75 },
  { maxZoom: 12, metres: 25 },
  { maxZoom: 14, metres: 8 },
  { maxZoom: 22, metres: 2 },
];

export function simplifyToleranceMetres(zoom: number): number {
  const z = Number.isFinite(zoom) ? zoom : 10;
  for (const rung of SIMPLIFY_TOLERANCE_M) {
    if (z <= rung.maxZoom) return rung.metres;
  }
  return 2;
}

/**
 * Parse GTFS route_color (RRGGBB or #RRGGBB). Reject missing / near-white colours
 * that would vanish on the desaturated basemap.
 */
export function resolveRouteColour(raw: string | null | undefined): string {
  if (!raw) return BRAND_ROUTE_GREEN;
  const hex = raw.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return BRAND_ROUTE_GREEN;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Relative luminance (sRGB approx)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance > 0.82) return BRAND_ROUTE_GREEN;
  return `#${hex.toUpperCase()}`;
}
