import type { Metadata } from "next";
import { Georama } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

const georama = Georama({
  variable: "--font-georama",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Trail: firsthand reviews of BOT Chain apps", template: "%s | Trail" },
  description:
    "Discover BOT Chain apps through reviews from people who actually used them, backed by on-chain proof.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${georama.variable} h-full`}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" />
      </head>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="skip-link">Skip to content</a>
        <Providers>
          <SiteHeader />
          <main id="main" className="flex-1">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
