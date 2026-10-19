"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { GlassButton, GlassSurface } from "@/components/ios/glass";
import { useScrollDirection } from "@/hooks/ios/use-scroll-direction";
import { haptic } from "@/lib/ios/haptics";
import { TABS, tabFor, type Tab } from "@/lib/ios/nav";
import { lastScreen, requestScrollRestore } from "@/lib/ios/nav-memory";
import { cn } from "@/lib/utils";

const PAD = 4;

/** Where a tab tap leads: the tab's remembered screen, its root when already active, or null to scroll to top. */
function tabTarget(tab: Tab, activeKey: string, pathname: string): string | null {
  if (tab.key !== activeKey) return lastScreen(tab.key) ?? tab.href;
  return pathname === tab.href ? null : tab.href;
}

/**
 * iOS 26 floating tab bar (section 4.1): glass capsule with a sliding selection pill, finger scrubbing across the
 * tabs, collapse to a circle while scrolling down, and the separate prominent "+" button.
 */
export function GlassTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = tabFor(pathname);
  const activeIndex = TABS.findIndex((t) => t.key === activeKey);
  const { collapsed: scrolledAway } = useScrollDirection(40);
  const [expanded, setExpanded] = useState(false);
  // A tap on the mini button expands the bar until the next scroll-down gesture.
  const [prevScrolledAway, setPrevScrolledAway] = useState(scrolledAway);
  if (prevScrolledAway !== scrolledAway) {
    setPrevScrolledAway(scrolledAway);
    if (!scrolledAway) setExpanded(false);
  }
  const collapsed = scrolledAway && !expanded;

  const capsuleRef = useRef<HTMLDivElement>(null);
  /** index under the finger and the pill offset in item widths. */
  const [scrub, setScrub] = useState<{ index: number; offset: number } | null>(null);
  /** Where a touch started; scrubbing begins only once the finger really moves. */
  const press = useRef<{ x: number; id: number } | null>(null);
  const suppressClick = useRef(false);

  // The tapped tab is selected at once (the next screen may take a moment to arrive): the pill goes there and stays,
  // instead of springing back to the old tab and moving again when the route commits.
  const [pending, setPending] = useState<number | null>(null);
  const [pendingFor, setPendingFor] = useState(pathname);
  if (pendingFor !== pathname) {
    setPendingFor(pathname);
    if (pending !== null) setPending(null);
  }
  useEffect(() => {
    if (pending === null) return;
    const t = window.setTimeout(() => setPending(null), 4000); // navigation failed: show the real tab again
    return () => window.clearTimeout(t);
  }, [pending]);
  const selectedIndex = pending ?? activeIndex;

  const lastIndex = useRef(selectedIndex);
  const [stretch, setStretch] = useState(false);
  // Droplet stretch while the pill travels to a new tab.
  useLayoutEffect(() => {
    if (lastIndex.current === selectedIndex) return;
    lastIndex.current = selectedIndex;
    setStretch(true);
    const t = window.setTimeout(() => setStretch(false), 380);
    return () => window.clearTimeout(t);
  }, [selectedIndex]);

  const go = (tab: Tab) => {
    const target = tabTarget(tab, activeKey, pathname);
    if (target === null) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (tab.key !== activeKey) {
      // Tab switches keep each tab's scroll position; no slide animation (iOS swaps tabs instantly).
      setPending(TABS.indexOf(tab));
      requestScrollRestore(target);
      router.push(target, { scroll: false });
    } else router.push(target);
  };

  const measure = (clientX: number) => {
    const rect = capsuleRef.current!.getBoundingClientRect();
    const width = rect.width - PAD * 2;
    const itemW = width / TABS.length;
    const x = Math.min(Math.max(clientX - rect.left - PAD, 0), width - 1);
    const left = Math.min(Math.max(x - itemW / 2, 0), width - itemW);
    return { index: Math.floor(x / itemW), offset: left / itemW };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (collapsed || event.button !== 0) return;
    press.current = { x: event.clientX, id: event.pointerId };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!scrub) {
      // A plain tap is a tap (the link handles it); a drag of 6 px across the bar starts scrubbing.
      if (!press.current || Math.abs(event.clientX - press.current.x) < 6) return;
      capsuleRef.current?.setPointerCapture?.(press.current.id);
      haptic("selection");
      setScrub(measure(event.clientX));
      return;
    }
    const next = measure(event.clientX);
    if (next.index !== scrub.index) haptic("selection");
    setScrub(next);
  };
  const onPointerUp = (event: React.PointerEvent) => {
    press.current = null;
    if (!scrub) return;
    const { index } = measure(event.clientX);
    setScrub(null);
    // The click that follows a captured pointer may land on the capsule instead of the link; ignore it either way.
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 400);
    go(TABS[index]);
  };

  // Pill position: follows the finger while scrubbing (CSS eases the follow), otherwise sits on the selected tab.
  const pillStyle: React.CSSProperties = {
    width: `${100 / TABS.length}%`,
    transform: `translateX(${(scrub ? scrub.offset : selectedIndex) * 100}%)`,
  };
  const highlighted = scrub ? scrub.index : selectedIndex;
  const ActiveIcon = TABS[activeIndex].icon;

  return (
    <div data-ios-chrome className="ios-tabbar md:hidden" data-collapsed={collapsed ? "" : undefined}>
      <div className="ios-tabbar__slot">
        <GlassSurface
          ref={capsuleRef}
          shape="capsule"
          role="navigation"
          aria-label="Navigation"
          className="ios-tabbar__capsule"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            press.current = null;
            setScrub(null);
          }}
        >
          <div className="pointer-events-none absolute inset-y-[4px] left-[4px] right-[4px]">
            <div className="ios-tabbar__pill-track" style={pillStyle} data-scrubbing={scrub ? "" : undefined}>
              <div
                className="ios-tabbar__pill"
                data-stretch={stretch && !scrub ? "" : undefined}
                data-scrubbing={scrub ? "" : undefined}
              />
            </div>
          </div>
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            const active = i === highlighted;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={tab.key === activeKey ? "page" : undefined}
                draggable={false}
                onClick={(event) => {
                  event.preventDefault();
                  if (!suppressClick.current) go(tab);
                }}
                className={cn("ios-tabbar__item", active && "ios-tabbar__item--active")}
              >
                <Icon className="size-6" strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </GlassSurface>
        <GlassButton
          shape="circle"
          aria-label={`${TABS[activeIndex].label} – Navigation einblenden`}
          className="ios-tabbar__mini"
          tabIndex={collapsed ? 0 : -1}
          aria-hidden={collapsed ? undefined : true}
          onClick={() => setExpanded(true)}
        >
          <ActiveIcon className="!size-6 text-accent" strokeWidth={2.2} />
        </GlassButton>
      </div>
      <GlassButton asChild variant="prominent" shape="circle" className="ios-tabbar__fab">
        <Link href="/trades/new?mode=quick" aria-label="Neuer Trade">
          <Plus className="!size-7" strokeWidth={2.4} />
        </Link>
      </GlassButton>
    </div>
  );
}
