import { getEnv } from "../env";
import {
  flagsToNames,
  freshnessFromAge,
  QualityFlag,
  type FreshnessLabel,
} from "./flags";

/** Positions that must never be returned as passenger "live" dots. */
const UNSERVABLE_BITS =
  QualityFlag.IMPLAUSIBLE_JUMP | QualityFlag.MISSING_POSITION;

export function isServableFlags(qualityFlags: number): boolean {
  return (qualityFlags & UNSERVABLE_BITS) === 0;
}

export function isServableAtRead(options: {
  qualityFlags: number;
  ageSeconds: number;
}): boolean {
  if (!isServableFlags(options.qualityFlags)) return false;
  const env = getEnv();
  if (options.ageSeconds > env.QUALITY_VERY_STALE_SECONDS) return false;
  return true;
}

export function readQualityLabels(options: {
  qualityFlags: number;
  ageSeconds: number;
}): Array<FreshnessLabel | string> {
  const env = getEnv();
  const freshness = freshnessFromAge(
    options.ageSeconds,
    env.QUALITY_STALE_SECONDS,
    env.QUALITY_VERY_STALE_SECONDS,
  );
  const labels: Array<FreshnessLabel | string> = [freshness];
  for (const name of flagsToNames(options.qualityFlags)) {
    labels.push(name);
  }
  return labels;
}
