"use client";

import { useEffect, useState } from "react";

import { formatDateTime, formatRelative } from "@/lib/format";

/** "vor 2 Std." – rendered against the server time first, then refreshed on the client every minute. */
export function RelativeTime({ ts, timeZone }: { ts: number; timeZone: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the current time is only known on the client
    setNow(Date.now());
    const handle = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(handle);
  }, []);
  return (
    <time dateTime={new Date(ts).toISOString()} title={formatDateTime(ts, timeZone)} suppressHydrationWarning>
      {now == null ? formatDateTime(ts, timeZone) : formatRelative(ts, now, timeZone)}
    </time>
  );
}
