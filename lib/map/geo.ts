/** Earth-mean haversine distance in metres. */
export function haversineMetres(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing in degrees [0, 360) from point A → B. */
export function bearingDegrees(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Shortest-path interpolate between two bearings. */
export function lerpBearing(from: number, to: number, t: number): number {
  let delta = ((to - from + 540) % 360) - 180;
  return (from + delta * t + 360) % 360;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
