import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";

import { Providers } from "@/components/providers";
import { readSettings } from "@/lib/settings";
import type { Theme } from "@/lib/db/schema";

import "./globals.css";

const inter = localFont({
  src: [{ path: "../assets/fonts/InterVariable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Pulse Journal", template: "%s · Pulse Journal" },
  description: "Dein privates Trading-Journal.",
  applicationName: "Pulse Journal",
  appleWebApp: { capable: true, title: "Pulse", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-180.png", sizes: "180x180" }],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

async function currentTheme(): Promise<Theme> {
  await connection();
  try {
    return readSettings().theme;
  } catch {
    return "dark";
  }
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme();
  const themeColor =
    theme === "dark"
      ? "#0A0B0F"
      : theme === "light"
        ? "#F6F7F9"
        : [
            { media: "(prefers-color-scheme: dark)", color: "#0A0B0F" },
            { media: "(prefers-color-scheme: light)", color: "#F6F7F9" },
          ];
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await currentTheme();
  return (
    <html lang="de-CH" data-theme={theme} className={inter.variable} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
