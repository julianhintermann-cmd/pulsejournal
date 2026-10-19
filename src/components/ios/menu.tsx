"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { haptic } from "@/lib/ios/haptics";
import { cn } from "@/lib/utils";

export type MenuItem = {
  label: string;
  icon?: LucideIcon;
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};
export type MenuSection = { items: MenuItem[] };

const SPRING = { type: "spring", stiffness: 520, damping: 36 } as const;
const MENU_WIDTH = 250;

type Placement = { top: number; left: number; originX: number; originY: number; above: boolean };

/** Positions a menu next to an anchor rect inside the viewport (prefers below, flips above). */
function place(anchor: DOMRect, height: number, align: "start" | "end"): Placement {
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(
    Math.max(margin, align === "end" ? anchor.right - MENU_WIDTH : anchor.left),
    vw - MENU_WIDTH - margin,
  );
  const below = anchor.bottom + 8;
  const above = anchor.top - 8 - height;
  const fitsBelow = below + height <= vh - margin;
  const top = fitsBelow || above < margin ? Math.min(below, vh - margin - height) : above;
  return {
    top,
    left,
    originX: anchor.left + anchor.width / 2 - left,
    originY: fitsBelow || above < margin ? anchor.top + anchor.height / 2 - top : anchor.top + anchor.height / 2 - top,
    above: !(fitsBelow || above < margin),
  };
}

function MenuPanel({
  sections,
  anchor,
  align,
  onClose,
  label,
}: {
  sections: MenuSection[];
  anchor: DOMRect;
  align: "start" | "end";
  onClose: () => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 200;
    setPlacement(place(anchor, height, align));
  }, [anchor, align]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("[role^=menuitem]:not([disabled])")?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[70]" onPointerDown={onClose} aria-hidden="true" />
      <motion.div
        ref={ref}
        role="menu"
        aria-label={label}
        className="glass ios-menu"
        style={{
          top: placement?.top ?? -9999,
          left: placement?.left ?? 0,
          width: MENU_WIDTH,
          transformOrigin: placement ? `${placement.originX}px ${placement.originY}px` : "50% 0",
        }}
        initial={{ opacity: 0, scale: 0.35 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.35, transition: { duration: 0.18 } }}
        transition={SPRING}
      >
        {sections.map((section, s) => (
          <div key={s} className={cn("flex flex-col", s > 0 && "ios-menu__section")}>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  role={item.checked == null ? "menuitem" : "menuitemradio"}
                  aria-checked={item.checked ?? undefined}
                  disabled={item.disabled}
                  onClick={() => {
                    haptic("selection");
                    onClose();
                    item.onSelect();
                  }}
                  className={cn("ios-menu__item", item.destructive && "text-loss")}
                >
                  <span className="flex w-5 shrink-0 justify-center">
                    {item.checked ? <Check className="size-[18px]" strokeWidth={2.6} /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                  {Icon ? <Icon className="size-5 shrink-0" strokeWidth={1.9} /> : null}
                </button>
              );
            })}
          </div>
        ))}
      </motion.div>
    </>
  );
}

/**
 * Glass popover menu that morphs out of the button that opened it (section 5.3): leading checkmarks for the
 * selected value, trailing icons, destructive rows in red, separated sections.
 */
export function GlassMenu({
  sections,
  align = "end",
  label,
  children,
}: {
  sections: MenuSection[];
  align?: "start" | "end";
  label: string;
  /** Renders the trigger; spread the props onto a button. */
  children: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
  }) => React.ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  return (
    <>
      {children({
        ref: triggerRef,
        onClick: () => {
          haptic("selection");
          setAnchor(triggerRef.current?.getBoundingClientRect() ?? null);
        },
        "aria-haspopup": "menu",
        "aria-expanded": anchor != null,
      })}
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {anchor ? (
                <MenuPanel sections={sections} anchor={anchor} align={align} onClose={close} label={label} />
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}

// ---------- Long-press context menu (section 5.3) ----------

/** Long press (default 450 ms) that cancels when the finger moves more than 8 px; swallows the click after it. */
export function useLongPress(onLongPress: (target: HTMLElement) => void, delay = 450) {
  const timer = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    start.current = null;
  };

  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      fired.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      const target = event.currentTarget;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        fired.current = true;
        start.current = null;
        onLongPress(target);
      }, delay);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      const s = start.current;
      if (s && Math.hypot(event.clientX - s.x, event.clientY - s.y) > 8) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    onClickCapture: (event: React.MouseEvent) => {
      if (fired.current) {
        event.preventDefault();
        event.stopPropagation();
        fired.current = false;
      }
    },
  };
}

/**
 * Long-press context menu: the item lifts (scale 1.02, shadow) above a blurred, dimmed background and a glass menu
 * appears next to it. The lifted item is a static copy, so the list underneath never re-renders.
 */
export function ContextMenu({
  sections,
  label,
  children,
  className,
}: {
  sections: MenuSection[];
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, setState] = useState<{ rect: DOMRect; html: string } | null>(null);
  const longPress = useLongPress((target) => {
    haptic("medium");
    setState({ rect: target.getBoundingClientRect(), html: target.innerHTML });
  });
  const close = useCallback(() => setState(null), []);

  return (
    <>
      <div className={cn("ios-context-target", className)} {...longPress}>
        {children}
      </div>
      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {state ? (
                <motion.div
                  key="ctx"
                  className="ios-context"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="ios-context__backdrop" onPointerDown={close} aria-hidden="true" />
                  <motion.div
                    aria-hidden="true"
                    className="ios-context__lifted"
                    style={{
                      top: state.rect.top,
                      left: state.rect.left,
                      width: state.rect.width,
                      height: state.rect.height,
                    }}
                    initial={{ scale: 1 }}
                    animate={{ scale: 1.02 }}
                    exit={{ scale: 1 }}
                    transition={SPRING}
                    // A static copy of the row (no React tree, no handlers).
                    dangerouslySetInnerHTML={{ __html: state.html }}
                  />
                  <MenuPanel sections={sections} anchor={state.rect} align="start" onClose={close} label={label} />
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
