/** GTFS clock times as seconds since service-day midnight (may exceed 86400). */
export function parseGtfsTime(value: string): number | null {
  const m = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = Number(m[3]);
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatGtfsTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
