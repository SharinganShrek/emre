"use client";

import { useEffect, useState } from "react";
import { Plus, Clapperboard, Star, Trash2, Pencil } from "lucide-react";
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
import type { Movie, WatchStatus } from "@/lib/types";

const STATUS_VARIANT: Record<WatchStatus, BadgeProps["variant"]> = {
  planned: "default",
  watching: "warning",
  watched: "success",
};
const FILTERS: (WatchStatus | "all")[] = [
  "all",
  "watching",
  "planned",
  "watched",
];

export default function MoviesPage() {
  return (
    <Hydrated>
      <Movies />
    </Hydrated>
  );
}

function Movies() {
  const { data, add, update, remove } = useHub();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Movie | null>(null);
  const [filter, setFilter] = useState<WatchStatus | "all">("all");

  const items = data.movies.filter(
    (m) => filter === "all" || m.status === filter,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Movies & Anime"
        description="Your watched list, ratings, and reviews."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus /> Add title
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
            {f}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="Nothing here yet"
          description="Add an anime or movie to your list."
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> Add title
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{m.title}</p>
                    <p className="mt-0.5 text-xs capitalize text-muted-2">
                      {m.kind}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[m.status]}>{m.status}</Badge>
                </div>
                {m.rating != null && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-warning">
                    <Star className="size-4 fill-current" />
                    <span className="font-semibold">{m.rating}</span>
                    <span className="text-muted-2">/10</span>
                  </div>
                )}
                {m.review && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted">
                    {m.review}
                  </p>
                )}
                {m.watched_date && (
                  <p className="mt-2 text-xs text-muted-2">
                    Watched {m.watched_date}
                  </p>
                )}
                <div className="mt-3 flex justify-end gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Edit"
                    onClick={() => {
                      setEditing(m);
                      setOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Delete"
                    onClick={() => remove("movies", m.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MovieDialog
        open={open}
        onClose={() => setOpen(false)}
        movie={editing}
        onSave={(v) => {
          if (editing) {
            update("movies", editing.id, v);
          } else {
            add("movies", {
              user_id: data.profile.user_id,
              ...v,
            });
          }
          setOpen(false);
        }}
      />
    </div>
  );
}

function MovieDialog({
  open,
  onClose,
  movie,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  movie: Movie | null;
  onSave: (v: {
    title: string;
    kind: "anime" | "movie" | "series";
    status: WatchStatus;
    rating: number | null;
    review: string | null;
    watched_date: string | null;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"anime" | "movie" | "series">("anime");
  const [status, setStatus] = useState<WatchStatus>("planned");
  const [rating, setRating] = useState(8);
  const [review, setReview] = useState("");
  const [watchedDate, setWatchedDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(movie?.title ?? "");
    setKind(movie?.kind ?? "anime");
    setStatus(movie?.status ?? "planned");
    setRating(movie?.rating ?? 8);
    setReview(movie?.review ?? "");
    setWatchedDate(movie?.watched_date ?? "");
    setError(null);
  }, [open, movie]);

  return (
    <Dialog open={open} onClose={onClose} title={movie ? "Edit title" : "Add title"}>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Frieren"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Kind</Label>
            <Select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as "anime" | "movie" | "series")
              }
            >
              <option value="anime">Anime</option>
              <option value="movie">Movie</option>
              <option value="series">Series</option>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as WatchStatus)}
            >
              <option value="planned">Planned</option>
              <option value="watching">Watching</option>
              <option value="watched">Watched</option>
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
            <Label>Watched date</Label>
            <Input
              type="date"
              value={watchedDate}
              onChange={(e) => setWatchedDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>Review</Label>
          <Textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="What did you think?"
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
                kind,
                status,
                rating: status === "planned" ? null : rating,
                review: review || null,
                watched_date: watchedDate || null,
              });
            }}
          >
            {movie ? "Save" : "Add"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
