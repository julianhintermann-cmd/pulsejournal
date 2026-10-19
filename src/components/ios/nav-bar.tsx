"use client";

import { ChevronLeft, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { GlobalFilterSheetButton } from "@/components/global-filter";
import { GlassButton, GlassSurface } from "@/components/ios/glass";
import { filterMode } from "@/components/nav-items";
import { hasLargeTitle, isSheetRoute, mobileTitle, parentOf } from "@/lib/ios/nav";
import { previousScreen } from "@/lib/ios/nav-memory";

/** Height of the bar row below the status bar (px). */
export const NAV_ROW = 52;

/** Scroll offset of the screen: the document, or <main> while a sheet scrolls inside it. */
function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const main = document.getElementById("main");
      const value = document.documentElement.hasAttribute("data-presented") && main ? main.scrollTop : window.scrollY;
      setY((prev) => (Math.abs(prev - value) < 1 ? prev : value));
      // Rubber-band overscroll at the top makes the large title grow slightly (anchored left), like iOS.
      document.documentElement.style.setProperty(
        "--title-scale",
        value < 0 ? String(1 + Math.min(0.06, -value / 500)) : "1",
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return y;
}

/** Glass back button: pops to the previous screen when it is the parent, otherwise opens the parent. */
export function BackButton({ parent }: { parent: string }) {
  const router = useRouter();
  return (
    <GlassButton
      aria-label="Zurück"
      onClick={() => {
        if (previousScreen() === parent) router.back();
        else router.push(parent);
      }}
    >
      <ChevronLeft className="!size-6" strokeWidth={2.2} />
    </GlassButton>
  );
}

/** ✕ of a presented sheet: back to the presenting screen. Forms register their own handler (dirty check). */
export function SheetCloseButton({ parent }: { parent: string }) {
  const router = useRouter();
  return (
    <GlassButton
      aria-label="Abbrechen"
      onClick={() => {
        const handler = sheetCloseHandler;
        if (handler) return handler();
        const previous = previousScreen();
        if (previous && !isSheetRoute(previous)) router.back();
        else router.push(parent);
      }}
    >
      <X className="!size-[22px]" strokeWidth={2.2} />
    </GlassButton>
  );
}

let sheetCloseHandler: (() => void) | null = null;
/** Lets a sheet route (e.g. the trade form) intercept ✕ to ask before discarding changes. */
export function setSheetCloseHandler(handler: (() => void) | null) {
  sheetCloseHandler = handler;
}

/**
 * iOS 26 navigation bar for phones (section 4.2): no solid background – a scroll edge effect fades in once content
 * moves underneath; glass back circle on the left, inline title in the middle (after the large title scrolled
 * away), and one glass capsule with the global filter and search on the right.
 */
export function NavBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const pathname = usePathname();
  const y = useScrollY();
  const large = hasLargeTitle(pathname);
  const parent = parentOf(pathname);
  const mode = filterMode(pathname);
  const title = mobileTitle(pathname);
  const inline = !large || y > 40;
  const sheet = isSheetRoute(pathname);

  return (
    <div className="md:hidden" data-ios-chrome>
      <div className="ios-edge-top" data-visible={y > 4 ? "" : undefined} />
      <div className="ios-navbar" data-inline-title={inline ? "" : undefined}>
        <div className="ios-navbar__row">
          <div className="flex items-center">
            {sheet && parent ? <SheetCloseButton parent={parent} /> : parent ? <BackButton parent={parent} /> : null}
          </div>
          {large ? (
            <p className="ios-navbar__title" aria-hidden="true">
              {title}
            </p>
          ) : (
            <h1 className="ios-navbar__title">{title}</h1>
          )}
          <div className="flex items-center justify-end" id="ios-navbar-trailing">
            {sheet ? null : mode ? (
              <GlassSurface shape="capsule" className="flex h-11 items-center">
                <Suspense>
                  <GlobalFilterSheetButton mode={mode} />
                </Suspense>
                <span aria-hidden="true" className="h-5 w-px bg-[var(--ios-separator)]" />
                <button
                  type="button"
                  aria-label="Suchen"
                  onClick={onOpenCommand}
                  className="flex h-11 w-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Search className="size-[21px]" strokeWidth={2} />
                </button>
              </GlassSurface>
            ) : (
              <GlassButton aria-label="Suchen" onClick={onOpenCommand}>
                <Search className="!size-[21px]" strokeWidth={2} />
              </GlassButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Large title at the top of the scroll content (phones only). */
export function LargeTitle({ pathname }: { pathname: string }) {
  if (!hasLargeTitle(pathname)) return null;
  return <h1 className="ios-large-title mb-3 md:hidden">{mobileTitle(pathname)}</h1>;
}
