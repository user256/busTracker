import { MapShellLazy } from "@/components/map/MapShellLazy";
import type { LiveBadgeState } from "@/components/map/LiveBadge";
import styles from "./track.module.css";

const BADGE_STATES: LiveBadgeState[] = [
  "live",
  "delayed",
  "timetable",
  "offline",
];

type Props = {
  searchParams: Promise<{ badge?: string }>;
};

export default async function TrackPage({ searchParams }: Props) {
  const params = await searchParams;
  const raw = params.badge ?? "live";
  const liveState = BADGE_STATES.includes(raw as LiveBadgeState)
    ? (raw as LiveBadgeState)
    : "live";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.brand}>busTracker</h1>
        <p className={styles.sub}>Live map shell (Ticket 201)</p>
      </header>
      <div className={styles.mapWrap}>
        <MapShellLazy liveState={liveState} />
      </div>
    </main>
  );
}
