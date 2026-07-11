"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Heading1,
  Heading2,
  Type,
  CheckSquare,
  List,
  Quote,
  Minus,
  Trash2,
} from "lucide-react";
import { cn, uid } from "@/lib/utils";

export type BlockType =
  | "h1"
  | "h2"
  | "text"
  | "todo"
  | "bullet"
  | "quote"
  | "divider";

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
}

const PLACEHOLDER: Record<BlockType, string> = {
  h1: "Heading 1",
  h2: "Heading 2",
  text: "Type '/' for commands, or just write…",
  todo: "To-do",
  bullet: "List item",
  quote: "Quote",
  divider: "",
};

/** Markdown-ish shortcuts: "# " -> h1, "- " -> bullet, etc. */
function detectShortcut(text: string): BlockType | null {
  if (text === "# ") return "h1";
  if (text === "## ") return "h2";
  if (text === "- " || text === "* ") return "bullet";
  if (text === "[] " || text === "[ ] ") return "todo";
  if (text === "> ") return "quote";
  if (text === "---") return "divider";
  return null;
}

export function NotionEditor({
  storageKey,
  initialBlocks,
}: {
  storageKey: string;
  initialBlocks?: Block[];
}) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());
  const focusNext = useRef<string | null>(null);

  // Load persisted content or fall back to initial blocks.
  useEffect(() => {
    let loaded: Block[] | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) loaded = JSON.parse(raw) as Block[];
    } catch {
      /* ignore */
    }
    setBlocks(
      loaded && loaded.length > 0
        ? loaded
        : initialBlocks && initialBlocks.length > 0
          ? initialBlocks
          : [{ id: uid("blk"), type: "text", text: "" }],
    );
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist.
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(blocks));
    } catch {
      /* ignore */
    }
  }, [blocks, ready, storageKey]);

  // Focus a freshly created / targeted block.
  useEffect(() => {
    if (focusNext.current) {
      const el = refs.current.get(focusNext.current);
      if (el) {
        el.focus();
        // place caret at end
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      focusNext.current = null;
    }
  });

  const updateText = useCallback((id: string, text: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const shortcut = detectShortcut(text);
      if (shortcut && prev[idx].type === "text") {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          type: shortcut,
          text: "",
        };
        // Clear the DOM text so the shortcut chars disappear.
        const el = refs.current.get(id);
        if (el) el.innerText = "";
        return next;
      }
      const next = [...prev];
      next[idx] = { ...next[idx], text };
      return next;
    });
  }, []);

  const setType = useCallback((id: string, type: BlockType) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, type } : b)),
    );
  }, []);

  const toggleCheck = useCallback((id: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b)),
    );
  }, []);

  const addAfter = useCallback((id: string) => {
    const newId = uid("blk");
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, { id: newId, type: "text", text: "" });
      return next;
    });
    focusNext.current = newId;
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      if (prev.length === 1) return prev;
      const idx = prev.findIndex((b) => b.id === id);
      const next = prev.filter((b) => b.id !== id);
      const focusTarget = next[Math.max(0, idx - 1)];
      if (focusTarget) focusNext.current = focusTarget.id;
      return next;
    });
    refs.current.delete(id);
  }, []);

  if (!ready) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-surface-2" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activeId && (
        <FormatToolbar
          onSelect={(type) => {
            if (activeId) setType(activeId, type);
          }}
          onDelete={() => activeId && removeBlock(activeId)}
        />
      )}
      <div className="space-y-0.5">
        {blocks.map((block) => (
          <EditableBlock
            key={block.id}
            block={block}
            registerRef={(el) => {
              if (el) refs.current.set(block.id, el);
              else refs.current.delete(block.id);
            }}
            onFocus={() => setActiveId(block.id)}
            onChange={(text) => updateText(block.id, text)}
            onEnter={() => addAfter(block.id)}
            onEmptyBackspace={() => removeBlock(block.id)}
            onToggleCheck={() => toggleCheck(block.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FormatToolbar({
  onSelect,
  onDelete,
}: {
  onSelect: (type: BlockType) => void;
  onDelete: () => void;
}) {
  const items: { type: BlockType; icon: typeof Type; label: string }[] = [
    { type: "h1", icon: Heading1, label: "Heading 1" },
    { type: "h2", icon: Heading2, label: "Heading 2" },
    { type: "text", icon: Type, label: "Text" },
    { type: "todo", icon: CheckSquare, label: "To-do" },
    { type: "bullet", icon: List, label: "Bullet" },
    { type: "quote", icon: Quote, label: "Quote" },
    { type: "divider", icon: Minus, label: "Divider" },
  ];
  return (
    <div className="sticky top-14 z-10 mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface/95 p-1 backdrop-blur">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.type}
            type="button"
            title={it.label}
            // Prevent the editor block from losing focus/selection.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(it.type)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{it.label}</span>
          </button>
        );
      })}
      <div className="ml-auto">
        <button
          type="button"
          title="Delete block"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:bg-danger/15 hover:text-danger"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function EditableBlock({
  block,
  registerRef,
  onChange,
  onEnter,
  onEmptyBackspace,
  onFocus,
  onToggleCheck,
}: {
  block: Block;
  registerRef: (el: HTMLDivElement | null) => void;
  onChange: (text: string) => void;
  onEnter: () => void;
  onEmptyBackspace: () => void;
  onFocus: () => void;
  onToggleCheck: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Keep DOM text in sync only when it actually differs (prevents caret jumps).
  useEffect(() => {
    if (ref.current && ref.current.innerText !== block.text) {
      ref.current.innerText = block.text;
    }
  }, [block.text]);

  if (block.type === "divider") {
    return (
      <div
        className="group flex items-center py-2"
        tabIndex={0}
        ref={(el) => {
          ref.current = el as unknown as HTMLDivElement;
          registerRef(el as unknown as HTMLDivElement);
        }}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === "Backspace") {
            e.preventDefault();
            onEmptyBackspace();
          }
        }}
      >
        <hr className="w-full border-border-strong" />
      </div>
    );
  }

  const base =
    "outline-none w-full leading-relaxed focus:bg-surface/40 rounded px-1 -mx-1";
  const typeClass: Record<Exclude<BlockType, "divider">, string> = {
    h1: "text-2xl font-semibold mt-2",
    h2: "text-lg font-semibold mt-1",
    text: "text-[15px] text-foreground/90",
    todo: cn("text-[15px]", block.checked && "text-muted line-through"),
    bullet: "text-[15px] text-foreground/90",
    quote: "text-[15px] italic text-muted border-l-2 border-border-strong pl-3",
  };

  const editable = (
    <div
      ref={(el) => {
        ref.current = el;
        registerRef(el);
      }}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={PLACEHOLDER[block.type]}
      className={cn(base, typeClass[block.type as Exclude<BlockType, "divider">])}
      onFocus={onFocus}
      onInput={(e) => onChange(e.currentTarget.innerText)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onEnter();
        } else if (
          e.key === "Backspace" &&
          e.currentTarget.innerText.length === 0
        ) {
          e.preventDefault();
          onEmptyBackspace();
        }
      }}
    />
  );

  if (block.type === "todo") {
    return (
      <div className="group flex items-start gap-2 py-0.5">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggleCheck}
          className={cn(
            "mt-1 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
            block.checked
              ? "border-transparent bg-primary text-white"
              : "border-border-strong hover:border-muted-2",
          )}
          aria-label="Toggle to-do"
        >
          {block.checked && "✓"}
        </button>
        {editable}
      </div>
    );
  }

  if (block.type === "bullet") {
    return (
      <div className="flex items-start gap-2 py-0.5">
        <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted-2" />
        {editable}
      </div>
    );
  }

  return <div className="py-0.5">{editable}</div>;
}
