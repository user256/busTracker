import { createHash } from "node:crypto";

/** Bit 0 — set when neither entity nor header timestamp was present. */
export const QUALITY_MISSING_SOURCE_TIMESTAMP = 1 << 0;

export type PositionInput = {
  feedName: string;
  entityId: string;
  vehicleId: string;
  feedVersionId?: number | null;
  tripId?: string | null;
  tripStartDate?: string | null;
  tripStartTime?: string | null;
  routeId?: string | null;
  lon: number;
  lat: number;
  bearing?: number | null;
  speedMps?: number | null;
  occupancyStatus?: string | null;
  currentStatus?: string | null;
  stopId?: string | null;
  entityTimestamp?: Date | string | null;
  headerTimestamp?: Date | string | null;
  /** Optional override for tests; defaults to now. */
  recordedAt?: Date | string | null;
  /** Extra quality bits from callers (105). Bit 0 may still be OR'd by the writer. */
  qualityFlags?: number;
};

export type NormalizedPosition = {
  feedName: string;
  entityId: string;
  vehicleId: string;
  feedVersionId: number | null;
  tripId: string | null;
  tripStartDate: string | null;
  tripStartTime: string | null;
  routeId: string | null;
  lon: number;
  lat: number;
  bearing: number | null;
  speedMps: number | null;
  occupancyStatus: string | null;
  currentStatus: string | null;
  stopId: string | null;
  entityTimestamp: Date | null;
  headerTimestamp: Date | null;
  observedAt: Date;
  recordedAt: Date;
  observationId: string;
  qualityFlags: number;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function contentHash(p: PositionInput): string {
  const parts = [
    p.vehicleId,
    p.tripId ?? "",
    p.tripStartDate ?? "",
    p.tripStartTime ?? "",
    p.routeId ?? "",
    p.lat.toFixed(6),
    p.lon.toFixed(6),
    p.bearing == null ? "" : String(p.bearing),
    p.speedMps == null ? "" : String(p.speedMps),
    p.occupancyStatus ?? "",
    p.currentStatus ?? "",
    p.stopId ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

export function normalizePosition(input: PositionInput): NormalizedPosition {
  const recordedAt = asDate(input.recordedAt) ?? new Date();
  const entityTimestamp = asDate(input.entityTimestamp);
  const headerTimestamp = asDate(input.headerTimestamp);

  let qualityFlags = input.qualityFlags ?? 0;
  let observedAt: Date;
  let observationId: string;

  if (entityTimestamp) {
    observedAt = entityTimestamp;
    observationId = `${input.entityId}:e:${entityTimestamp.toISOString()}`;
  } else if (headerTimestamp) {
    observedAt = headerTimestamp;
    observationId = `${input.entityId}:h:${headerTimestamp.toISOString()}`;
  } else {
    observedAt = recordedAt;
    qualityFlags |= QUALITY_MISSING_SOURCE_TIMESTAMP;
    observationId = `${input.entityId}:c:${contentHash(input)}`;
  }

  return {
    feedName: input.feedName,
    entityId: input.entityId,
    vehicleId: input.vehicleId,
    feedVersionId: input.feedVersionId ?? null,
    tripId: input.tripId ?? null,
    tripStartDate: input.tripStartDate ?? null,
    tripStartTime: input.tripStartTime ?? null,
    routeId: input.routeId ?? null,
    lon: input.lon,
    lat: input.lat,
    bearing: input.bearing ?? null,
    speedMps: input.speedMps ?? null,
    occupancyStatus: input.occupancyStatus ?? null,
    currentStatus: input.currentStatus ?? null,
    stopId: input.stopId ?? null,
    entityTimestamp,
    headerTimestamp,
    observedAt,
    recordedAt,
    observationId,
    qualityFlags,
  };
}
