import type { PositionInput } from "../positions/normalize";
import type { DecodedFeed } from "./decode";

const STATUS_NAMES: Record<number, string> = {
  0: "INCOMING_AT",
  1: "STOPPED_AT",
  2: "IN_TRANSIT_TO",
};

export function mapVehicleEntities(
  feed: DecodedFeed,
  options: { feedName: string; feedVersionId?: number | null },
): { positions: PositionInput[]; missingPosition: number } {
  const positions: PositionInput[] = [];
  let missingPosition = 0;
  const headerTimestamp = feed.headerTimestamp;

  for (const entity of feed.entities) {
    const v = entity.vehicle;
    if (!v) continue;
    const vehicleId =
      v.vehicle?.id || v.vehicle?.label || entity.id || "unknown";
    const entityId = entity.id || vehicleId;
    const pos = v.position;
    if (!pos || pos.latitude == null || pos.longitude == null) {
      missingPosition++;
      positions.push({
        feedName: options.feedName,
        feedVersionId: options.feedVersionId,
        entityId,
        vehicleId,
        tripId: v.trip?.tripId ?? null,
        tripStartDate: formatStartDate(v.trip?.startDate),
        tripStartTime: v.trip?.startTime ?? null,
        routeId: v.trip?.routeId ?? null,
        lat: Number.NaN,
        lon: Number.NaN,
        entityTimestamp: v.timestamp
          ? new Date(Number(v.timestamp) * 1000)
          : null,
        headerTimestamp,
        currentStatus:
          v.currentStatus != null ? STATUS_NAMES[v.currentStatus] ?? String(v.currentStatus) : null,
        stopId: v.stopId ?? null,
        qualityFlags: 0,
      });
      continue;
    }

    positions.push({
      feedName: options.feedName,
      feedVersionId: options.feedVersionId,
      entityId,
      vehicleId,
      tripId: v.trip?.tripId ?? null,
      tripStartDate: formatStartDate(v.trip?.startDate),
      tripStartTime: v.trip?.startTime ?? null,
      routeId: v.trip?.routeId ?? null,
      lat: pos.latitude,
      lon: pos.longitude,
      bearing: pos.bearing ?? null,
      speedMps: pos.speed ?? null,
      entityTimestamp: v.timestamp
        ? new Date(Number(v.timestamp) * 1000)
        : null,
      headerTimestamp,
      currentStatus:
        v.currentStatus != null
          ? STATUS_NAMES[v.currentStatus] ?? String(v.currentStatus)
          : null,
      stopId: v.stopId ?? null,
      occupancyStatus:
        v.occupancyStatus != null ? String(v.occupancyStatus) : null,
    });
  }

  return { positions, missingPosition };
}

function formatStartDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}
