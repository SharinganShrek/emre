"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Plus, CheckSquare, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useHub } from "@/lib/store";
import { withToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Kind = "task" | "note";

const QuickAddContext = createContext<{ open: (kind?: Kind) => void } | null>(
  null,
);

export function useQuickAdd() {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error("useQuickAdd must be used within QuickAddProvider");
  return ctx;
}

const TABS: { key: Kind; label: string; icon: typeof Plus }[] = [
  { key: "task", label: "Task", icon: CheckSquare },
  { key: "note", label: "Note", icon: StickyNote },
];

export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("task");
  const { add, data } = useHub();
  const user_id = data.profile.user_id;

  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">(
    "medium",
  );
  const [taskDue, setTaskDue] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setTaskTitle("");
    setTaskDue("");
    setTaskPriority("medium");
    setNoteTitle("");
    setNoteBody("");
    setError(null);
  }

  function openDialog(k: Kind = "task") {
    setKind(k);
    setOpen(true);
  }

  function close() {
    if (saving) return;
    setOpen(false);
    reset();
  }

  async function submit() {
    setError(null);
    if (kind === "task") {
      if (!taskTitle.trim()) return setError("Task title is required.");
      setSaving(true);
      const ok = await withToast(
        () =>
          add("tasks", {
            user_id,
            title: taskTitle.trim(),
            notes: null,
            status: "todo",
            priority: taskPriority,
            due_date: taskDue || null,
            project: null,
          }),
        { loading: "Creating task…", success: "Task created" },
      );
      setSaving(false);
      if (ok) {
        setOpen(false);
        reset();
      }
      return;
    }

    if (!noteTitle.trim()) return setError("Note title is required.");
    setSaving(true);
    const ok = await withToast(
      () =>
        add("notes", {
          user_id,
          title: noteTitle.trim(),
          body: noteBody,
          tags: [],
          category: "note",
          pinned: false,
        }),
      { loading: "Saving note…", success: "Note saved" },
    );
    setSaving(false);
    if (ok) {
      setOpen(false);
      reset();
    }
  }

  return (
    <QuickAddContext.Provider value={{ open: openDialog }}>
      {children}
      <Dialog
        open={open}
        onClose={close}
        title="Quick add"
        description="Capture something without leaving the page."
      >
        <div className="mb-4 flex gap-1 rounded-lg bg-surface-2 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setKind(t.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  kind === t.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {kind === "task" && (
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                autoFocus
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="What needs doing?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select
                  value={taskPriority}
                  onChange={(e) =>
                    setTaskPriority(e.target.value as typeof taskPriority)
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </div>
              <div>
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {kind === "note" && (
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                autoFocus
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note title"
              />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write your note…"
              />
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : "Add"}
          </Button>
        </div>
      </Dialog>
    </QuickAddContext.Provider>
  );
}

export function QuickAddButton() {
  const { open } = useQuickAdd();
  return (
    <Button size="sm" onClick={() => open("task")}>
      <Plus />
      <span className="hidden sm:inline">Quick add</span>
    </Button>
  );
}
