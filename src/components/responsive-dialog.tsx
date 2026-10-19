"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import type { ResponsiveDialogProps } from "@/components/responsive-dialog-impl";

// The animated implementation (motion) is only downloaded when a dialog is opened for the first time.
const Impl = dynamic(() => import("@/components/responsive-dialog-impl"), { ssr: false });

/** Centered dialog on desktop, bottom sheet with drag-to-close on mobile (section 9.5). */
export function ResponsiveDialog(props: ResponsiveDialogProps) {
  const [mounted, setMounted] = useState(props.open);
  if (props.open && !mounted) setMounted(true);
  return mounted ? <Impl {...props} /> : null;
}
