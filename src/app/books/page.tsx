"use client";

import { useEffect, useState } from "react";
import { Plus, BookOpen, Star, Trash2, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Hydrated } from "@/components/hydrated";
import { useHub } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Book, BookStatus } from "@/lib/types";

const STATUS_VARIANT: Record<BookStatus, BadgeProps["variant"]> = {
  to_read: "default",
  reading: "warning",
  read: "success",
};
const FILTERS: (BookStatus | "all")[] = ["all", "reading", "to_read", "read"];

export default function BooksPage() {
  return (
    <Hydrated>
      <Books />
    </Hydrated>
  );
}

function Books() {
  const { data, add, update, remove } = useHub();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [filter, setFilter] = useState<BookStatus | "all">("all");

  const items = data.books.filter(
    (b) => filter === "all" || b.status === filter,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Books"
        description="Your reading list, ratings, and reviews."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Add book
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm capitalize transition-colors",
              filter === f
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No books yet"
          description="Add a book to your reading list."
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> Add book
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {items.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                  <BookOpen className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{b.title}</p>
                    <Badge variant={STATUS_VARIANT[b.status]}>
                      {b.status.replace("_", " ")}
                    </Badge>
                  </div>
                  {b.author && (
                    <p className="truncate text-xs text-muted-2">{b.author}</p>
                  )}
                  {b.review && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {b.review}
                    </p>
                  )}
                </div>
                {b.rating != null && (
                  <div className="flex items-center gap-1 text-sm text-warning">
                    <Star className="size-4 fill-current" />
                    <span className="font-semibold">{b.rating}</span>
                  </div>
                )}
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit"
                    onClick={() => {
                      setEditing(b);
                      setOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete"
                    onClick={() => remove("books", b.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BookDialog
        open={open}
        onClose={() => setOpen(false)}
        book={editing}
        onSave={(v) => {
          if (editing) update("books", editing.id, v);
          else add("books", { user_id: data.profile.user_id, ...v });
          setOpen(false);
        }}
      />
    </div>
  );
}

function BookDialog({
  open,
  onClose,
  book,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  book: Book | null;
  onSave: (v: {
    title: string;
    author: string | null;
    status: BookStatus;
    rating: number | null;
    review: string | null;
    finished_date: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<BookStatus>("to_read");
  const [rating, setRating] = useState(8);
  const [review, setReview] = useState("");
  const [finishedDate, setFinishedDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(book?.title ?? "");
    setAuthor(book?.author ?? "");
    setStatus(book?.status ?? "to_read");
    setRating(book?.rating ?? 8);
    setReview(book?.review ?? "");
    setFinishedDate(book?.finished_date ?? "");
    setError(null);
  }, [open, book]);

  return (
    <Dialog open={open} onClose={onClose} title={book ? "Edit book" : "Add book"}>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Atomic Habits"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Author</Label>
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="James Clear"
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as BookStatus)}
            >
              <option value="to_read">To read</option>
              <option value="reading">Reading</option>
              <option value="read">Read</option>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Rating: {rating}/10</Label>
            <input
              type="range"
              min={0}
              max={10}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </div>
          <div>
            <Label>Finished date</Label>
            <Input
              type="date"
              value={finishedDate}
              onChange={(e) => setFinishedDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>Review</Label>
          <Textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Your thoughts"
          />
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
                author: author || null,
                status,
                rating: status === "read" ? rating : null,
                review: review || null,
                finished_date: finishedDate || null,
              });
            }}
          >
            {book ? "Save" : "Add"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
