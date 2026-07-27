import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ".nosync" keeps iCloud Drive from syncing the build output. This project
  // lives in ~/Desktop (which iCloud syncs), and iCloud racing the build
  // churn used to strand duplicate "file 2.ts" conflict copies inside .next
  // that broke local typechecks. Vercel's deploy pipeline requires the
  // default ".next" (its output collector 404s on a renamed dir), so the
  // rename is local-only.
  distDir: process.env.VERCEL ? ".next" : ".next.nosync",

  // Baseline security headers on every response. HSTS is already added by
  // Vercel; a full Content-Security-Policy is deliberately omitted — the app
  // is built on inline styles/scripts and a strict CSP would break it.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
