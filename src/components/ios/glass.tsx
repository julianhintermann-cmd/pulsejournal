"use client";

import { Slot } from "radix-ui";
import { forwardRef, useCallback, useRef } from "react";

import { cn } from "@/lib/utils";

export type GlassVariant = "regular" | "clear" | "prominent";
export type GlassShape = "capsule" | "circle" | "rounded";

/**
 * Pointer handling shared by interactive glass: touch-down scales the element up with a spring and moves the
 * specular sheen under the finger; release springs back. Updates CSS variables directly (no React re-render).
 */
export function useGlassPress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const move = useCallback((event: React.PointerEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--lx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--ly", `${event.clientY - rect.top}px`);
  }, []);
  const handlers = {
    onPointerDown: (event: React.PointerEvent<T>) => {
      move(event);
      ref.current?.setAttribute("data-pressed", "");
    },
    onPointerMove: (event: React.PointerEvent<T>) => {
      if (ref.current?.hasAttribute("data-pressed")) move(event);
    },
    onPointerUp: () => ref.current?.removeAttribute("data-pressed"),
    onPointerCancel: () => ref.current?.removeAttribute("data-pressed"),
    onPointerLeave: () => ref.current?.removeAttribute("data-pressed"),
  };
  return { ref, handlers };
}

type PressHandlers<T> = ReturnType<typeof useGlassPress<T & HTMLElement>>["handlers"];

/** Runs the press handlers and any handler of the same name passed by the caller. */
function composeHandlers<T extends HTMLElement>(press: PressHandlers<T>, props: Record<string, unknown>) {
  const out: Record<string, (event: React.PointerEvent<T>) => void> = {};
  for (const [name, own] of Object.entries(press) as [keyof PressHandlers<T>, (e: React.PointerEvent<T>) => void][]) {
    const theirs = props[name] as ((e: React.PointerEvent<T>) => void) | undefined;
    out[name] = (event) => {
      own(event);
      theirs?.(event);
    };
  }
  return out;
}

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (value: T | null) => {
    for (const r of refs) {
      if (typeof r === "function") r(value);
      else if (r) (r as React.RefObject<T | null>).current = value;
    }
  };
}

type GlassSurfaceProps = React.HTMLAttributes<HTMLElement> & {
  variant?: GlassVariant;
  shape?: GlassShape;
  /** Enables the press interaction (scale + sheen). */
  interactive?: boolean;
  /** Render the child element as the glass surface (e.g. a Link or button). */
  asChild?: boolean;
};

/**
 * The only place glass is made (section 3.3). Use it for bars, bar buttons, tab bar, floating buttons, menus,
 * floating sheets and banners – never for content.
 */
export const GlassSurface = forwardRef<HTMLElement, GlassSurfaceProps>(function GlassSurface(
  { variant = "regular", shape = "rounded", interactive, asChild, className, ...props },
  forwarded,
) {
  const press = useGlassPress<HTMLElement>();
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      ref={mergeRefs(forwarded, press.ref)}
      data-glass=""
      className={cn(
        "glass",
        variant === "clear" && "glass--clear",
        variant === "prominent" && "glass--prominent",
        shape === "capsule" && "glass--capsule",
        shape === "circle" && "glass--circle",
        className,
      )}
      {...props}
      {...(interactive ? composeHandlers(press.handlers, props) : {})}
    />
  );
});

type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: GlassVariant;
  shape?: "circle" | "capsule";
  /** Accessible name; required for icon-only circles. */
  "aria-label"?: string;
  asChild?: boolean;
};

/** 44 px glass circle (icon) or capsule (icon + text) bar button. */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { variant = "regular", shape = "circle", asChild, className, children, ...props },
  forwarded,
) {
  const press = useGlassPress<HTMLButtonElement>();
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={mergeRefs(forwarded, press.ref)}
      type={asChild ? undefined : (props.type ?? "button")}
      data-glass=""
      className={cn(
        "glass inline-flex h-11 shrink-0 items-center justify-center gap-1.5 outline-none disabled:opacity-40",
        "focus-visible:ring-2 focus-visible:ring-accent [&_svg]:pointer-events-none [&_svg]:shrink-0",
        shape === "circle" ? "glass--circle w-11 [&_svg]:size-[22px]" : "glass--capsule px-4 [&_svg]:size-5",
        variant === "clear" && "glass--clear",
        variant === "prominent" && "glass--prominent",
        className,
      )}
      {...props}
      {...composeHandlers(press.handlers, props)}
    >
      {children}
    </Comp>
  );
});
