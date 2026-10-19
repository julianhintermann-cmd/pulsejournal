import type { Theme } from "@/lib/db/schema";

/** Page backgrounds: the iOS grouped background below 768 px, the desktop palette above. */
export const THEME_COLORS = {
  mobile: { dark: "#000000", light: "#F2F2F7" },
  desktop: { dark: "#0A0B0F", light: "#F6F7F9" },
} as const;

const MOBILE = "(max-width: 767px)";

/** `theme-color` entries for a theme; browsers use the first entry whose media query matches. */
export function themeColorDescriptors(theme: Theme): { media?: string; color: string }[] {
  if (theme === "system") {
    return [
      { media: `${MOBILE} and (prefers-color-scheme: dark)`, color: THEME_COLORS.mobile.dark },
      { media: `${MOBILE} and (prefers-color-scheme: light)`, color: THEME_COLORS.mobile.light },
      { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.desktop.dark },
      { media: "(prefers-color-scheme: light)", color: THEME_COLORS.desktop.light },
    ];
  }
  return [{ media: MOBILE, color: THEME_COLORS.mobile[theme] }, { color: THEME_COLORS.desktop[theme] }];
}
