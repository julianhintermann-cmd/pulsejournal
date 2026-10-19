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
      {/* iOS card above the floating tab bar (solid: glass is reserved for the bars themselves). */}
      <div className="fixed inset-x-[var(--ios-margin)] bottom-[calc(max(var(--sab)-8px,12px)+74px)] z-30 flex items-center gap-2.5 rounded-[22px] bg-[var(--ios-cell)] py-2 pr-2 pl-2.5 shadow-overlay md:hidden">
        <Logo className="size-9 rounded-[9px]" />
        <button type="button" onClick={() => setOpen(true)} className="flex min-w-0 flex-1 flex-col text-left">
          <span className="truncate text-[15px] font-semibold">Als App installieren</span>
          <span className="flex items-center gap-1 truncate text-[13px] text-muted-foreground">
            {platform === "ios" ? (
              <>
                Über <Share className="size-3.5 shrink-0" aria-label="Teilen" /> zum Home-Bildschirm
              </>
            ) : (
              "Direkt vom Startbildschirm öffnen"
            )}
          </span>
        </button>
        {platform === "android" && prompt ? (
          <Button size="sm" className="rounded-full" onClick={install}>
            Installieren
          </Button>
        ) : (
          <Button size="sm" variant="secondary" className="rounded-full" onClick={() => setOpen(true)}>
            Anleitung
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hinweis schliessen"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-3"
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
