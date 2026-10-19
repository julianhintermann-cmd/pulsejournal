"use client";

import { MotionConfig } from "motion/react";

import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster />
        <ServiceWorkerRegister />
      </TooltipProvider>
    </MotionConfig>
  );
}
