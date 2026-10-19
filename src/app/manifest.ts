import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pulse Journal",
    short_name: "Pulse",
    description: "Dein privates Trading-Journal.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Launch background of installed apps = the mobile app background (no flash); see src/lib/ios/theme-color.ts.
    background_color: "#000000",
    theme_color: "#000000",
    lang: "de-CH",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Neuer Trade",
        short_name: "Neuer Trade",
        url: "/trades/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Journal heute",
        short_name: "Journal",
        url: "/journal/today",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
