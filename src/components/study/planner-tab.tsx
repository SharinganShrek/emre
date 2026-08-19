"use client";

import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PLANNER_HOURS,
  addDaysISO,
  blocksForPlannerDate,
  colorForSubject,
  formatHMS,
  plannerSlotBounds,
  sessionMs,
  subjectInSlot,
} from "@/lib/study/ypt";
import type { YptStudy } from "@/lib/study/use-ypt";

export function PlannerTab({ study }: { study: YptStudy }) {
  const [date, setDate] = useState(study.today);
  const [draft, setDraft] = useState("");
  const todos = study.todosByDate[date] ?? [];

  const live =
    study.running && study.timer.startedAt != null && date === study.today
      ? {
          subject: study.activeSubject?.name ?? "Study",
          startedAt: study.timer.startedAt,
          now: study.now,
        }
      : null;

  const blocks = useMemo(
    () => blocksForPlannerDate(study.sessions, date, live),
    [study.sessions, date, live],
  );

  const dayMs =
    study.sessions
      .filter((s) => s.session_date === date)
      .reduce((sum, s) => sum + sessionMs(s), 0) +
    (date === study.today ? study.liveMs : 0);

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>10-minute planner</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Previous day"
              onClick={() => setDate(addDaysISO(date, -1))}
            >
              <ChevronLeft />
            </Button>
            <button
              type="button"
              className="min-w-[8.5rem] text-sm text-muted"
              onClick={() => setDate(study.today)}
            >
              {dateLabel}
            </button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Next day"
              onClick={() => setDate(addDaysISO(date, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 font-mono text-sm tabular-nums text-muted">
            {formatHMS(dayMs)}
          </p>
          <div className="overflow-x-auto">
            <div className="min-w-[28rem]">
              <div className="mb-1 grid grid-cols-[2.25rem_repeat(6,minmax(0,1fr))] gap-0.5 text-[10px] text-muted-2">
                <span />
                {["00", "10", "20", "30", "40", "50"].map((m) => (
                  <span key={m} className="text-center">
                    {m}
                  </span>
                ))}
              </div>
              <div className="space-y-0.5">
                {PLANNER_HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="grid grid-cols-[2.25rem_repeat(6,minmax(0,1fr))] gap-0.5"
                  >
                    <span className="pt-0.5 text-right text-[11px] tabular-nums text-muted-2">
                      {hour}
                    </span>
                    {Array.from({ length: 6 }, (_, slot) => {
                      const { start, end } = plannerSlotBounds(
                        date,
                        hour,
                        slot,
                      );
                      const hit = subjectInSlot(blocks, start, end);
                      const color = hit
                        ? colorForSubject(hit.subject, study.settings.subjects)
                        : undefined;
                      return (
                        <div
                          key={slot}
                          title={
                            hit
                              ? `${String(hour).padStart(2, "0")}:${String(slot * 10).padStart(2, "0")} · ${hit.subject}`
                              : `${String(hour).padStart(2, "0")}:${String(slot * 10).padStart(2, "0")}`
                          }
                          className={cn(
                            "h-4 rounded-sm border border-border/60",
                            hit?.live && "ring-1 ring-teal-400/80",
                          )}
                          style={{ backgroundColor: color ?? "transparent" }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {study.settings.subjects.map((s) => (
              <span
                key={s.id}
                className="flex items-center gap-1.5 text-xs text-muted"
              >
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: s.color }}
                />
                {s.name}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>To-do</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              study.addTodo(date, draft);
              setDraft("");
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a task"
            />
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>
          {todos.length === 0 ? (
            <p className="text-sm text-muted-2">No tasks for this day.</p>
          ) : (
            <ul className="space-y-2">
              {todos.map((todo) => (
                <li key={todo.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={todo.done}
                    onChange={() => study.toggleTodo(date, todo.id)}
                    label={todo.text}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-sm",
                      todo.done && "text-muted-2 line-through",
                    )}
                  >
                    {todo.text}
                  </span>
                  <button
                    type="button"
                    className="text-muted-2 hover:text-danger"
                    aria-label="Delete task"
                    onClick={() => study.removeTodo(date, todo.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
