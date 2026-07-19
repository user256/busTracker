/**
 * Rewrite Stadia Maps style JSON so the browser only talks to our origin.
 * The API key is appended only when the server proxies upstream.
 */

const STADIA_HOSTS = new Set([
  "tiles.stadiamaps.com",
  "tiles-eu.stadiamaps.com",
]);

export function isAllowedStadiaUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return STADIA_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

/** Strip api_key from a URL and return path+query for our proxy. */
export function toProxyPath(upstream: string): string {
  const u = new URL(upstream);
  u.searchParams.delete("api_key");
  const qs = u.searchParams.toString();
  // URL() percent-encodes MapLibre template tokens ({z}/{x}/{y}); restore them.
  const path = decodeURIComponent(u.pathname);
  return `/api/map/stadia${path.startsWith("/") ? path : `/${path}`}${qs ? `?${qs}` : ""}`;
}

function rewriteStringUrl(value: string): string {
  if (!value.startsWith("http")) return value;
  if (!isAllowedStadiaUrl(value)) return value;
  return toProxyPath(value);
}

function rewriteDeep(value: unknown): unknown {
  if (typeof value === "string") return rewriteStringUrl(value);
  if (Array.isArray(value)) return value.map(rewriteDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewriteDeep(v);
    }
    return out;
  }
  return value;
}

export type StyleOverride = {
  /** Layer id substring match (case-sensitive). */
  match: string;
  paint?: Record<string, unknown>;
};

/**
 * Apply paint overrides to matching layers (desaturate land/water for ember.to feel).
 */
export function applyStyleOverrides(
  style: Record<string, unknown>,
  overrides: StyleOverride[],
): Record<string, unknown> {
  const layers = style.layers;
  if (!Array.isArray(layers)) return style;
  const nextLayers = layers.map((layer) => {
    if (!layer || typeof layer !== "object") return layer;
    const L = layer as Record<string, unknown>;
    const id = String(L.id ?? "");
    let paint = {
      ...((L.paint as Record<string, unknown> | undefined) ?? {}),
    };
    let matched = false;
    for (const o of overrides) {
      if (!id.includes(o.match)) continue;
      matched = true;
      if (o.paint) paint = { ...paint, ...o.paint };
    }
    if (!matched) return layer;
    return { ...L, paint };
  });
  return { ...style, layers: nextLayers };
}

/** Full pipeline: rewrite Stadia URLs + apply overrides. Never leaves api_key in output. */
export function prepareClientStyle(
  style: Record<string, unknown>,
  overrides: StyleOverride[],
): Record<string, unknown> {
  const overridden = applyStyleOverrides(style, overrides);
  const rewritten = rewriteDeep(overridden) as Record<string, unknown>;
  // Attribution is owned by our UI (ticket AC); drop style attribution if present.
  return rewritten;
}

export function appendApiKey(upstreamUrl: string, apiKey: string): string {
  const u = new URL(upstreamUrl);
  if (apiKey) u.searchParams.set("api_key", apiKey);
  return u.toString();
}

export { STADIA_HOSTS };
