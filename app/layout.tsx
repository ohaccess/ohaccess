import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import RefCapture from "./_components/RefCapture";
import ImpersonationBanner from "./_components/ImpersonationBanner";
import MarketingTags from "./_components/MarketingTags";

// Meta's domain-verification tag (Events Manager → Brand Safety → Domains).
// Required before Meta will let ad campaigns optimize for web events on
// ohaccess.com. Env-driven so it can be set from Vercel without a code change.
const metaDomainVerification = process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.ohaccess.com"),
  title: {
    default: "ohACCESS – Verified Open House Check-In for Real Estate Agents",
    template: "%s · ohACCESS",
  },
  description:
    "Replace paper sign-in sheets with verified QR-code digital check-in. Know exactly who walked through your open house.",
  keywords: [
    "open house sign-in app",
    "open house sign-in sheet",
    "digital open house sign-in",
    "verified open house check-in",
    "QR code open house registration",
    "open house lead capture",
    "real estate open house software",
    "open house app for real estate agents",
    "open house visitor registration",
    "real estate lead capture app",
    "paperless open house sign-in",
    "open house guest registration",
    "open house security",
    "real estate agent tools",
    "open house follow-up",
  ],
  // Self-referencing canonical on every page, resolved against metadataBase
  // (www is the canonical host — the apex 308s to it).
  alternates: { canonical: "./" },
  // Link previews (iMessage, Facebook, LinkedIn, X). Copy per Dave.
  // og:image/og:url MUST be the www host: the apex 307-redirects to www and
  // Facebook's crawler drops redirected images (same trap that broke the
  // Stripe webhook and Twilio status callbacks). Explicit width/height lets
  // FB render the image on the very first share instead of after an async
  // re-scrape.
  openGraph: {
    title: "ohACCESS – Verified Open House Check-In",
    description:
      "Replace paper sign-in sheets with verified QR-code digital check-in. Know exactly who walked through your open house.",
    url: "https://www.ohaccess.com",
    type: "website",
    images: [{ url: "https://www.ohaccess.com/og-image.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://www.ohaccess.com/og-image.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  ...(metaDomainVerification
    ? { verification: { other: { "facebook-domain-verification": [metaDomainVerification] } } }
    : {}),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RefCapture />
        <ImpersonationBanner />
        {children}
        {/* Maps JS is no longer loaded here — OpenHouseMap owns the script
            tag; every other page was paying ~200KB for nothing. */}
        <Analytics />
        {/* Ad tags (Meta Pixel / Google Ads) — marketing routes only; the
            component decides per route, see lib/marketing-tags. */}
        <MarketingTags />
      </body>
    </html>
  );
}