"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, NotebookPen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NotionEditor, type Block } from "./editor";
import { cn } from "@/lib/utils";

/**
 * A collapsible, Notion-style editable notes area that any page can embed.
 * This is what makes every non-dashboard page "editable and formattable".
 */
export function PageNotes({
  storageKey,
  title = "Notes",
  initialBlocks,
  defaultOpen = true,
}: {
  storageKey: string;
  title?: string;
  initialBlocks?: Block[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-5 py-4 text-left"
      >
        {open ? (
          <ChevronDown className="size-4 text-muted-2" />
        ) : (
          <ChevronRight className="size-4 text-muted-2" />
        )}
        <NotebookPen className="size-4 text-muted-2" />
        <span className="text-sm font-semibold">{title}</span>
        <span className="ml-auto text-xs text-muted-2">
          Editable · type “/” shortcuts
        </span>
      </button>
      <CardContent className={cn("pt-0", !open && "hidden")}>
        <NotionEditor storageKey={storageKey} initialBlocks={initialBlocks} />
      </CardContent>
    </Card>
  );
}
