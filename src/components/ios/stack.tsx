"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

import { depthOf, isSheetRoute, parentOf, tabFor, type TabKey } from "@/lib/ios/nav";
import { previousScreen, savedScroll } from "@/lib/ios/nav-memory";

/*
 * Stack navigation for the phone layout (section 4.3).
 *
 * The outgoing screen is frozen as a static DOM snapshot (cloneNode, inert) the moment React removes it – see
 * <StackProbe>. Push/pop/present/dismiss animate the real new screen against that snapshot; swipe-back drags the
 * real current screen over the snapshot of the previous one and then navigates back. A snapshot is plain DOM, so it
 * can never re-read the new URL ("frozen location"), and every navigation source (links, router.push, history) is
 * covered. Custom transitions only run in the home-screen app; Safari tabs and reduced motion get a 150 ms
 * crossfade because Safari animates its own back/forward gestures.
 */

type Snapshot = { pathname: string; node: HTMLElement; scrollY: number; innerScroll: number };
type Kind = "push" | "pop" | "present" | "dismiss" | "tab" | "replace";

const PHONE = "(max-width: 767px)";
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const DURATION = 500;
const PARALLAX = 0.3;
const DIM = 0.12;
const SHEET_DIM = 0.28;
const MAX_STACK = 8;

const stacks = new Map<TabKey, Snapshot[]>();
let departed: Snapshot | null = null;
let presenter: Snapshot | null = null;
let presentingTab: TabKey | null = null;
let swipeCompleted = false;
let running: { animations: Animation[]; cleanup: () => void } | null = null;

const isPhone = () => window.matchMedia(PHONE).matches;
const isStandalone = () => document.documentElement.hasAttribute("data-standalone");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const getMain = () => document.getElementById("main");

function stackOf(tab: TabKey) {
  let list = stacks.get(tab);
  if (!list) stacks.set(tab, (list = []));
  return list;
}

/** Tab a pathname belongs to; sheets belong to the tab that presented them. */
function effectiveTab(pathname: string): TabKey {
  return isSheetRoute(pathname) && presentingTab ? presentingTab : tabFor(pathname);
}

function capture(main: HTMLElement, pathname: string): Snapshot {
  // A <div> copy (not a second <main> landmark) with the same classes and content.
  const clone = document.createElement("div");
  clone.className = main.className;
  clone.append(...[...main.childNodes].map((n) => n.cloneNode(true)));
  clone.classList.remove("animate-page", "ios-stack-front");
  // A presented sheet scrolls inside <main>; its frozen copy keeps the sheet geometry without the html flag.
  const sheet = document.documentElement.hasAttribute("data-presented");
  if (sheet) clone.classList.add("ios-main--sheet");
  clone.setAttribute("inert", "");
  clone.setAttribute("aria-hidden", "true");
  // Fixed elements (install hint, sticky form bars) would land in the wrong place inside the frozen frame.
  for (const el of clone.querySelectorAll("[data-snapshot-skip]")) el.remove();
  const frame = document.createElement("div");
  frame.className = "ios-snapshot";
  const inner = document.createElement("div");
  inner.className = "ios-snapshot__inner";
  inner.style.transform = sheet ? "none" : `translate3d(0, ${-window.scrollY}px, 0)`;
  inner.appendChild(clone);
  frame.appendChild(inner);
  return { pathname, node: frame, scrollY: window.scrollY, innerScroll: sheet ? main.scrollTop : 0 };
}

/** Inner scroll positions are lost by cloneNode; reapply once the frame is in the document. */
function restoreInnerScroll(snapshot: Snapshot) {
  if (!snapshot.innerScroll) return;
  const main = snapshot.node.querySelector<HTMLElement>(".ios-main");
  if (main) main.scrollTop = snapshot.innerScroll;
}

// ---------- Layers (created once, outside React) ----------

