import { MapShellLazy } from "@/components/map/MapShellLazy";
import styles from "./track.module.css";

export default function TrackPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.brand}>busTracker</h1>
        <p className={styles.sub}>Live map</p>
      </header>
      <div className={styles.mapWrap}>
        <MapShellLazy />
      </div>
    </main>
  );
}
