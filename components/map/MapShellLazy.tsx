"use client";

import dynamic from "next/dynamic";
import type { MapShellProps } from "./MapShell";

/**
 * Code-split entry: MapLibre stays out of the initial document JS payload.
 */
export const MapShellLazy = dynamic(
  () => import("./MapShell").then((m) => m.MapShell),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: 280,
          borderRadius: 12,
          background: "#e8ebe6",
        }}
        aria-busy="true"
        aria-label="Loading map"
      />
    ),
  },
);

export type { MapShellProps };
