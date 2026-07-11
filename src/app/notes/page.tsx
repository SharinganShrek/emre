"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  StickyNote,
  Pin,
  PinOff,
  Trash2,
  Pencil,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { useHub } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Note } from "@/lib/types";

const CATEGORIES = ["all", "note", "idea", "project", "quote"] as const;

export default function NotesPage() {
  return (
    <Hydrated>
      <Notes />
    </Hydrated>
  );
}

function Notes() {
  const { data, add, update, remove } = useHub();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...data.notes]
      .filter((n) => category === "all" || n.category === category)
      .filter(
        (n) =>
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)),
      )
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.updated_at.localeCompare(a.updated_at),
      );
  }, [data.notes, query, category]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notes"
        description="Your second brain — ideas, projects, and quotes."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> New note
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes, tags…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm capitalize transition-colors",
                category === c
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title={query ? "No matching notes" : "No notes yet"}
          description={
            query
              ? "Try a different search."
              : "Capture an idea, quote, or project note."
          }
          action={
            !query ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus /> New note
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <Card key={n.id} className={cn(n.pinned && "ring-1 ring-primary/30")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium leading-tight">{n.title}</p>
                  <button
                    onClick={() => update("notes", n.id, { pinned: !n.pinned })}
                    className="text-muted-2 hover:text-primary"
                    aria-label={n.pinned ? "Unpin" : "Pin"}
                  >
                    {n.pinned ? (
                      <Pin className="size-4 fill-current text-primary" />
                    ) : (
                      <PinOff className="size-4" />
                    )}
                  </button>
                </div>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-muted">
                  {n.body}
                </p>
                {n.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {n.tags.map((t) => (
                      <Badge key={t} variant="default">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="accent" className="capitalize">
                    {n.category}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Edit"
                      onClick={() => {
                        setEditing(n);
                        setOpen(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Delete"
                      onClick={() => remove("notes", n.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NoteDialog
        open={open}
        onClose={() => setOpen(false)}
        note={editing}
        onSave={(v) => {
          if (editing) update("notes", editing.id, v);
          else
            add("notes", {
              user_id: data.profile.user_id,
              pinned: false,
              ...v,
            });
          setOpen(false);
        }}
      />
    </div>
  );
}

function NoteDialog({
  open,
  onClose,
  note,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  note: Note | null;
  onSave: (v: {
    title: string;
    body: string;
    tags: string[];
    category: Note["category"];
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState<Note["category"]>("note");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setTags(note?.tags.join(", ") ?? "");
    setCategory(note?.category ?? "note");
    setError(null);
  }, [open, note]);

  return (
    <Dialog open={open} onClose={onClose} title={note ? "Edit note" : "New note"}>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
          />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your note…"
            className="min-h-[140px]"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Category</Label>
            <Select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as Note["category"])
              }
            >
              <option value="note">Note</option>
              <option value="idea">Idea</option>
              <option value="project">Project</option>
              <option value="quote">Quote</option>
            </Select>
          </div>
          <div>
            <Label>Tags (comma separated)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="idea, sat, ai"
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
              if (!title.trim()) return setError("Title is required.");
              onSave({
                title: title.trim(),
                body,
                tags: tags
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean),
                category,
              });
            }}
          >
            {note ? "Save" : "Add note"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
