import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep file watchers inside the project — avoids EMFILE when inotify
  // instances are exhausted and Watchpack walks up to /home.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        ignored: [
          "**/.git/**",
          "**/node_modules/**",
          "**/.next/**",
          "**/data/**",
          "**/fixtures/gtfs-rt/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
