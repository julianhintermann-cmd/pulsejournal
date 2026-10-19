import { ChevronRight, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MORE_ITEMS } from "@/components/nav-items";
import { logout } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Mehr" };

export default function MorePage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <nav className="card overflow-hidden" aria-label="Weitere Seiten">
        <ul className="divide-y divide-border">
          {MORE_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex h-14 items-center gap-3 px-4 text-[15px] font-medium transition-colors active:bg-surface-2"
              >
                <span className="flex size-8 items-center justify-center rounded-[9px] bg-surface-2">
                  <item.icon className="size-[18px] text-muted-foreground" />
                </span>
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="size-4 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action={logout} className="card overflow-hidden">
        <button
          type="submit"
          className="flex h-14 w-full items-center gap-3 px-4 text-[15px] font-medium text-loss transition-colors active:bg-surface-2"
        >
          <span className="flex size-8 items-center justify-center rounded-[9px] bg-loss-soft">
            <LogOut className="size-[18px]" />
          </span>
          Abmelden
        </button>
      </form>
    </div>
  );
}
