import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Nav from "@/components/Nav";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.sass";

// next/font/google's Inter is variable-only (Google's css2 API - the one
// Next's fetcher uses - only ever serves Inter as a single variable-font
// file, even when a `weight` array is passed; it just re-declares that same
// file under multiple font-weight blocks, which doesn't help). The Pi's
// kiosk Chromium build can't render variable fonts - no error, it just
// silently falls back to a system sans-serif. Google's legacy /css? API
// (queried with an old, pre-variable-font user agent) still hands out
// genuinely distinct static instances per weight, which is what these
// files are - self-hosted here instead so this doesn't depend on that
// legacy endpoint staying available. See app/fonts/README.md.
const inter = localFont({
  src: [
    { path: "./fonts/Inter-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Inter-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Inter-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Home Dashboard",
  description: "Raspberry Pi wall dashboard",
};

// Disables pinch-to-zoom on the touchscreen - Chromium's --disable-pinch
// launch flag was deprecated years ago and no longer works. This viewport
// control used to be the standard fix too, but Chromium 88+ ignores
// maximumScale/userScalable for accessibility reasons, so pinch still works
// despite this. The actual enforcement is globals.sass's `touch-action: none`
// - this is kept as a harmless fallback for browsers that do still honor it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={inter.variable}
      data-kiosk={process.env.NODE_ENV === "production" ? "" : undefined}
    >
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
