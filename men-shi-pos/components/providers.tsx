"use client";

import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";
import { StoreProvider } from "@/lib/store";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <AppShell>{children}</AppShell>
      <Toaster position="top-center" richColors />
    </StoreProvider>
  );
}
