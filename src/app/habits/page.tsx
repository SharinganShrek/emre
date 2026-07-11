"use client";

import { useEffect, useState } from "react";
import { Plus, Flame, Pencil, Archive, ArchiveRestore, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { useHub } from "@/lib/store";
import { habitStreak, isHabitDone } from "@/lib/selectors";
import { cn, toISODate } from "@/lib/utils";
import type { Habit } from "@/lib/types";

const COLORS = [
  "#7c9cff", "#8b5cf6", "#34d399", "#fbbf24",
  "#f87171", "#38bdf8", "#f472b6", "#a3e635",
];

export default function HabitsPage() {
  return (
    <Hydrated>
      <Habits />
    </Hydrated>
  );
}

function Habits() {
  const { data, add, update } = useHub();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  const active = data.habits
    .filter((h) => h.status === "active")
    .sort((a, b) => a.sort_order - b.sort_order);
  const archived = data.habits.filter((h) => h.status === "archived");

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(h: Habit) {
    setEditing(h);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Habits"
        description="Build streaks and track your daily routines."
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus /> Add habit
          </Button>
        }
      />

      {active.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No habits yet"
          description="Add habits like SAT Math, Gym, or Skincare to start tracking."
          action={
            <Button size="sm" onClick={openNew}>
              <Plus /> Add habit
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {active.map((habit) => (
            <HabitRow key={habit.id} habit={habit} onEdit={() => openEdit(habit)} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Archived</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {archived.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2"
              >
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: h.color }}
                />
                <span className="flex-1 text-sm text-muted">{h.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => update("habits", h.id, { status: "active" })}
                >
                  <ArchiveRestore /> Restore
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <HabitDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        habit={editing}
        onSave={(values) => {
          if (editing) {
            update("habits", editing.id, values);
          } else {
            add("habits", {
              user_id: data.profile.user_id,
              name: values.name,
              description: null,
              icon: null,
              color: values.color,
              frequency: values.frequency,
              target_per_day: values.target_per_day,
              status: "active",
              sort_order: data.habits.length,
            });
          }
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

function HabitRow({ habit, onEdit }: { habit: Habit; onEdit: () => void }) {
  const { data, update, toggleHabit } = useHub();
  const streak = habitStreak(data, habit.id);

  // Last 21 days heatmap
  const days = Array.from({ length: 21 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (20 - i));
    const iso = toISODate(d);
    return { iso, done: isHabitDone(data, habit.id, iso) };
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 sm:w-56">
          <span
            className="size-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: habit.color }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{habit.name}</p>
            <p className="text-xs text-muted-2 capitalize">
              {habit.frequency} · target {habit.target_per_day}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-1">
          {days.map((d) => (
            <button
              key={d.iso}
              title={d.iso}
              onClick={() => toggleHabit(habit.id, d.iso)}
              className={cn(
                "size-4 rounded-[4px] transition-transform hover:scale-110",
                !d.done && "bg-surface-2",
              )}
              style={d.done ? { backgroundColor: habit.color } : undefined}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {streak > 0 && (
            <Badge variant="warning" className="gap-1">
              <Flame className="size-3" /> {streak}
            </Badge>
          )}
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit habit">
            <Pencil />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Archive habit"
            onClick={() => update("habits", habit.id, { status: "archived" })}
          >
            <Archive />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HabitDialog({
  open,
  onClose,
  habit,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  habit: Habit | null;
  onSave: (values: {
    name: string;
    color: string;
    frequency: "daily" | "weekly";
    target_per_day: number;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [frequency, setFrequency] = useState<"daily" | "weekly">("daily");
  const [target, setTarget] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Initialize the form whenever the dialog opens (for a new or existing habit).
  useEffect(() => {
    if (!open) return;
    setName(habit?.name ?? "");
    setColor(habit?.color ?? COLORS[0]);
    setFrequency(habit?.frequency ?? "daily");
    setTarget(habit?.target_per_day ?? 1);
    setError(null);
  }, [open, habit]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={habit ? "Edit habit" : "New habit"}
    >
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. SAT Math"
            autoFocus
          />
        </div>
        <div>
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "size-7 rounded-full border-2",
                  color === c ? "border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Frequency</Label>
            <Select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as "daily" | "weekly")
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </Select>
          </div>
          <div>
            <Label>Target / day</Label>
            <Input
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(Math.max(1, Number(e.target.value)))}
            />
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) return setError("Name is required.");
              onSave({
                name: name.trim(),
                color,
                frequency,
                target_per_day: target,
              });
            }}
          >
            {habit ? "Save" : "Add habit"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
