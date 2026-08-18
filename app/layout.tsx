import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Nav from "@/components/Nav";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";

// Self-hosted by Next (no runtime request to Google) - matches base.css's
// original font-family, which put Inter first ahead of the system stack.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Home Dashboard",
  description: "Raspberry Pi wall dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
