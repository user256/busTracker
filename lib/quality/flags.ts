/** Ingest-stable quality flag bits (Ticket 105). */
export const QualityFlag = {
  MISSING_SOURCE_TIMESTAMP: 1 << 0,
  IMPLAUSIBLE_JUMP: 1 << 1,
  IMPLAUSIBLE_SPEED: 1 << 2,
  OFF_ROUTE: 1 << 3,
  NO_TRIP: 1 << 4,
  TRIP_ENDED: 1 << 5,
  MISSING_POSITION: 1 << 6,
  DUPLICATE_VEHICLE_TRIP: 1 << 7,
} as const;

export type QualityFlagName = keyof typeof QualityFlag;

export const QUALITY_MISSING_SOURCE_TIMESTAMP =
  QualityFlag.MISSING_SOURCE_TIMESTAMP;

export const FLAG_NAMES: QualityFlagName[] = [
  "MISSING_SOURCE_TIMESTAMP",
  "IMPLAUSIBLE_JUMP",
  "IMPLAUSIBLE_SPEED",
  "OFF_ROUTE",
  "NO_TRIP",
  "TRIP_ENDED",
  "MISSING_POSITION",
  "DUPLICATE_VEHICLE_TRIP",
];

export function flagsToNames(flags: number): QualityFlagName[] {
  return FLAG_NAMES.filter((name) => (flags & QualityFlag[name]) !== 0);
}

export type FreshnessLabel = "FRESH" | "STALE" | "VERY_STALE";

export function freshnessFromAge(
  ageSeconds: number,
  staleSeconds: number,
  veryStaleSeconds: number,
): FreshnessLabel {
  if (ageSeconds > veryStaleSeconds) return "VERY_STALE";
  if (ageSeconds > staleSeconds) return "STALE";
  return "FRESH";
}
