"use client";

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { useMediaQuery } from "@/hooks/use-media-query";

/** Tablet/desktop: Sonner toasts. Phones: iOS glass capsule banners (ios.css `.ios-banner`), 3 s, swipe up. */
function Toaster(props: ToasterProps) {
  const phone = useMediaQuery("(max-width: 767px)");
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      offset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 8px)", left: "16px", right: "16px" }}
      icons={{
        success: <CircleCheckIcon className="size-4 text-profit" />,
        info: <InfoIcon className="size-4 text-accent" />,
        warning: <TriangleAlertIcon className="size-4 text-be" />,
        error: <OctagonXIcon className="size-4 text-loss" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={
        phone
          ? { duration: 3000, classNames: { toast: "ios-banner" } }
          : {
              classNames: {
                toast: "!rounded-[14px] !shadow-overlay !font-sans",
                actionButton: "!bg-accent !text-white !rounded-[8px] !font-medium",
              },
            }
      }
      style={
        {
          "--normal-bg": "var(--surface-2)",
          "--normal-text": "var(--text)",
          "--normal-border": "var(--border)",
          "--border-radius": "14px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
