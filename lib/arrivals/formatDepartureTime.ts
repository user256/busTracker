/** Display countdown under 60 minutes, clock time beyond (Ticket 205). */
export function formatDepartureTime(
  iso: string | null,
  nowMs: number = Date.now(),
): string {
  if (!iso) return "—";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";

  const diffMs = at.getTime() - nowMs;
  if (diffMs < 0) return "Due";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) {
    if (diffMin <= 0) return "Due";
    return `in ${diffMin} min`;
  }

  return at.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function secondsSince(iso: string, nowMs: number = Date.now()): number {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
}
