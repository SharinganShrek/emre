"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";
import {
  addDaysISO,
  colorForSubject,
  formatHMS,
  heatmapLevel,
  minutesByDate,
  minutesBySubject,
  monthGrid,
  sessionMs,
  startOfWeekMonday,
} from "@/lib/study/ypt";
import type { YptStudy } from "@/lib/study/use-ypt";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEAT = [
  "var(--surface-2)",
  "color-mix(in srgb, #2dd4bf 22%, var(--surface-2))",
  "color-mix(in srgb, #2dd4bf 45%, var(--surface-2))",
  "color-mix(in srgb, #2dd4bf 70%, #0f766e)",
  "#2dd4bf",
] as const;

export function StatsTab({ study }: { study: YptStudy }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(`${study.today}T12:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(study.today);

  const weeks = useMemo(() => monthGrid(cursor), [cursor]);
  const byDate = useMemo(() => minutesByDate(study.sessions), [study.sessions]);
  const monthLabel = cursor.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const weekStart = startOfWeekMonday(study.today);
  const weekEnd = addDaysISO(weekStart, 6);
  const monthISO = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;

  const weekMs = study.sessions
    .filter((s) => s.session_date >= weekStart && s.session_date <= weekEnd)
    .reduce((sum, s) => sum + sessionMs(s), 0);
  const monthMs = study.sessions
    .filter((s) => s.session_date.startsWith(monthISO))
    .reduce((sum, s) => sum + sessionMs(s), 0);
  const selectedMs =
    (byDate.get(selected) ?? 0) * 60_000 +
    (selected === study.today ? study.liveMs : 0);

  const selectedSessions = study.sessions.filter(
    (s) => s.session_date === selected,
  );
  const breakdown = minutesBySubject(
    selectedSessions,
    selected === study.today && study.liveMs > 0
      ? {
          subject: study.activeSubject?.name ?? "Study",
          minutes: study.liveMs / 60_000,
        }
      : undefined,
  );
  const weekBreakdown = minutesBySubject(
    study.sessions.filter(
      (s) => s.session_date >= weekStart && s.session_date <= weekEnd,
    ),
  );
  const maxWeek = Math.max(1, ...weekBreakdown.map((x) => x.minutes));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Today"
          value={formatHMS(study.todayMs)}
          hint="Including live timer"
        />
        <StatCard label="This week" value={formatHMS(weekMs)} hint="Mon–Sun" />
        <StatCard
          label={monthLabel}
          value={formatHMS(monthMs)}
          hint="Logged this month"
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{monthLabel}</CardTitle>
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
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-2">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {weeks.flat().map((cell) => {
              const minutes = byDate.get(cell.iso) ?? 0;
              const extra =
                cell.iso === study.today ? study.liveMs / 60_000 : 0;
              const level = heatmapLevel(minutes + extra);
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => setSelected(cell.iso)}
                  className={cn(
                    "aspect-square rounded-lg text-xs tabular-nums transition",
                    selected === cell.iso && "ring-2 ring-teal-400",
                    !cell.inMonth && "opacity-40",
                  )}
                  style={{ backgroundColor: HEAT[level] }}
                  title={`${cell.iso}: ${formatHMS((minutes + extra) * 60_000)}`}
                >
                  {Number(cell.iso.slice(-2))}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-2">
            Deeper teal = more hours studied that day.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 font-mono text-2xl tabular-nums">
              {formatHMS(selectedMs)}
            </p>
            {breakdown.length === 0 ? (
              <p className="text-sm text-muted-2">No study logged.</p>
            ) : (
              <ul className="space-y-2">
                {breakdown.map((row) => (
                  <li
                    key={row.subject}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="size-2.5 rounded-sm"
                      style={{
                        backgroundColor: colorForSubject(
                          row.subject,
                          study.settings.subjects,
                        ),
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate">{row.subject}</span>
                    <span className="font-mono tabular-nums text-muted">
                      {formatHMS(row.minutes * 60_000)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This week by subject</CardTitle>
          </CardHeader>
          <CardContent>
            {weekBreakdown.length === 0 ? (
              <p className="text-sm text-muted-2">No study this week yet.</p>
            ) : (
              <ul className="space-y-3">
                {weekBreakdown.map((row) => (
                  <li key={row.subject}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate">{row.subject}</span>
                      <span className="font-mono tabular-nums text-muted">
                        {formatHMS(row.minutes * 60_000)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((row.minutes / maxWeek) * 100)}%`,
                          backgroundColor: colorForSubject(
                            row.subject,
                            study.settings.subjects,
                          ),
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
