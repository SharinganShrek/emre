"use client";

import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PLANNER_HOURS,
  PLANNER_SLOT_COUNT,
  addDaysISO,
  blocksForPlannerDate,
  colorForSubject,
  formatHMS,
  plannerBoundsFromIndex,
  plannerSlotBounds,
  plannerSlotIndex,
  sessionMs,
  slotKey,
  subjectInSlot,
} from "@/lib/study/ypt";
import type { YptStudy } from "@/lib/study/use-ypt";

type Slot = { start: Date; end: Date };

export function PlannerTab({ study }: { study: YptStudy }) {
  const [date, setDate] = useState(study.today);
  const [draft, setDraft] = useState("");
  const [range, setRange] = useState<{ a: number; b: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ anchor: number } | null>(null);
  const todos = study.todosByDate[date] ?? [];

  useEffect(() => {
    setRange(null);
  }, [date]);

  useEffect(() => {
    const stop = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const selected = useMemo(() => {
    const next = new Map<number, Slot>();
    if (!range) return next;
    const lo = Math.min(range.a, range.b);
    const hi = Math.max(range.a, range.b);
    for (let i = lo; i <= hi; i++) {
      const bounds = plannerBoundsFromIndex(date, i);
      next.set(slotKey(bounds.start), bounds);
    }
    return next;
  }, [range, date]);

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

  const selectedSlots = [...selected.values()].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  function slotIndexFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y);
    const node = el instanceof Element ? el.closest("[data-slot-index]") : null;
    if (!node) return null;
    const n = Number(node.getAttribute("data-slot-index"));
    return Number.isInteger(n) && n >= 0 && n < PLANNER_SLOT_COUNT ? n : null;
  }

  function beginSelect(event: PointerEvent<HTMLElement>, index: number) {
    if (busy) return;
    event.preventDefault();
    dragRef.current = { anchor: index };
    setRange({ a: index, b: index });
    gridRef.current?.setPointerCapture(event.pointerId);
  }

  function extendSelect(event: PointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const index = slotIndexFromPoint(event.clientX, event.clientY);
    if (index == null) return;
    setRange({ a: drag.anchor, b: index });
  }

  function slotsWithoutLive() {
    if (!live) return selectedSlots;
    return selectedSlots.filter(
      (slot) =>
        !(slot.end.getTime() > live.startedAt && slot.start.getTime() < live.now),
    );
  }

  async function fill(subjectName: string) {
    const slots = slotsWithoutLive();
    if (slots.length === 0 || busy) return;
    setBusy(true);
    try {
      await study.fillPlannerSlots(date, slots, subjectName);
      setRange(null);
    } finally {
      setBusy(false);
    }
  }

  async function clearSelected() {
    const slots = slotsWithoutLive();
    if (slots.length === 0 || busy) return;
    setBusy(true);
    try {
      await study.clearPlannerSlots(date, slots);
      setRange(null);
    } finally {
      setBusy(false);
    }
  }

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
          <p className="mb-1 font-mono text-sm tabular-nums text-muted">
            {formatHMS(dayMs)}
          </p>
          <p className="mb-3 text-xs text-muted-2">
            Click and drag like highlighting text — every 10-minute box
            between the start and the cursor is selected. Then pick a
            subject to fill, or clear.
          </p>
          {selectedSlots.length > 0 && (
            <div className="mb-3 space-y-2 rounded-xl border border-border bg-surface-2 p-3">
              <p className="text-xs text-muted">
                {selectedSlots.length} box
                {selectedSlots.length === 1 ? "" : "es"} ·{" "}
                {selectedSlots.length * 10} min
              </p>
              <div className="flex flex-wrap gap-1.5">
                {study.settings.subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void fill(s.name)}
                    className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs touch-manipulation hover:bg-background disabled:opacity-50"
                  >
                    <span
                      className="mr-1.5 inline-block size-2 rounded-sm align-middle"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void clearSelected()}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <div
              ref={gridRef}
              className="min-w-[28rem] touch-none select-none"
              onPointerMove={extendSelect}
            >
              <div className="mb-1 grid grid-cols-[2.25rem_repeat(6,minmax(0,1fr))] gap-0.5 text-[10px] text-muted-2">
                <span />
                {["00", "10", "20", "30", "40", "50"].map((m) => (
                  <span key={m} className="text-center">
                    {m}
                  </span>
                ))}
              </div>
              <div className="space-y-0.5">
                {PLANNER_HOURS.map((hour, hourIndex) => (
                  <div
                    key={hour}
                    className="grid grid-cols-[2.25rem_repeat(6,minmax(0,1fr))] gap-0.5"
                  >
                    <span className="pt-0.5 text-right text-[11px] tabular-nums text-muted-2">
                      {hour}
                    </span>
                    {Array.from({ length: 6 }, (_, slot) => {
                      const bounds = plannerSlotBounds(date, hour, slot);
                      const index = plannerSlotIndex(hourIndex, slot);
                      const key = slotKey(bounds.start);
                      const hit = subjectInSlot(blocks, bounds.start, bounds.end);
                      const color = hit
                        ? colorForSubject(hit.subject, study.settings.subjects)
                        : undefined;
                      const isSelected = selected.has(key);
                      const label = `${String(hour).padStart(2, "0")}:${String(slot * 10).padStart(2, "0")}`;
                      return (
                        <button
                          key={slot}
                          type="button"
                          data-slot-index={index}
                          disabled={busy}
                          title={
                            hit
                              ? `${label} · ${hit.subject}`
                              : label
                          }
                          onPointerDown={(e) => beginSelect(e, index)}
                          className={cn(
                            "h-4 rounded-sm border border-border/60",
                            isSelected && "ring-2 ring-foreground ring-inset",
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
