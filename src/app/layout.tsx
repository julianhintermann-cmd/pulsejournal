import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";

import { Providers } from "@/components/providers";
import type { Theme } from "@/lib/db/schema";
import { IOS_BOOT_SCRIPT } from "@/lib/ios/boot-script";
import launchScreens from "@/lib/ios/launch-screens.json";
import { themeColorDescriptors } from "@/lib/ios/theme-color";
import { readSettings } from "@/lib/settings";

import "./globals.css";

const inter = localFont({
  src: [{ path: "../assets/fonts/InterVariable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
});

async function currentTheme(): Promise<Theme> {
  await connection();
  try {
    return readSettings().theme;
  } catch {
    return "dark";
  }
}

/** iOS launch screens for every iPhone size; a fixed theme only gets its own colour (no flash on cold start). */
function startupImages(theme: Theme) {
  const schemes = theme === "system" ? (["dark", "light"] as const) : [theme];
  return launchScreens.devices.flatMap((d) =>
    schemes.map((scheme) => ({
      url: `/launch/launch-${d.width * d.ratio}x${d.height * d.ratio}-${scheme}.png`,
      media:
        `screen and (device-width: ${d.width}px) and (device-height: ${d.height}px) and ` +
        `(-webkit-device-pixel-ratio: ${d.ratio}) and (orientation: portrait)` +
        (theme === "system" ? ` and (prefers-color-scheme: ${scheme})` : ""),
    })),
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const theme = await currentTheme();
  return {
    title: { default: "Pulse Journal", template: "%s · Pulse Journal" },
    description: "Dein privates Trading-Journal.",
    applicationName: "Pulse Journal",
    appleWebApp: {
      capable: true,
      title: "Pulse",
      statusBarStyle: "black-translucent",
      startupImage: startupImages(theme),
    },
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
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: themeColorDescriptors(theme),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await currentTheme();
  return (
    <html lang="de-CH" data-theme={theme} className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: IOS_BOOT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
