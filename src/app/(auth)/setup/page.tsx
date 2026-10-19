import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SetupForm } from "@/components/auth/setup-form";
import { hasUsers } from "@/lib/auth/guard";
import { timeZoneOptions } from "@/lib/timezones";

export const metadata: Metadata = { title: "Einrichtung" };

export default function SetupPage() {
  if (hasUsers()) notFound();
  return <SetupForm timeZones={timeZoneOptions()} />;
}
