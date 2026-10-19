import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 pt-[calc(env(safe-area-inset-top)+32px)] pb-[calc(env(safe-area-inset-bottom)+32px)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-48 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative w-full max-w-[440px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <Logo className="size-10" />
          <span className="text-h2">Pulse Journal</span>
        </div>
        {children}
      </div>
    </main>
  );
}
