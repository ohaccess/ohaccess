import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ".nosync" keeps iCloud Drive from syncing the build output. This project
  // lives in ~/Desktop (which iCloud syncs), and iCloud racing the build
  // churn used to strand duplicate "file 2.ts" conflict copies inside .next
  // that broke local typechecks. Vercel's deploy pipeline requires the
  // default ".next" (its output collector 404s on a renamed dir), so the
  // rename is local-only.
  distDir: process.env.VERCEL ? ".next" : ".next.nosync",
};

export default nextConfig;
