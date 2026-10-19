"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pulse.installHintDismissed";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * "Pulse als App installieren" for mobile browsers that are not running standalone (section 11.4).
 * A compact floating banner; the platform-specific instructions open in a sheet.
 */
export function InstallHint() {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

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
    setOpen(false);
    setPlatform(null);
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
    dismiss();
  };

  return (
    <>
      <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+80px)] z-30 flex items-center gap-2 rounded-full border border-border bg-surface-2/95 py-1.5 pr-1.5 pl-2 shadow-overlay backdrop-blur md:hidden">
        <Logo className="size-7" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-w-0 flex-1 truncate text-left text-[13px] font-medium"
        >
          Als App installieren
        </button>
        {platform === "android" && prompt ? (
          <Button size="xs" className="rounded-full" onClick={install}>
            Installieren
          </Button>
        ) : (
          <Button size="xs" variant="secondary" className="rounded-full" onClick={() => setOpen(true)}>
            Anleitung
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hinweis schliessen"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3"
        >
          <X className="size-4" />
        </button>
      </div>
      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Pulse als App installieren"
        description="Starte Pulse direkt vom Home-Bildschirm – ohne Browserleiste."
        footer={
          <>
            <Button variant="secondary" onClick={dismiss}>
              Nicht mehr anzeigen
            </Button>
            {platform === "android" && prompt ? (
              <Button onClick={install}>
                <Download /> Installieren
              </Button>
            ) : null}
          </>
        }
      >
        {platform === "ios" ? (
          <ol className="flex list-decimal flex-col gap-2 pb-1 pl-5 text-body">
            <li>
              Tippe in Safari unten auf <Share className="inline size-4 align-[-3px]" /> <strong>Teilen</strong>.
            </li>
            <li>
              Wähle <strong>Zum Home-Bildschirm</strong>.
            </li>
            <li>
              Bestätige mit <strong>Hinzufügen</strong>.
            </li>
          </ol>
        ) : (
          <ol className="flex list-decimal flex-col gap-2 pb-1 pl-5 text-body">
            <li>Öffne das Browser-Menü (⋮).</li>
            <li>
              Wähle <strong>App installieren</strong> bzw. <strong>Zum Startbildschirm hinzufügen</strong>.
            </li>
          </ol>
        )}
      </ResponsiveDialog>
    </>
  );
}
