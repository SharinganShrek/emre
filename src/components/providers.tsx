"use client";

import { HubProvider } from "@/lib/store";
import { ThemeProvider } from "@/components/layout/theme";
import { AppShell } from "@/components/layout/app-shell";
import { QuickAddProvider } from "@/components/quick-add";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <HubProvider>
        <QuickAddProvider>
          <AppShell>{children}</AppShell>
        </QuickAddProvider>
      </HubProvider>
    </ThemeProvider>
  );
}