type Layers = { under: HTMLElement; underDim: HTMLElement; over: HTMLElement; mainDim: HTMLElement };
let layers: Layers | null = null;

function getLayers(): Layers {
  if (layers?.under.isConnected) return layers;
  const make = (className: string) => {
    const el = document.createElement("div");
    el.className = className;
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    return el;
  };
  const under = make("ios-stack-under");
  const underDim = document.createElement("div");
  underDim.className = "ios-stack-dim";
  under.appendChild(underDim);
  layers = { under, underDim, over: make("ios-stack-over"), mainDim: make("ios-stack-main-dim") };
  return layers;
}

function showUnder(snapshot: Snapshot | null) {
  const { under, underDim } = getLayers();
  for (const child of [...under.children]) if (child !== underDim) child.remove();
  if (snapshot) {
    under.insertBefore(snapshot.node, underDim);
    restoreInnerScroll(snapshot);
  }
  under.toggleAttribute("data-active", true);
  return snapshot?.node ?? null;
}

function hideUnder() {
  const { under, underDim } = getLayers();
  for (const child of [...under.children]) if (child !== underDim) child.remove();
  under.removeAttribute("data-active");
  under.removeAttribute("data-presenting");
  underDim.style.opacity = "0";
}

function showOver(snapshot: Snapshot) {
  const { over } = getLayers();
  over.replaceChildren(snapshot.node);
  restoreInnerScroll(snapshot);
  over.toggleAttribute("data-active", true);
  return snapshot.node;
}

function hideOver() {
  const { over } = getLayers();
  over.replaceChildren();
  over.removeAttribute("data-active");
}

function setPresented(on: boolean) {
  document.documentElement.toggleAttribute("data-presented", on);
  document.documentElement.toggleAttribute("data-sheet-large", on);
}

// ---------- Animation runner (interruptible) ----------

function finishRunning() {
  if (!running) return;
  const current = running;
  running = null;
  for (const a of current.animations) a.cancel();
  current.cleanup();
}

function run(animations: Animation[], cleanup: () => void) {
  const entry = { animations, cleanup };
  running = entry;
  Promise.all(animations.map((a) => a.finished))
    .then(() => {
      if (running === entry) {
        running = null;
        cleanup();
      }
    })
    .catch(() => undefined);
}

function animate(el: Element, keyframes: Keyframe[], duration = DURATION, easing = EASE) {
  return el.animate(keyframes, { duration, easing });
}

function crossfade(main: HTMLElement) {
  run([animate(main, [{ opacity: 0 }, { opacity: 1 }], 150, "ease-out")], () => undefined);
}

function restoreScroll() {
  const y = savedScroll(window.location.pathname + window.location.search);
  if (y != null) scrollToWhenReady(y);
}

/**
 * Scrolls to `y` and holds it briefly: while the screen is still shorter (loading state, images) it keeps restoring as
 * the screen grows, and a jump nobody touched for (WebKit's UI-side scrolling can apply its own stored position after
 * ours, like iOS Safari) is undone. Ends after 2 s (at least 600 ms once reached) or at the first touch, wheel or key.
 */
export function scrollToWhenReady(y: number) {
  window.scrollTo(0, y);
  const started = performance.now();
  const reached = () => Math.abs(window.scrollY - y) < 2;
  const reapply = () => {
    if (!reached()) window.scrollTo(0, y);
    else if (performance.now() - started > 600) stop();
  };
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reapply);
  const timer = window.setTimeout(() => stop(), 2000);
  function stop() {
    observer?.disconnect();
    window.clearTimeout(timer);
    window.removeEventListener("scroll", reapply);
    for (const type of ["touchstart", "wheel", "keydown"]) window.removeEventListener(type, stop);
  }
  observer?.observe(document.body);
  window.addEventListener("scroll", reapply, { passive: true });
  for (const type of ["touchstart", "wheel", "keydown"]) window.addEventListener(type, stop, { passive: true });
}

