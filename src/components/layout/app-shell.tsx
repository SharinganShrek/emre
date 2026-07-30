"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SidebarContent } from "./sidebar";
import { ThemeToggle } from "./theme";
import { QuickAddButton } from "@/components/quick-add";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background pb-[env(safe-area-inset-bottom)]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(100%,18rem)] border-r border-border bg-surface pt-[env(safe-area-inset-top)]">
            <div className="absolute right-2 top-[max(0.75rem,env(safe-area-inset-top))]">
              <Button
                variant="ghost"
                size="icon"
                className="size-10 touch-manipulation"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X />
              </Button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className={cn("lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-10 touch-manipulation lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu />
            </Button>
            <span className="text-sm font-medium text-muted lg:hidden">
              Emre
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <QuickAddButton />
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
