import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Label + control + inline error / hint, used by every form. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
  action,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex min-h-[18px] items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {action}
      </div>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-small text-loss">
          {error}
        </p>
      ) : hint ? (
        <p className="text-small text-faint">{hint}</p>
      ) : null}
    </div>
  );
}