function classify(from: string, to: string): Kind {
  const fromSheet = isSheetRoute(from);
  const toSheet = isSheetRoute(to);
  if (toSheet && !fromSheet) return "present";
  if (fromSheet && !toSheet) return "dismiss";
  if (fromSheet && toSheet) return "replace";
  if (tabFor(from) !== tabFor(to)) return "tab";
  const df = depthOf(from);
  const dt = depthOf(to);
  if (dt > df) return "push";
  if (dt < df) return "pop";
  return "replace";
}

// Back/forward through the history (Safari's buttons and edge swipe included): the screen gets its remembered scroll
// position back, whatever kind of transition it is (the browser's own restore is off on phones, see IosRuntime).
let traversal = false;
if (typeof window !== "undefined") window.addEventListener("popstate", () => (traversal = true));

/** Called after every route commit (layout effect, before paint) with the snapshot of the screen just left. */
function onCommit(to: string, from: Snapshot | null) {
  const fromHistory = traversal;
  traversal = false;
  finishRunning();
  const main = getMain();
  if (!main || !isPhone()) return;
  main.classList.remove("ios-stack-front");
  // Deep links to a sheet route are presented as a sheet as well (over the black backdrop).
  if (!from && !swipeCompleted) setPresented(isSheetRoute(to));

  if (swipeCompleted) {
    // The swipe already animated; the real previous screen now replaces its snapshot underneath.
    swipeCompleted = false;
    restoreScroll();
    hideUnder();
    return;
  }
  if (!from) return;

  const kind = classify(from.pathname, to);
  const tab = effectiveTab(to);

  // Stack bookkeeping.
  if (kind === "push") {
    const list = stackOf(tab);
    list.push(from);
    if (list.length > MAX_STACK) list.shift();
  } else if (kind === "pop" || kind === "dismiss") {
    const list = stackOf(tab);
    const depth = depthOf(to);
    while (list.length && depthOf(list[list.length - 1].pathname) >= depth) list.pop();
  }
  if (kind === "pop" || kind === "dismiss" || fromHistory) restoreScroll();

  if (kind === "present") {
    presentingTab = tabFor(from.pathname);
    presenter = from;
  }
  const leavingSheet = kind === "dismiss" || (kind !== "present" && kind !== "replace" && !isSheetRoute(to));
  if (leavingSheet) {
    presenter = null;
    presentingTab = null;
  }
  setPresented(isSheetRoute(to));

  const animated = isStandalone() && !reducedMotion();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const { under, underDim, mainDim } = getLayers();

  if (kind === "present") {
    // The previous screen stays visible behind the sheet: scaled down, rounded and dimmed (card stack).
    const node = showUnder(presenter);
    under.setAttribute("data-presenting", "");
    underDim.style.opacity = String(SHEET_DIM);
    if (!animated) return void crossfade(main);
    run(
      [
        animate(main, [{ transform: `translate3d(0, ${h}px, 0)` }, { transform: "none" }], 450),
        ...(node
          ? [
              animate(
                node,
                [
                  { transform: "none", borderRadius: "0px" },
                  { transform: "scale(0.94)", borderRadius: "14px" },
                ],
                450,
              ),
            ]
          : []),
        animate(underDim, [{ opacity: 0 }, { opacity: SHEET_DIM }], 450),
      ],
      () => undefined,
    );
    return;
  }

  if (kind === "dismiss") {
    hideUnder();
    if (!animated) return void crossfade(main);
    const node = showOver(from);
    main.style.transformOrigin = `50% ${window.scrollY + h / 2}px`;
    run(
      [
        animate(node, [{ transform: "none" }, { transform: `translate3d(0, ${h}px, 0)` }], 450),
        animate(
          main,
          [
            { transform: "scale(0.94)", borderRadius: "14px" },
            { transform: "none", borderRadius: "0px" },
          ],
          450,
        ),
        animate(mainDim, [{ opacity: SHEET_DIM }, { opacity: 0 }], 450),
      ],
      () => {
        main.style.transformOrigin = "";
        hideOver();
      },
    );
    return;
  }

  if (kind === "replace" && isSheetRoute(to)) {
    // Sheet to sheet (e.g. duplicate → edit): keep the presenter, swap content.
    if (presenter) {
      showUnder(presenter);
      under.setAttribute("data-presenting", "");
      underDim.style.opacity = String(SHEET_DIM);
    }
    if (!animated) crossfade(main);
    return;
  }

  hideUnder();
  if (!animated || kind === "tab" || kind === "replace") {
    // Tabs swap instantly like iOS; Safari tabs and reduced motion crossfade.
    if (!animated && kind !== "tab") crossfade(main);
    return;
  }

  if (kind === "push") {
    const node = showUnder(from);
    main.classList.add("ios-stack-front");
    run(
      [
        animate(main, [{ transform: `translate3d(${w}px, 0, 0)` }, { transform: "none" }]),
        ...(node
          ? [animate(node, [{ transform: "none" }, { transform: `translate3d(${-w * PARALLAX}px, 0, 0)` }])]
          : []),
        animate(underDim, [{ opacity: 0 }, { opacity: DIM }]),
      ],
      () => {
        main.classList.remove("ios-stack-front");
        hideUnder();
      },
    );
    return;
  }

  // Pop via back button or history: the real previous screen slides in from the left under the leaving one.
  const node = showOver(from);
  run(
    [
      animate(node, [{ transform: "none" }, { transform: `translate3d(${w}px, 0, 0)` }]),
      animate(main, [{ transform: `translate3d(${-w * PARALLAX}px, 0, 0)` }, { transform: "none" }]),
      animate(mainDim, [{ opacity: DIM }, { opacity: 0 }]),
    ],
    hideOver,
  );
}

