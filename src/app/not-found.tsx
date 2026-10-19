import { Compass } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <Compass className="size-10 text-faint" strokeWidth={1.5} aria-hidden="true" />
      <div className="flex max-w-sm flex-col gap-1">
        <h1 className="text-h2">Seite nicht gefunden</h1>
        <p className="text-body text-muted-foreground">Diese Seite gibt es nicht (mehr).</p>
      </div>
      <Button asChild>
        <Link href="/">Zur Übersicht</Link>
      </Button>
    </div>
  );
}
