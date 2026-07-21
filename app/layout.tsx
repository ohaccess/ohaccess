import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import RefCapture from "./_components/RefCapture";
import ImpersonationBanner from "./_components/ImpersonationBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ohACCESS",
  description: "Open House Visitor Verification System",
  // Link previews (iMessage, Facebook, LinkedIn, X). Copy per Dave.
  openGraph: {
    title: "ohACCESS – Verified Open House Check-In",
    description:
      "Replace paper sign-in sheets with verified QR-code digital check-in. Know exactly who walked through your open house.",
    url: "https://ohaccess.com",
    type: "website",
    images: ["https://ohaccess.com/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://ohaccess.com/og-image.png"],
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
        <Analytics />
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&v=weekly&libraries=places`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}