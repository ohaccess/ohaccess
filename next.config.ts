import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ".nosync" keeps iCloud Drive from syncing the build output. This project
  // lives in ~/Desktop (which iCloud syncs), and iCloud racing the build
  // churn used to strand duplicate "file 2.ts" conflict copies inside .next
  // that broke local typechecks. Vercel reads this config too — harmless
  // there, it just builds into the renamed folder.
  distDir: ".next.nosync",
};

export default nextConfig;
