"use client";

import { useState } from "react";
import { CalendarRange, Clock, LayoutGrid } from "lucide-react";
import { Hydrated } from "@/components/hydrated";
import { TimerTab } from "@/components/study/timer-tab";
import { PlannerTab } from "@/components/study/planner-tab";
import { StatsTab } from "@/components/study/stats-tab";
import { useYptStudy } from "@/lib/study/use-ypt";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "timer", label: "Timer", icon: Clock },
  { id: "planner", label: "Planner", icon: LayoutGrid },
  { id: "stats", label: "Stats", icon: CalendarRange },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function StudyPage() {
  return (
    <Hydrated>
      <StudyApp />
    </Hydrated>
  );
}

function StudyApp() {
  const study = useYptStudy();
  const [tab, setTab] = useState<Tab>("timer");

  return (
    <div className="space-y-6 pb-4">
      <h1 className="sr-only">Study</h1>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm touch-manipulation",
              tab === t.id
                ? "bg-surface-2 font-medium"
                : "text-muted hover:text-foreground",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "timer" && <TimerTab study={study} />}
      {tab === "planner" && <PlannerTab study={study} />}
      {tab === "stats" && <StatsTab study={study} />}
    </div>
  );
}
