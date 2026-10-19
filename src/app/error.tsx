"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlert className="size-10 text-faint" strokeWidth={1.5} aria-hidden="true" />
      <div className="flex max-w-sm flex-col gap-1">
        <h1 className="text-h2">Da ist etwas schiefgelaufen.</h1>
        <p className="text-body text-muted-foreground">
          Die Seite konnte nicht geladen werden. Deine Daten sind sicher – versuche es noch einmal.
        </p>
        {error.digest ? <p className="text-small text-muted-foreground">Fehler-ID: {error.digest}</p> : null}
      </div>
      <Button
        onClick={() => {
          reset();
          window.location.reload();
        }}
      >
        <RotateCw /> Neu laden
      </Button>
    </div>
  );
}
