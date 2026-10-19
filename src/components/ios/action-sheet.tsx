"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertDialog as AlertPrimitive } from "radix-ui";

import { ActivityIndicator } from "@/components/ios/feedback";
import { haptic } from "@/lib/ios/haptics";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 460, damping: 38 } as const;

export type SheetAction = { label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean };

/**
 * iOS action sheet (section 5.2): a glass group of actions at the bottom (destructive ones in system red) and a
 * separate "Abbrechen" button. Used for destructive confirmations on phones.
 */
export function ActionSheet({
  open,
  onOpenChange,
  title,
  message,
  actions,
  cancelLabel = "Abbrechen",
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  message?: React.ReactNode;
  actions: SheetAction[];
  cancelLabel?: string;
  pending?: boolean;
}) {
  return (
    <AlertPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <AlertPrimitive.Portal forceMount>
            <AlertPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[60] bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => !pending && onOpenChange(false)}
              />
            </AlertPrimitive.Overlay>
            <AlertPrimitive.Content asChild forceMount onOpenAutoFocus={(e) => e.preventDefault()}>
              <motion.div
                className="ios-action-sheet"
                initial={{ y: "110%" }}
                animate={{ y: 0 }}
                exit={{ y: "110%" }}
                transition={SPRING}
              >
                <div className="glass ios-action-sheet__group">
                  {title || message ? (
                    <div className="ios-action-sheet__head">
                      {title ? (
                        <AlertPrimitive.Title className="text-[13px] font-semibold text-muted-foreground">
                          {title}
                        </AlertPrimitive.Title>
                      ) : (
                        <AlertPrimitive.Title className="sr-only">Aktion wählen</AlertPrimitive.Title>
                      )}
                      {message ? (
                        <AlertPrimitive.Description className="text-[13px] text-muted-foreground">
                          {message}
                        </AlertPrimitive.Description>
                      ) : (
                        <AlertPrimitive.Description className="sr-only">Aktion wählen</AlertPrimitive.Description>
                      )}
                    </div>
                  ) : (
                    <>
                      <AlertPrimitive.Title className="sr-only">Aktion wählen</AlertPrimitive.Title>
                      <AlertPrimitive.Description className="sr-only">Aktion wählen</AlertPrimitive.Description>
                    </>
                  )}
                  {actions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      disabled={action.disabled || pending}
                      onClick={() => {
                        if (action.destructive) haptic("warning");
                        action.onSelect();
                      }}
                      className={cn("ios-action-sheet__row", action.destructive && "text-loss")}
                    >
                      {pending && action.destructive ? <ActivityIndicator className="size-5" /> : action.label}
                    </button>
                  ))}
                </div>
                <AlertPrimitive.Cancel asChild>
                  <button type="button" disabled={pending} className="glass ios-action-sheet__cancel">
                    {cancelLabel}
                  </button>
                </AlertPrimitive.Cancel>
              </motion.div>
            </AlertPrimitive.Content>
          </AlertPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </AlertPrimitive.Root>
  );
}

/** iOS alert (section 5.2): centred glass card, headline title, footnote message, capsule buttons side by side. */
export function IosAlert({
  open,
  onOpenChange,
  title,
  message,
  children,
  cancelLabel = "Abbrechen",
  confirmLabel,
  destructive,
  confirmDisabled,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  message?: React.ReactNode;
  children?: React.ReactNode;
  cancelLabel?: string;
  confirmLabel: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <AlertPrimitive.Portal forceMount>
            <AlertPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[60] bg-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </AlertPrimitive.Overlay>
            <AlertPrimitive.Content asChild forceMount>
              <motion.div
                className="ios-alert"
                initial={{ opacity: 0, scale: 1.12, x: "-50%", y: "-50%" }}
                animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
                exit={{ opacity: 0, scale: 0.94, x: "-50%", y: "-50%" }}
                transition={SPRING}
              >
                <div className="glass ios-alert__card">
                  <div className="flex flex-col gap-1 px-5 pt-5 pb-4 text-center">
                    <AlertPrimitive.Title className="text-[17px] font-semibold">{title}</AlertPrimitive.Title>
                    <AlertPrimitive.Description
                      className={cn("text-[13px] text-muted-foreground", !message && "sr-only")}
                    >
                      {message ?? (typeof title === "string" ? title : "")}
                    </AlertPrimitive.Description>
                    {children ? <div className="pt-3 text-left">{children}</div> : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                    <AlertPrimitive.Cancel asChild>
                      <button type="button" disabled={pending} className="ios-alert__button">
                        {cancelLabel}
                      </button>
                    </AlertPrimitive.Cancel>
                    <button
                      type="button"
                      disabled={confirmDisabled || pending}
                      onClick={onConfirm}
                      className={cn(
                        "ios-alert__button ios-alert__button--primary",
                        destructive && "ios-alert__button--destructive",
                      )}
                    >
                      {pending ? <ActivityIndicator className="size-5" /> : confirmLabel}
                    </button>
                  </div>
                </div>
              </motion.div>
            </AlertPrimitive.Content>
          </AlertPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </AlertPrimitive.Root>
  );
}
