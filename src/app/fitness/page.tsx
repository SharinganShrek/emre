"use client";

import { useEffect, useState } from "react";
import { Plus, Dumbbell, Trash2, Timer, CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { PageNotes } from "@/components/notion/page-notes";
import { useHub } from "@/lib/store";
import { formatLongDate, todayISO, toISODate } from "@/lib/utils";

export default function FitnessPage() {
  return (
    <Hydrated>
      <Fitness />
    </Hydrated>
  );
}

function Fitness() {
  const { data, add, remove } = useHub();
  const [open, setOpen] = useState(false);

  const sessions = [...data.gymSessions].sort((a, b) =>
    b.session_date.localeCompare(a.session_date),
  );

  const weekStartISO = (() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return toISODate(d);
  })();
  const thisWeek = sessions.filter((s) => s.session_date >= weekStartISO).length;
  const avgDuration =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((s, x) => s + x.duration_minutes, 0) /
            sessions.length,
        )
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fitness"
        description="Log gym sessions and track consistency."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> Log session
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="This week"
          value={thisWeek}
          hint="Sessions"
          icon={CalendarCheck}
          accent="text-success"
        />
        <StatCard
          label="Total sessions"
          value={sessions.length}
          hint="All time"
          icon={Dumbbell}
          accent="text-danger"
        />
        <StatCard
          label="Avg duration"
          value={`${avgDuration}m`}
          hint="Per session"
          icon={Timer}
          accent="text-primary"
        />
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No sessions yet"
          description="Log your first workout to start tracking consistency."
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> Log session
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              sessionId={s.id}
              onDelete={() => remove("gymSessions", s.id)}
            />
          ))}
        </div>
      )}

      <PageNotes
        storageKey="emre-hub:notes:fitness"
        title="Program & notes"
        initialBlocks={[
          { id: "f1", type: "h2", text: "Current split" },
          { id: "f2", type: "bullet", text: "Push / Pull / Legs" },
          { id: "f3", type: "h2", text: "Goals" },
          { id: "f4", type: "todo", text: "Bench 70kg x 5", checked: false },
        ]}
      />

      <SessionDialog
        open={open}
        onClose={() => setOpen(false)}
        onSave={(v) => {
          add("gymSessions", {
            user_id: data.profile.user_id,
            session_date: v.date,
            duration_minutes: v.duration,
            focus: v.focus || null,
            notes: v.notes || null,
          });
          setOpen(false);
        }}
      />
    </div>
  );
}

function SessionCard({
  sessionId,
  onDelete,
}: {
  sessionId: string;
  onDelete: () => void;
}) {
  const { data, add, remove } = useHub();
  const session = data.gymSessions.find((s) => s.id === sessionId)!;
  const exercises = data.gymExercises.filter((e) => e.session_id === sessionId);
  const [name, setName] = useState("");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(8);
  const [weight, setWeight] = useState(0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">
            {session.focus || "Workout"}
          </CardTitle>
          <p className="text-xs text-muted-2">
            {formatLongDate(session.session_date)} · {session.duration_minutes}m
          </p>
        </div>
        <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete session">
          <Trash2 />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {session.notes && <p className="text-sm text-muted">{session.notes}</p>}
        {exercises.map((ex) => (
          <div
            key={ex.id}
            className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2"
          >
            <span className="flex-1 text-sm">{ex.name}</span>
            <Badge variant="default">
              {ex.sets}×{ex.reps}
              {ex.weight_kg ? ` @ ${ex.weight_kg}kg` : ""}
            </Badge>
            <button
              onClick={() => remove("gymExercises", ex.id)}
              className="text-muted-2 hover:text-danger"
              aria-label="Delete exercise"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            add("gymExercises", {
              user_id: data.profile.user_id,
              session_id: sessionId,
              name: name.trim(),
              sets,
              reps,
              weight_kg: weight || null,
            });
            setName("");
          }}
          className="flex flex-wrap items-end gap-2 pt-1"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Exercise"
            className="h-8 w-40 text-xs"
          />
          <input
            type="number"
            value={sets}
            min={1}
            onChange={(e) => setSets(Number(e.target.value))}
            className="h-8 w-14 rounded-lg border border-border bg-surface-2 px-2 text-xs"
            aria-label="Sets"
          />
          <span className="text-xs text-muted-2">sets ×</span>
          <input
            type="number"
            value={reps}
            min={1}
            onChange={(e) => setReps(Number(e.target.value))}
            className="h-8 w-14 rounded-lg border border-border bg-surface-2 px-2 text-xs"
            aria-label="Reps"
          />
          <span className="text-xs text-muted-2">reps @</span>
          <input
            type="number"
            value={weight}
            min={0}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="h-8 w-16 rounded-lg border border-border bg-surface-2 px-2 text-xs"
            aria-label="Weight kg"
          />
          <span className="text-xs text-muted-2">kg</span>
          <Button size="sm" type="submit" variant="secondary">
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SessionDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (v: {
    date: string;
    duration: number;
    focus: string;
    notes: string;
  }) => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [duration, setDuration] = useState(55);
  const [focus, setFocus] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDate(todayISO());
      setDuration(55);
      setFocus("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="Log gym session">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Duration (min)</Label>
            <Input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
            />
          </div>
        </div>
        <div>
          <Label>Focus</Label>
          <Input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Push / Pull / Legs"
          />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it go?"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (duration <= 0) return setError("Duration must be positive.");
              onSave({ date, duration, focus, notes });
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
