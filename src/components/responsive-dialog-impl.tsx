"use client";

import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { IosSheet, type SheetConfirm } from "@/components/ios/sheet";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

const EASE = [0.2, 0.8, 0.2, 1] as const;

export type ResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Extra classes for the desktop dialog panel (e.g. a wider max-width). */
  className?: string;
  /** Hide the visible header (title stays available to screen readers). */
  hideHeader?: boolean;
  /** Phones: ✓ in the sheet header. */
  confirm?: SheetConfirm;
  /** Phones: ask before discarding changes when the sheet is swiped away. */
  dirty?: boolean;
  /** Phones: start at the large detent. */
  detent?: "medium" | "large";
};

/** Centered dialog on tablet/desktop, iOS sheet with detents on phones. */
export default function ResponsiveDialogImpl({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  hideHeader,
  confirm,
  dirty,
  detent,
}: ResponsiveDialogProps) {
  const isDesktop = useIsDesktop();

  // Phones: iOS sheet with detents, glass and drag-to-dismiss (src/components/ios/sheet.tsx).
  if (!isDesktop) {
    return (
      <MotionConfig reducedMotion="user">
        <IosSheet
          open={open}
          onOpenChange={onOpenChange}
          title={title}
          description={description}
          footer={footer}
          hideHeader={hideHeader}
          confirm={confirm}
          dirty={dirty}
          initialDetent={detent}
        >
          {children}
        </IosSheet>
      </MotionConfig>
    );
  }

  const header = (
    <div className={cn("flex flex-col gap-1", hideHeader && "sr-only")}>
      <DialogPrimitive.Title className="pr-10 text-h2">{title}</DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="text-body text-muted-foreground">
          {description}
        </DialogPrimitive.Description>
      ) : (
        <DialogPrimitive.Description className="sr-only">
          {typeof title === "string" ? title : ""}
        </DialogPrimitive.Description>
      )}
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <AnimatePresence>
          {open ? (
            <DialogPrimitive.Portal forceMount>
              <DialogPrimitive.Overlay asChild forceMount>
                <motion.div
                  className="fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-[2px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: EASE }}
                />
              </DialogPrimitive.Overlay>
              <DialogPrimitive.Content asChild forceMount>
                <motion.div
                  className={cn(
                    "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-lg flex-col gap-5 overflow-hidden rounded-sheet border border-border bg-surface p-6 shadow-overlay outline-none",
                    className,
                  )}
                  style={{ x: "-50%", y: "-50%" }}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: EASE }}
                >
                  {header}
                  <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">{children}</div>
                  {footer ? (
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
                  ) : null}
                  <DialogPrimitive.Close className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-[8px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
                    <XIcon className="size-4" />
                    <span className="sr-only">Schliessen</span>
                  </DialogPrimitive.Close>
                </motion.div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          ) : null}
        </AnimatePresence>
      </DialogPrimitive.Root>
    </MotionConfig>
  );
}
