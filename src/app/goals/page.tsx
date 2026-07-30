"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Target, Flag, Trash2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { useHub } from "@/lib/store";
import { toast, withToast } from "@/lib/toast";
import { formatLongDate } from "@/lib/utils";
import type { Goal } from "@/lib/types";

export default function GoalsPage() {
  return (
    <Hydrated>
      <Goals />
    </Hydrated>
  );
}

function Goals() {
  const { data, add } = useHub();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function createGoal(v: {
    title: string;
    description: string;
    category: string;
    target_date: string;
  }) {
    setSaving(true);
    const ok = await withToast(
      () =>
        add("goals", {
          user_id: data.profile.user_id,
          title: v.title,
          description: v.description || null,
          category: v.category || null,
          status: "active",
          progress: 0,
          target_date: v.target_date || null,
        }),
      { loading: "Creating goal…", success: "Goal created" },
    );
    setSaving(false);
    if (ok) setOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals"
        description="Long-term goals with milestones and deadlines."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> New goal
          </Button>
        }
      />

      {data.goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Set a long-term goal like “SAT 1550+” and break it into milestones."
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> New goal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </div>
      )}

      <GoalDialog
        open={open}
        onClose={() => !saving && setOpen(false)}
        saving={saving}
        onSave={createGoal}
      />
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const { data, update, remove, add } = useHub();
  const [newMilestone, setNewMilestone] = useState("");
  const [progress, setProgress] = useState(goal.progress);
  const [savingProgress, setSavingProgress] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setProgress(goal.progress);
  }, [goal.progress]);

  const milestones = data.milestones
    .filter((m) => m.goal_id === goal.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  function onProgressChange(value: number) {
    setProgress(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setSavingProgress(true);
        try {
          await update("goals", goal.id, {
            progress: value,
            status: value >= 100 ? "completed" : "active",
          });
          toast.success("Progress updated");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save progress");
          setProgress(goal.progress);
        } finally {
          setSavingProgress(false);
        }
      })();
    }, 400);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base">{goal.title}</CardTitle>
          <div className="mt-1.5 flex items-center gap-2">
            {goal.category && <Badge variant="accent">{goal.category}</Badge>}
            <Badge
              variant={goal.status === "completed" ? "success" : "default"}
            >
              {goal.status}
            </Badge>
            {savingProgress && (
              <span className="text-[10px] text-muted-2">Saving…</span>
            )}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Delete goal"
          onClick={() =>
            void withToast(() => remove("goals", goal.id), {
              success: "Goal deleted",
            })
          }
        >
          <Trash2 />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {goal.description && (
          <p className="text-sm text-muted">{goal.description}</p>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
          <input
            type="range"
            min={0}
            max={100}
            value={progress}
            onChange={(e) => onProgressChange(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--primary)]"
          />
        </div>

        {goal.target_date && (
          <p className="flex items-center gap-1.5 text-xs text-muted-2">
            <Flag className="size-3.5" />
            Target: {formatLongDate(goal.target_date)}
          </p>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted">Milestones</p>
          {milestones.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void update("milestones", m.id, { done: !m.done })}
                className={`flex size-4 items-center justify-center rounded border ${
                  m.done
                    ? "border-transparent bg-success text-white"
                    : "border-border-strong"
                }`}
                aria-label="Toggle milestone"
              >
                {m.done && <Check className="size-3" strokeWidth={3} />}
              </button>
              <span
                className={`flex-1 text-sm ${
                  m.done ? "text-muted line-through" : ""
                }`}
              >
                {m.title}
              </span>
              <button
                type="button"
                onClick={() => void remove("milestones", m.id)}
                className="text-muted-2 hover:text-danger"
                aria-label="Remove milestone"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newMilestone.trim()) return;
              void add("milestones", {
                user_id: data.profile.user_id,
                goal_id: goal.id,
                title: newMilestone.trim(),
                done: false,
                due_date: null,
                sort_order: milestones.length,
              });
              setNewMilestone("");
            }}
            className="flex gap-2 pt-1"
          >
            <Input
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              placeholder="Add milestone…"
              className="h-8 text-xs"
            />
            <Button size="sm" type="submit" variant="secondary">
              Add
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function GoalDialog({
  open,
  onClose,
  saving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  saving: boolean;
  onSave: (v: {
    title: string;
    description: string;
    category: string;
    target_date: string;
  }) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setCategory("");
      setTargetDate("");
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="New goal">
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input
            autoFocus
            value={title}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. SAT 1550+"
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            value={description}
            disabled={saving}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does success look like?"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Input
              value={category}
              disabled={saving}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Academics"
            />
          </div>
          <div>
            <Label>Target date</Label>
            <Input
              type="date"
              value={targetDate}
              disabled={saving}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              if (!title.trim()) return setError("Title is required.");
              void onSave({
                title: title.trim(),
                description,
                category,
                target_date: targetDate,
              });
            }}
          >
            {saving ? "Creating…" : "Create goal"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
