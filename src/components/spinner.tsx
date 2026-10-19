import { Loader2 } from "lucide-react";

import { ActivityIndicator } from "@/components/ios/feedback";
import { cn } from "@/lib/utils";

/** Busy indicator: the iOS activity indicator on phones, the rotating circle on tablet and desktop. */
export function Spinner({ className }: { className?: string }) {
  return (
    <>
      <Loader2 aria-hidden="true" className={cn("animate-spin max-md:hidden", className)} />
      <ActivityIndicator className={cn("md:hidden", className)} />
    </>
  );
}
