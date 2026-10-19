"use client";

import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { Check, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { ActionSheet } from "@/components/ios/action-sheet";
import { GlassButton } from "@/components/ios/glass";
import { useKeyboardInset } from "@/hooks/ios/use-keyboard-inset";
import { haptic } from "@/lib/ios/haptics";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 420, damping: 40, mass: 1 } as const;

export type SheetConfirm = { label: string; onConfirm: () => void; disabled?: boolean; pending?: boolean };

export type IosSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  hideHeader?: boolean;
  /** ✓ in the header (prominent glass circle). */
  confirm?: SheetConfirm;
  /** Asks "Änderungen verwerfen?" before closing by swipe or ✕. */
  dirty?: boolean;
  /** Open directly at the large detent (forms with a lot of content). */
  initialDetent?: "medium" | "large";
};

/** Detent heights: the natural content height, capped at ~50 % (medium) and ~92 % (large) of the free height. */
function computeDetents(available: number, content: number) {
  const large = Math.max(200, Math.min(Math.round(available * 0.92), available - 16));
  const medium = Math.round(available * 0.5);
  const fit = Math.min(content, large);
  if (fit <= medium + 24) return { top: fit, stops: [fit] };
  return { top: fit, stops: [medium, fit] };
}

/**
 * iOS 26 sheet (section 5.1) used for every dialog on phones. Detents: the content height up to ~50 % ("medium",
 * floating glass, 8 px inset, 36 px radius) and up to ~92 % ("large", attached, solid, the screen behind scales to
 * 0.94). Drag on the grabber/header – or on the content when it is scrolled to the top – moves between detents with
 * velocity-aware snapping and rubber-banding; dragging down past the lowest detent dismisses.
 */
export function IosSheet(props: IosSheetProps) {
  const { open, onOpenChange, dirty } = props;
  const [askDiscard, setAskDiscard] = useState(false);
  const requestClose = useCallback(() => {
    if (dirty) setAskDiscard(true);
    else onOpenChange(false);
  }, [dirty, onOpenChange]);

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <AnimatePresence>{open ? <SheetPanel {...props} requestClose={requestClose} /> : null}</AnimatePresence>
      </DialogPrimitive.Root>
      <ActionSheet
        open={askDiscard}
        onOpenChange={setAskDiscard}
        title="Änderungen verwerfen?"
        actions={[
          {
            label: "Änderungen verwerfen",
            destructive: true,
            onSelect: () => {
              setAskDiscard(false);
              onOpenChange(false);
            },
          },
        ]}
        cancelLabel="Weiter bearbeiten"
      />
    </>
  );
}

