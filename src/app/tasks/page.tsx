"use client";

import { useEffect, useState } from "react";
import { Plus, ListTodo, Pencil, Check, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { useHub } from "@/lib/store";
import { withToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";

const PRIORITY_VARIANT: Record<TaskPriority, BadgeProps["variant"]> = {
  low: "default",
  medium: "warning",
  high: "danger",
};

export default function TasksPage() {
  return (
    <Hydrated>
      <Tasks />
    </Hydrated>
  );
}

function Tasks() {
  const { data, add, update } = useHub();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");

  const items = data.tasks
    .filter((t) => {
      if (filter === "open") return t.status !== "done";
      if (filter === "done") return t.status === "done";
      return true;
    })
    .sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1;
      if (a.status !== "done" && b.status === "done") return -1;
      return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    });

  async function saveTask(values: {
    title: string;
    notes: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    due_date: string | null;
  }) {
    setSaving(true);
    const ok = await withToast(
      async () => {
        if (editing) {
          await update("tasks", editing.id, values);
        } else {
          await add("tasks", {
            user_id: data.profile.user_id,
            project: null,
            ...values,
          });
        }
      },
      {
        loading: editing ? "Saving task…" : "Creating task…",
        success: editing ? "Task updated" : "Task created",
      },
    );
    setSaving(false);
    if (ok) setOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Create tasks, edit details, and mark them done."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Add task
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {(["open", "done", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm capitalize transition-colors",
              filter === f
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="No tasks"
          description="Add a task to track something you need to finish."
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> Add task
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((task) => (
            <Card key={task.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <button
                  type="button"
                  aria-label={
                    task.status === "done" ? "Mark incomplete" : "Mark done"
                  }
                  className="mt-0.5 text-muted hover:text-success"
                  onClick={() =>
                    void withToast(
                      () =>
                        update("tasks", task.id, {
                          status: task.status === "done" ? "todo" : "done",
                        }),
                      {
                        success:
                          task.status === "done"
                            ? "Task reopened"
                            : "Task marked done",
                      },
                    )
                  }
                >
                  {task.status === "done" ? (
                    <Check className="size-5 text-success" />
                  ) : (
                    <Circle className="size-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      task.status === "done" && "text-muted line-through",
                    )}
                  >
                    {task.title}
                  </p>
                  {task.notes && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {task.notes}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={PRIORITY_VARIANT[task.priority]}>
                      {task.priority}
                    </Badge>
                    {task.due_date && (
                      <span className="text-xs text-muted-2">
                        Due {task.due_date}
                      </span>
                    )}
                    {task.status === "in_progress" && (
                      <Badge variant="accent">in progress</Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Edit task"
                  onClick={() => {
                    setEditing(task);
                    setOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TaskDialog
        open={open}
        onClose={() => !saving && setOpen(false)}
        task={editing}
        saving={saving}
        onSave={saveTask}
      />
    </div>
  );
}

function TaskDialog({
  open,
  onClose,
  task,
  saving,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  saving: boolean;
  onSave: (v: {
    title: string;
    notes: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    due_date: string | null;
  }) => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setPriority(task?.priority ?? "medium");
    setStatus(task?.status ?? "todo");
    setDueDate(task?.due_date ?? "");
    setError(null);
  }, [open, task]);

  return (
    <Dialog open={open} onClose={onClose} title={task ? "Edit task" : "New task"}>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input
            autoFocus
            value={title}
            disabled={saving}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Priority</Label>
            <Select
              value={priority}
              disabled={saving}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={status}
              disabled={saving}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </Select>
          </div>
        </div>
        <div>
          <Label>Due date</Label>
          <Input
            type="date"
            value={dueDate}
            disabled={saving}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea
            value={notes}
            disabled={saving}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional details"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={() => {
              if (!title.trim()) return setError("Title is required.");
              void onSave({
                title: title.trim(),
                notes: notes.trim() || null,
                priority,
                status,
                due_date: dueDate || null,
              });
            }}
          >
            {saving ? "Saving…" : task ? "Save" : "Add task"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
