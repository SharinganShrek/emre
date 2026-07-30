"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Pin,
  Trash2,
  X,
  Image as ImageIcon,
  CheckSquare,
  Palette,
  Bell,
} from "lucide-react";
import { Hydrated } from "@/components/hydrated";
import { useHub } from "@/lib/store";
import { withToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Note } from "@/lib/types";

const BULLET = "• ";

/**
 * Keep-style list shortcuts for note body:
 * - typing "- " at line start → "• "
 * - Enter on a bullet line → continue with "• "
 * - Enter on an empty bullet → exit the list
 */
function applyListKey(
  value: string,
  cursor: number,
  key: string,
): { value: string; cursor: number } | null {
  if (cursor < 0 || cursor > value.length) return null;
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);

  if (key === " ") {
    if (!/(^|\n)-$/.test(before)) return null;
    const next = `${before.slice(0, -1)}${BULLET}${after}`;
    return { value: next, cursor: before.length - 1 + BULLET.length };
  }

  if (key === "Enter") {
    const lineStart = before.lastIndexOf("\n") + 1;
    const line = before.slice(lineStart);
    if (!line.startsWith(BULLET) && !/^-\s/.test(line)) return null;

    // Empty bullet line → remove it and exit list
    if (line === BULLET || line === "-" || line === "- ") {
      const next = `${value.slice(0, lineStart)}${after}`;
      return { value: next, cursor: lineStart };
    }

    const next = `${before}\n${BULLET}${after}`;
    return { value: next, cursor: before.length + 1 + BULLET.length };
  }

  return null;
}

function autoSize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function NoteBodyTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  autoFocus,
  className,
  textareaRef,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <textarea
      ref={textareaRef}
      value={value}
      autoFocus={autoFocus}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
        autoSize(e.target);
      }}
      onKeyDown={(e) => {
        if (e.key !== " " && e.key !== "Enter") return;
        if (e.nativeEvent.isComposing) return;
        const el = e.currentTarget;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        if (start !== end) return;
        const next = applyListKey(value, start, e.key);
        if (!next) return;
        e.preventDefault();
        onChange(next.value);
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = next.cursor;
          autoSize(el);
        });
      }}
      className={className}
    />
  );
}

export default function NotesPage() {
  return (
    <Hydrated>
      <KeepNotes />
    </Hydrated>
  );
}

function KeepNotes() {
  const { data, add, update, remove } = useHub();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.notes.filter(
      (n) =>
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [data.notes, query]);

  const pinned = useMemo(
    () =>
      filtered
        .filter((n) => n.pinned)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [filtered],
  );
  const others = useMemo(
    () =>
      filtered
        .filter((n) => !n.pinned)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [filtered],
  );

  async function createNote(values: {
    title: string;
    body: string;
    tags: string[];
  }) {
    if (!values.title.trim() && !values.body.trim()) return false;
    return withToast(
      () =>
        add("notes", {
          user_id: data.profile.user_id,
          title: values.title.trim() || "",
          body: values.body,
          tags: values.tags,
          category: "note",
          pinned: false,
        }),
      { success: "Note added" },
    );
  }

  async function saveNote(
    id: string,
    values: { title: string; body: string; tags: string[]; pinned: boolean },
  ) {
    return withToast(
      () =>
        update("notes", id, {
          title: values.title.trim() || "",
          body: values.body,
          tags: values.tags,
          pinned: values.pinned,
        }),
      { success: "Note saved" },
    );
  }

  function openNote(note: Note) {
    setEditing(note);
    setEditorOpen(true);
  }

  return (
    <div className="-mx-4 -mt-2 min-h-[70vh] sm:-mx-6">
      {/* Keep-style search */}
      <div className="mx-auto mb-6 max-w-2xl px-4 sm:px-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className={cn(
              "h-12 w-full rounded-lg border-0 bg-surface-2 pl-12 pr-4 text-sm text-foreground",
              "shadow-sm outline-none ring-1 ring-border/60",
              "placeholder:text-muted-2",
              "focus:bg-surface focus:ring-2 focus:ring-primary/30",
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-2 hover:bg-surface-2 hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Take a note */}
      <div className="mx-auto mb-8 max-w-xl px-4 sm:px-0">
        <TakeANote onCreate={createNote} />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex size-28 items-center justify-center rounded-full border border-border/50">
            <Search className="size-12 text-muted-2/50" strokeWidth={1} />
          </div>
          <p className="text-lg text-muted">
            {query ? "No matching notes" : "Notes you add appear here"}
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl space-y-8 px-3 sm:px-4">
          {pinned.length > 0 && (
            <KeepSection label="Pinned">
              {pinned.map((n) => (
                <KeepCard
                  key={n.id}
                  note={n}
                  onOpen={() => openNote(n)}
                  onTogglePin={() =>
                    void withToast(
                      () => update("notes", n.id, { pinned: false }),
                      { success: "Unpinned" },
                    )
                  }
                  onDelete={() =>
                    void withToast(() => remove("notes", n.id), {
                      success: "Note deleted",
                    })
                  }
                />
              ))}
            </KeepSection>
          )}

          {others.length > 0 && (
            <KeepSection label={pinned.length > 0 ? "Others" : undefined}>
              {others.map((n) => (
                <KeepCard
                  key={n.id}
                  note={n}
                  onOpen={() => openNote(n)}
                  onTogglePin={() =>
                    void withToast(
                      () => update("notes", n.id, { pinned: true }),
                      { success: "Pinned" },
                    )
                  }
                  onDelete={() =>
                    void withToast(() => remove("notes", n.id), {
                      success: "Note deleted",
                    })
                  }
                />
              ))}
            </KeepSection>
          )}
        </div>
      )}

      {editorOpen && editing && (
        <KeepEditor
          note={editing}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
          onSave={async (values) => {
            const ok = await saveNote(editing.id, values);
            if (ok) {
              setEditorOpen(false);
              setEditing(null);
            }
          }}
          onDelete={async () => {
            const ok = await withToast(() => remove("notes", editing.id), {
              success: "Note deleted",
            });
            if (ok) {
              setEditorOpen(false);
              setEditing(null);
            }
          }}
        />
      )}
    </div>
  );
}

