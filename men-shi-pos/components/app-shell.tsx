"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { OpenFullPageButton } from "@/components/open-full-page-button";
import { cn } from "@/lib/utils";
import { todayLabel } from "@/lib/format";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/", label: "收銀" },
  { href: "/purchases", label: "進貨" },
  { href: "/stocktake", label: "盤點" },
  { href: "/sales", label: "銷貨" },
  { href: "/expenses", label: "支出" },
  { href: "/products", label: "總商品" },
  { href: "/report", label: "總表" },
  { href: "/shop", label: "備份門市資料" },
] as const;

function subscribeClock(onStoreChange: () => void) {
  const id = window.setInterval(onStoreChange, 1000);
  return () => window.clearInterval(id);
}

function getClock() {
  return new Date().toLocaleTimeString("zh-TW", { hour12: false });
}

function Clock() {
  const time = useSyncExternalStore(subscribeClock, getClock, () => "--:--:--");
  return <span className="tabular-nums">{time}</span>;
}

function TodayStamp() {
  const label = useSyncExternalStore(subscribeClock, todayLabel, () => "");
  if (!label) return null;
  return <span className="hidden sm:inline">{label}</span>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { storeId, storeName, branches, switchStore } = useStore();

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-sidebar text-sidebar-foreground">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-2 py-0.5">
          <span className="shrink-0 text-[11px] text-sidebar-foreground/70">
            總部
          </span>
          <div className="flex min-w-0 flex-wrap gap-0.5">
            {branches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => switchStore(branch.id)}
                className={cn(
                  "inline-flex h-6 items-center rounded px-1.5 text-xs",
                  storeId === branch.id
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                )}
              >
                {branch.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-2 pb-0.5">
          <Link href="/shop" className="shrink-0 text-xs font-semibold">
            {storeName}
          </Link>
          <nav className="flex min-w-0 flex-1 flex-wrap gap-0.5">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-6 items-center rounded px-1.5 text-xs transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/70">
            <OpenFullPageButton />
            <TodayStamp />
            <Clock />
          </div>
        </div>
      </header>
      <main key={storeId} className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
