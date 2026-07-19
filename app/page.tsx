import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "40rem" }}>
      <h1>busTracker</h1>
      <p>Live tracker map shell is on the track page.</p>
      <p>
        <Link href="/track">Open live map →</Link>
      </p>
      <p>
        <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