function KeepSection({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      {label && (
        <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-2">
          {label}
        </p>
      )}
      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
        {children}
      </div>
    </section>
  );
}

function KeepCard({
  note,
  onOpen,
  onTogglePin,
  onDelete,
}: {
  note: Note;
  onOpen: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const displayTitle = note.title.trim();
  const displayBody = note.body.trim();

  return (
    <article
      className={cn(
        "group mb-4 break-inside-avoid rounded-xl border border-border bg-card",
        "transition-[box-shadow,border-color] duration-150",
        "hover:border-border-strong hover:shadow-lg hover:shadow-black/20",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full px-4 pb-2 pt-4 text-left"
      >
        {displayTitle ? (
          <h3 className="mb-2 text-[15px] font-medium leading-snug text-foreground">
            {displayTitle}
          </h3>
        ) : null}
        {displayBody ? (
          <p className="line-clamp-[18] whitespace-pre-wrap text-sm leading-relaxed text-muted">
            {displayBody}
          </p>
        ) : !displayTitle ? (
          <p className="text-sm italic text-muted-2">Empty note</p>
        ) : null}
        {note.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {note.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </button>

      <div
        className={cn(
          "flex items-center gap-0.5 px-2 pb-2 pt-1",
          "opacity-0 transition-opacity duration-150 group-hover:opacity-100",
          "focus-within:opacity-100",
        )}
      >
        <KeepIconBtn label="Remind me" disabled>
          <Bell className="size-4" />
        </KeepIconBtn>
        <KeepIconBtn label="Background options" disabled>
          <Palette className="size-4" />
        </KeepIconBtn>
        <KeepIconBtn label="Add image" disabled>
          <ImageIcon className="size-4" />
        </KeepIconBtn>
        <KeepIconBtn
          label={note.pinned ? "Unpin" : "Pin"}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
        >
          <Pin
            className={cn("size-4", note.pinned && "fill-current text-primary")}
          />
        </KeepIconBtn>
        <KeepIconBtn
          label="Delete note"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-4" />
        </KeepIconBtn>
      </div>
    </article>
  );
}

function TakeANote({
  onCreate,
}: {
  onCreate: (v: {
    title: string;
    body: string;
    tags: string[];
  }) => Promise<boolean>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef({ title: "", body: "" });

  useEffect(() => {
    draftRef.current = { title, body };
  }, [title, body]);

  useEffect(() => {
    if (!expanded) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        void closeAndMaybeSave();
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  async function closeAndMaybeSave() {
    if (!expanded || saving) return;
    const draft = draftRef.current;
    const hasContent = draft.title.trim() || draft.body.trim();
    if (hasContent) {
      setSaving(true);
      const ok = await onCreate({
        title: draft.title,
        body: draft.body,
        tags: [],
      });
      setSaving(false);
      if (!ok) return;
    }
    setTitle("");
    setBody("");
    setExpanded(false);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
          requestAnimationFrame(() => bodyRef.current?.focus());
        }}
        className={cn(
          "flex h-12 w-full items-center gap-3 rounded-lg bg-surface px-4 text-left text-sm text-muted",
          "shadow-md shadow-black/25 ring-1 ring-border",
          "hover:ring-border-strong",
        )}
      >
        <span className="flex-1">Take a note…</span>
        <CheckSquare className="size-5 text-muted-2" />
        <ImageIcon className="size-5 text-muted-2" />
      </button>
    );
  }

  return (
    <div
      ref={rootRef}
      className="rounded-lg bg-surface shadow-xl shadow-black/30 ring-1 ring-border"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full bg-transparent px-4 pt-3 text-[15px] font-medium text-foreground outline-none placeholder:text-muted-2"
      />
      <NoteBodyTextarea
        textareaRef={bodyRef}
        value={body}
        onChange={setBody}
        placeholder="Take a note…"
        rows={3}
        className="w-full resize-none bg-transparent px-4 py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-2"
      />
      <div className="flex items-center justify-between px-2 pb-2">
        <div className="flex items-center gap-0.5">
          <KeepIconBtn label="Remind me" disabled>
            <Bell className="size-4" />
          </KeepIconBtn>
          <KeepIconBtn label="Background options" disabled>
            <Palette className="size-4" />
          </KeepIconBtn>
          <KeepIconBtn label="Add image" disabled>
            <ImageIcon className="size-4" />
          </KeepIconBtn>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void closeAndMaybeSave()}
          className="rounded-md px-4 py-1.5 text-sm font-medium text-foreground hover:bg-surface-2 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Close"}
        </button>
      </div>
    </div>
  );
}

function KeepEditor({
  note,
  onSave,
  onDelete,
}: {
  note: Note;
  onClose: () => void;
  onSave: (v: {
    title: string;
    body: string;
    tags: string[];
    pinned: boolean;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [tagsText, setTagsText] = useState(note.tags.join(", "));
  const [pinned, setPinned] = useState(note.pinned);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void handleClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // handleClose closes over latest title/body via state in same render cycle when key fires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, tagsText, pinned]);

  async function handleClose() {
    setSaving(true);
    await onSave({
      title,
      body,
      pinned,
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10 sm:py-16">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        onClick={() => void handleClose()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit note"
        className={cn(
          "relative z-10 w-full max-w-xl rounded-xl bg-surface",
          "shadow-2xl shadow-black/50 ring-1 ring-border",
        )}
      >
        <div className="flex items-start gap-2 px-4 pt-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="min-w-0 flex-1 bg-transparent py-1 text-lg font-medium text-foreground outline-none placeholder:text-muted-2"
          />
          <KeepIconBtn
            label={pinned ? "Unpin" : "Pin"}
            onClick={() => setPinned((p) => !p)}
          >
            <Pin
              className={cn("size-5", pinned && "fill-current text-primary")}
            />
          </KeepIconBtn>
        </div>
        <NoteBodyTextarea
          value={body}
          onChange={setBody}
          placeholder="Take a note…"
          rows={8}
          className="w-full resize-y bg-transparent px-4 py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-2"
        />
        <div className="px-4 pb-2">
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="Labels (comma separated)"
            className="w-full rounded-md bg-surface-2/60 px-3 py-1.5 text-xs text-muted outline-none ring-1 ring-border placeholder:text-muted-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center justify-between px-2 pb-3 pt-1">
          <div className="flex items-center gap-0.5">
            <KeepIconBtn label="Remind me" disabled>
              <Bell className="size-4" />
            </KeepIconBtn>
            <KeepIconBtn label="Background options" disabled>
              <Palette className="size-4" />
            </KeepIconBtn>
            <KeepIconBtn label="Delete note" onClick={() => void onDelete()}>
              <Trash2 className="size-4" />
            </KeepIconBtn>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleClose()}
            className="rounded-md px-4 py-1.5 text-sm font-medium text-foreground hover:bg-surface-2 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}

function KeepIconBtn({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full text-muted-2",
        "transition-colors hover:bg-surface-2 hover:text-foreground",
        "disabled:pointer-events-none disabled:opacity-35",
      )}
    >
      {children}
    </button>
  );
}
