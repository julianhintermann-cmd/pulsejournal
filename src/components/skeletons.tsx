import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`card p-4 md:p-5 ${className ?? ""}`}>{children}</div>;
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-3 md:gap-4" aria-busy="true" aria-label="Wird geladen">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} className="flex min-h-[132px] flex-col gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </CardSkeleton>
        ))}
      </div>
      <CardSkeleton>
        <Skeleton className="mb-4 h-4 w-28" />
        <Skeleton className="h-[260px] w-full" />
      </CardSkeleton>
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
        <CardSkeleton className="lg:col-span-2">
          <Skeleton className="mb-4 h-4 w-24" />
          <Skeleton className="h-[200px] w-full" />
        </CardSkeleton>
        <CardSkeleton>
          <Skeleton className="mb-4 h-4 w-24" />
          <Skeleton className="aspect-square w-full" />
        </CardSkeleton>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 md:gap-4" aria-busy="true" aria-label="Wird geladen">
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1 md:h-10 md:max-w-sm" />
        <Skeleton className="h-11 w-24 md:h-10" />
      </div>
      <div className="card divide-y divide-border">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="flex flex-col gap-4 md:gap-6" aria-busy="true" aria-label="Wird geladen">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, i) => (
          <CardSkeleton key={i} className="flex flex-col gap-4">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <Skeleton className="h-10 w-full" />
          </CardSkeleton>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3 md:gap-4" aria-busy="true" aria-label="Wird geladen">
      {Array.from({ length: 3 }, (_, i) => (
        <CardSkeleton key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </CardSkeleton>
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="card flex flex-col gap-4 p-3 md:p-5" aria-busy="true" aria-label="Wird geladen">
      <Skeleton className="mx-auto h-6 w-40" />
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="min-h-[64px] md:min-h-[96px]" />
        ))}
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Wird geladen">
      <Skeleton className="h-10 w-full max-w-xl" />
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-[1fr_1.6fr]">
        <CardSkeleton className="flex flex-col gap-3">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardSkeleton>
        <CardSkeleton>
          <Skeleton className="h-[320px] w-full" />
        </CardSkeleton>
      </div>
    </div>
  );
}

/** Skeleton matching the layout of the route that is being navigated to. */
export function RouteSkeleton({ pathname }: { pathname: string }) {
  if (pathname === "/") return <DashboardSkeleton />;
  if (pathname === "/trades" || pathname === "/journal") return <ListSkeleton />;
  if (pathname === "/calendar") return <CalendarSkeleton />;
  if (pathname === "/stats") return <StatsSkeleton />;
  if (pathname === "/playbooks" || pathname === "/accounts") return <GridSkeleton />;
  return <PageSkeleton />;
}
