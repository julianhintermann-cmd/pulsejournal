"use client";

import { CheckmarkHudHost } from "@/components/ios/feedback";
import { IosRuntime } from "@/components/ios/ios-runtime";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      {children}
      <Toaster />
      <ServiceWorkerRegister />
      <IosRuntime />
      <CheckmarkHudHost />
    </TooltipProvider>
  );
}
