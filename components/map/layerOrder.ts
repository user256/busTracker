/**
 * Stable bottom→top layer ids for Sprint 2.
 * Later tickets insert with `map.addLayer(spec, beforeId)` — never bare addLayer.
 *
 * `basemap` is conceptual (Stadia style layers). Slot layers below are empty
 * GeoJSON placeholders added after style load so beforeId targets exist.
 */
export const LAYER_ORDER = [
  "basemap",
  "routes-line-casing",
  "routes-line",
  "stops-circle",
  "vehicles-marker",
  "overlay-ui",
] as const;

export type MapLayerId = (typeof LAYER_ORDER)[number];

/** Placeholder layer ids that MapShell inserts (excludes conceptual basemap). */
export const SLOT_LAYER_IDS = LAYER_ORDER.filter(
  (id) => id !== "basemap",
) as Exclude<MapLayerId, "basemap">[];

export const SLOT_SOURCE_PREFIX = "bt-slot-";

/** beforeId for inserting just below a named slot (or undefined = top). */
export function beforeIdFor(slot: MapLayerId): string | undefined {
  const idx = LAYER_ORDER.indexOf(slot);
  if (idx < 0 || idx === LAYER_ORDER.length - 1) return undefined;
  return LAYER_ORDER[idx + 1];
}