function SheetPanel({
  title,
  description,
  children,
  footer,
  hideHeader,
  confirm,
  initialDetent = "medium",
  requestClose,
}: IosSheetProps & { requestClose: () => void }) {
  const grabRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const keyboard = useKeyboardInset();
  const [viewport, setViewport] = useState(0);
  const [natural, setNatural] = useState(0);
  const [detent, setDetent] = useState<number | null>(null);
  // The Radix portal mounts its children one render later, so measuring starts once the card exists.
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const y = useMotionValue(1200);

  const { top, stops } = computeDetents((viewport || 800) - keyboard, natural || 320);
  const current = detent ?? (initialDetent === "large" ? stops.length - 1 : 0);
  const index = Math.min(current, stops.length - 1);
  const isLarge = stops.length > 1 && index === stops.length - 1;
  const offsetFor = useCallback((i: number) => top - stops[Math.max(0, Math.min(i, stops.length - 1))], [top, stops]);

  // Measure the free viewport height and the natural height of header + content + footer.
  useLayoutEffect(() => {
    if (!card) return;
    const measure = () => {
      setViewport(window.innerHeight);
      setNatural(
        (grabRef.current?.offsetHeight ?? 0) +
          (contentRef.current?.offsetHeight ?? 0) +
          (footerRef.current?.offsetHeight ?? 0),
      );
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    for (const el of [grabRef.current, contentRef.current, footerRef.current]) if (el) ro.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [card]);

  // Spring to the current detent whenever it or the size changes (also the entrance).
  const measured = viewport > 0 && natural > 0;
  useEffect(() => {
    if (!measured) return;
    const controls = animate(y, offsetFor(index), SPRING);
    return () => controls.stop();
  }, [measured, index, offsetFor, y]);

  // Card-stack effect behind a large sheet; tab bar and nav bar step back.
  useEffect(() => {
    const html = document.documentElement;
    if (!isLarge) return;
    html.style.setProperty("--sheet-origin", `${window.scrollY + window.innerHeight / 2}px`);
    html.setAttribute("data-dialog-large", "");
    return () => {
      // Keep the transition while the screen behind scales back up.
      html.setAttribute("data-dialog-closing", "");
      html.removeAttribute("data-dialog-large");
      window.setTimeout(() => html.removeAttribute("data-dialog-closing"), 500);
    };
  }, [isLarge]);

  // ---------- Drag (grabber/header always; content only at its top or while the sheet can still grow) ----------
  const drag = useRef<{
    startY: number;
    startOffset: number;
    samples: { y: number; t: number }[];
    fromContent: boolean;
    active: boolean;
  } | null>(null);

  const begin = (event: React.PointerEvent, fromContent: boolean) => {
    if (event.button !== 0) return;
    if (!fromContent) (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    drag.current = {
      startY: event.clientY,
      startOffset: y.get(),
      samples: [{ y: event.clientY, t: event.timeStamp }],
      fromContent,
      active: !fromContent,
    };
  };

  const move = (event: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dy = event.clientY - d.startY;
    if (!d.active) {
      if (Math.abs(dy) < 6) return;
      const scroller = scrollRef.current;
      const atTop = !scroller || scroller.scrollTop <= 0;
      const canGrow = index < stops.length - 1 && dy < 0;
      if (!(atTop && dy > 0) && !canGrow) {
        drag.current = null;
        return;
      }
      d.active = true;
      d.startY = event.clientY;
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      return;
    }
    let next = d.startOffset + (event.clientY - d.startY);
    if (next < 0) next = -Math.pow(-next, 0.7); // rubber band above the top detent
    y.set(next);
    d.samples.push({ y: event.clientY, t: event.timeStamp });
    if (d.samples.length > 6) d.samples.shift();
  };

  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const velocity = last && first && last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0; // px/ms
    const projected = y.get() + velocity * 180;
    if (projected > offsetFor(0) + Math.min(140, stops[0] * 0.3) || velocity > 1.1) {
      haptic("light");
      animate(y, offsetFor(index), SPRING);
      requestClose();
      return;
    }
    let best = 0;
    for (let i = 0; i < stops.length; i++) {
      if (Math.abs(offsetFor(i) - projected) < Math.abs(offsetFor(best) - projected)) best = i;
    }
    if (best !== index) haptic("selection");
    setDetent(best);
    animate(y, offsetFor(best), SPRING);
  };

  const floating = !isLarge;

  return (
    <DialogPrimitive.Portal forceMount>
      <DialogPrimitive.Overlay asChild forceMount>
        <motion.div
          className="fixed inset-0 z-50 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: isLarge ? 0.4 : 0.22 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        />
      </DialogPrimitive.Overlay>
      <DialogPrimitive.Content
        asChild
        forceMount
        aria-describedby={description ? undefined : undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          e.preventDefault();
          requestClose();
        }}
      >
        <motion.div
          className={cn("ios-sheet", floating ? "ios-sheet--floating" : "ios-sheet--attached")}
          style={{ y, height: top, bottom: keyboard }}
          exit={{ y: top + 60, transition: { type: "spring", stiffness: 380, damping: 40 } }}
        >
          <div ref={setCard} className={cn("ios-sheet__card", floating && "glass")}>
            <div
              ref={grabRef}
              className="ios-sheet__grab touch-none"
              onPointerDown={(e) => begin(e, false)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            >
              <div aria-hidden="true" className="ios-sheet__grabber" />
              <div className={cn("ios-sheet__header", hideHeader && "sr-only")}>
                <GlassButton
                  variant={floating ? "clear" : "regular"}
                  aria-label="Schliessen"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={requestClose}
                >
                  <X className="!size-[20px]" strokeWidth={2.4} />
                </GlassButton>
                <div className="min-w-0 text-center">
                  <DialogPrimitive.Title className="truncate text-[17px] font-semibold">{title}</DialogPrimitive.Title>
                  {description ? (
                    <DialogPrimitive.Description className="line-clamp-2 text-[13px] text-muted-foreground">
                      {description}
                    </DialogPrimitive.Description>
                  ) : (
                    <DialogPrimitive.Description className="sr-only">
                      {typeof title === "string" ? title : ""}
                    </DialogPrimitive.Description>
                  )}
                </div>
                {confirm ? (
                  <GlassButton
                    variant="prominent"
                    aria-label={confirm.label}
                    disabled={confirm.disabled || confirm.pending}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={confirm.onConfirm}
                  >
                    <Check className="!size-[22px]" strokeWidth={2.6} />
                  </GlassButton>
                ) : (
                  <span className="w-11" aria-hidden="true" />
                )}
              </div>
            </div>
            <div
              ref={scrollRef}
              className={cn("ios-sheet__body", !isLarge && stops.length > 1 ? "overflow-hidden" : "overflow-y-auto")}
              onPointerDown={(e) => begin(e, true)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            >
              <div ref={contentRef} className="ios-sheet__content">
                {children}
              </div>
            </div>
            {/* With ✓ in the header the footer would repeat the same action. */}
            <div ref={footerRef} className={footer && !confirm ? "ios-sheet__footer" : "ios-sheet__spacer"}>
              {confirm ? null : footer}
            </div>
          </div>
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
