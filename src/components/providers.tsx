"use client";

import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import { HubProvider } from "@/lib/store";
import { ThemeProvider } from "@/components/layout/theme";
import { AppShell } from "@/components/layout/app-shell";
import { QuickAddProvider } from "@/components/quick-add";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname === "/unlock";

  return (
    <ThemeProvider>
      <Toaster
        theme="dark"
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "border border-border bg-surface text-foreground",
          },
        }}
      />
      {bare ? (
        children
      ) : (
        <HubProvider>
          <QuickAddProvider>
            <AppShell>{children}</AppShell>
          </QuickAddProvider>
        </HubProvider>
      )}
    </ThemeProvider>
  );
}