// ---------- React glue ----------

/**
 * First child of <main>: freezes the screen as a snapshot when React removes it (layout cleanup runs while the
 * old DOM is still attached and still at its scroll position).
 */
export function StackProbe({ pathname }: { pathname: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const probe = ref.current;
    return () => {
      const main = probe?.closest("main");
      if (main && isPhone()) departed = capture(main, pathname);
    };
  }, [pathname]);
  return <span ref={ref} hidden />;
}

/** Runs the transition for every route change and installs the swipe-back gesture (phones only). */
export function useStackNavigation(pathname: string) {
  const router = useRouter();

  useLayoutEffect(() => {
    const from = departed;
    departed = null;
    onCommit(pathname, from);
  }, [pathname]);

  useEffect(() => {
    // A touch during a running transition settles it first, so the tap lands on the final layout.
    const settle = () => finishRunning();
    document.addEventListener("pointerdown", settle, true);

    const blocked = (target: EventTarget | null) => {
      const el = target as Element | null;
      if (!el?.closest) return true;
      if (
        el.closest(
          "input, textarea, select, [contenteditable=true], [data-no-swipe-back], .recharts-wrapper, [data-swipe-row], [role=dialog]",
        )
      )
        return true;
      for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
        const style = getComputedStyle(node);
        if ((style.overflowX === "auto" || style.overflowX === "scroll") && node.scrollWidth > node.clientWidth + 1)
          return true;
      }
      return false;
    };

    let start: { x: number; y: number } | null = null;
    let engaged = false;
    let decided = false;
    let underNode: HTMLElement | null = null;
    let samples: { x: number; t: number }[] = [];
    let width = 0;

    const enabled = () => {
      const path = window.location.pathname;
      return isPhone() && isStandalone() && !reducedMotion() && depthOf(path) > 0 && !isSheetRoute(path);
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !enabled()) return;
      const t = event.touches[0];
      width = window.innerWidth;
      if (t.clientX > width * 0.3 || blocked(event.target)) return;
      start = { x: t.clientX, y: t.clientY };
      engaged = false;
      decided = false;
      samples = [{ x: t.clientX, t: event.timeStamp }];
    };

    const apply = (dx: number) => {
      const main = getMain();
      const progress = Math.min(1, Math.max(0, dx / width));
      if (main) main.style.transform = `translate3d(${Math.max(0, dx)}px, 0, 0)`;
      if (underNode) underNode.style.transform = `translate3d(${-width * PARALLAX * (1 - progress)}px, 0, 0)`;
      getLayers().underDim.style.opacity = String(DIM * (1 - progress));
    };

    const onMove = (event: TouchEvent) => {
      if (!start) return;
      const t = event.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (!decided) {
        if (Math.hypot(dx, dy) < 10) return;
        decided = true;
        if (!(dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.2)) {
          start = null;
          return;
        }
        finishRunning();
        engaged = true;
        const path = window.location.pathname;
        const parent = parentOf(path);
        const list = stackOf(effectiveTab(path));
        const top = list[list.length - 1];
        underNode = showUnder(top && top.pathname === parent ? top : null);
        getMain()?.classList.add("ios-stack-front");
      }
      if (!engaged) return;
      event.preventDefault();
      samples.push({ x: t.clientX, t: event.timeStamp });
      if (samples.length > 6) samples.shift();
      apply(dx);
    };

    const onEnd = () => {
      if (!start || !engaged) {
        start = null;
        return;
      }
      const main = getMain();
      const last = samples[samples.length - 1];
      const first = samples[0];
      const velocity = last && first && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
      const dx = last.x - start.x;
      const progress = dx / width;
      start = null;
      engaged = false;
      if (!main) return;
      const complete = progress > 0.35 || velocity > 0.5;
      const remaining = complete ? 1 - progress : progress;
      const duration = Math.round(Math.min(380, Math.max(160, remaining * 420)));
      const { underDim } = getLayers();
      const node = underNode;
      underNode = null;
      if (complete) {
        main.style.transform = `translate3d(${width}px, 0, 0)`;
        if (node) node.style.transform = "none";
        underDim.style.opacity = "0";
        run(
          [
            animate(
              main,
              [{ transform: `translate3d(${dx}px, 0, 0)` }, { transform: `translate3d(${width}px, 0, 0)` }],
              duration,
            ),
            ...(node
              ? [
                  animate(
                    node,
                    [
                      { transform: `translate3d(${-width * PARALLAX * (1 - progress)}px, 0, 0)` },
                      { transform: "none" },
                    ],
                    duration,
                  ),
                ]
              : []),
          ],
          () => undefined,
        );
        swipeCompleted = true;
        const parent = parentOf(window.location.pathname) ?? "/";
        if (previousScreen() === parent) router.back();
        else router.push(parent);
        // Safety net: if the navigation never commits, bring the screen back.
        window.setTimeout(() => {
          if (!swipeCompleted) return;
          swipeCompleted = false;
          main.style.transform = "";
          main.classList.remove("ios-stack-front");
          hideUnder();
        }, 4000);
      } else {
        run(
          [
            animate(main, [{ transform: `translate3d(${dx}px, 0, 0)` }, { transform: "none" }], duration),
            ...(node
              ? [
                  animate(
                    node,
                    [
                      { transform: `translate3d(${-width * PARALLAX * (1 - progress)}px, 0, 0)` },
                      { transform: `translate3d(${-width * PARALLAX}px, 0, 0)` },
                    ],
                    duration,
                  ),
                ]
              : []),
            animate(underDim, [{ opacity: DIM * (1 - progress) }, { opacity: DIM }], duration),
          ],
          () => {
            main.style.transform = "";
            main.classList.remove("ios-stack-front");
            hideUnder();
          },
        );
        main.style.transform = "";
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("pointerdown", settle, true);
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);
}
