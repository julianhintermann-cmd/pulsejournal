"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pulse.installHintDismissed";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Pulse als App installieren" card for mobile browsers that are not running standalone (section 11.4). */
export function InstallHint() {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
    if (dismissed || standalone || !mobile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- platform detection needs the browser environment
    setPlatform(/iPhone|iPad|iPod/i.test(ua) ? "ios" : "android");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!platform) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore unavailable storage
    }
    setPlatform(null);
  };

  return (
    <div className="card relative flex items-start gap-3 p-4">
      <Logo className="size-10" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 pr-6">
        <p className="text-h3">Pulse als App installieren</p>
        {platform === "ios" ? (
          <p className="text-small text-muted-foreground">
            Tippe unten auf <Share className="inline size-3.5 align-[-2px]" /> <strong>Teilen</strong> und dann auf{" "}
            <strong>Zum Home-Bildschirm</strong>.
          </p>
        ) : prompt ? (
          <>
            <p className="text-small text-muted-foreground">
              Starte Pulse direkt vom Home-Bildschirm – ohne Browserleiste.
            </p>
            <Button
              size="sm"
              className="mt-2 w-fit"
              onClick={async () => {
                await prompt.prompt();
                await prompt.userChoice;
                setPrompt(null);
                dismiss();
              }}
            >
              <Download /> Installieren
            </Button>
          </>
        ) : (
          <p className="text-small text-muted-foreground">
            Öffne das Browser-Menü (⋮) und wähle <strong>App installieren</strong> bzw.{" "}
            <strong>Zum Startbildschirm hinzufügen</strong>.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hinweis schliessen"
        className="absolute top-3 right-3 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-2"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
