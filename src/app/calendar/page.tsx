"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { HabitChecklist } from "@/components/habits/habit-checklist";
import { useHub } from "@/lib/store";
import { SatVocabProvider, useSatVocab } from "@/lib/sat-vocab/store";
import { completionForDate } from "@/lib/selectors";
import { cn, formatLongDate, toISODate, todayISO } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  return (
    <Hydrated>
      <SatVocabProvider>
        <CalendarView />
      </SatVocabProvider>
    </Hydrated>
  );
}

function CalendarView() {
  const { data } = useHub();
  const { progress } = useSatVocab();
  const satDone = useMemo(
    () => new Set(progress.completed_dates),
    [progress.completed_dates],
  );
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(todayISO());

  const weeks = useMemo(() => buildMonth(cursor), [cursor]);
  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const selectedCompletion = completionForDate(data, selected);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="Habits + SAT vocab session days (blue = vocab day completed)."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{monthLabel}</CardTitle>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Previous month"
                onClick={() =>
                  setCursor(
                    new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                  )
                }
              >
                <ChevronLeft />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const d = new Date();
                  setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                  setSelected(todayISO());
                }}
              >
                Today
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Next month"
                onClick={() =>
                  setCursor(
                    new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                  )
                }
              >
                <ChevronRight />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-2">
              {WEEKDAYS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weeks.flat().map((day, i) => {
                if (!day) return <div key={i} />;
                const iso = toISODate(day);
                const inMonth = day.getMonth() === cursor.getMonth();
                const comp = completionForDate(data, iso);
                const isToday = iso === todayISO();
                const isSelected = iso === selected;
                const future = iso > todayISO();
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(iso)}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border text-xs transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-transparent hover:bg-surface-2",
                      !inMonth && "opacity-40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full",
                        isToday && "bg-primary text-primary-foreground font-semibold",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <span className="flex h-1.5 items-center justify-center gap-0.5">
                      {!future && comp.total > 0 && (
                        <span
                          className={cn(
                            "h-1.5 w-3 rounded-full",
                            comp.pct === 100
                              ? "bg-success"
                              : comp.pct >= 50
                                ? "bg-warning"
                                : comp.pct > 0
                                  ? "bg-danger/70"
                                  : "bg-surface-2",
                          )}
                        />
                      )}
                      {satDone.has(iso) && (
                        <span className="h-1.5 w-3 rounded-full bg-primary" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Habits</CardTitle>
            <p className="text-xs text-muted">{formatLongDate(selected)}</p>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                <span>Completion</span>
                <span>
                  {selectedCompletion.done}/{selectedCompletion.total}
                </span>
              </div>
              <Progress
                value={selectedCompletion.pct}
                barClassName="bg-success"
              />
            </div>
            <HabitChecklist date={selected} showStreak={false} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Build a 6-row month grid (Monday-first) padded with adjacent days. */
function buildMonth(monthStart: Date): (Date | null)[][] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(year, month, 1 - startOffset);

  const weeks: (Date | null)[][] = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week: (Date | null)[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
