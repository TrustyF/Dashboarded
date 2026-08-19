import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Nav from "@/components/Nav";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.sass";

// Self-hosted by Next (no runtime request to Google) - matches base.css's
// original font-family, which put Inter first ahead of the system stack.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Home Dashboard",
  description: "Raspberry Pi wall dashboard",
};

// Disables pinch-to-zoom on the touchscreen - Chromium's --disable-pinch
// launch flag was deprecated years ago and no longer works, but this
// standard viewport control still does. Fixed dashboard on a wall-mounted
// panel has no legitimate use for user zoom, unlike a normal web page.
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
