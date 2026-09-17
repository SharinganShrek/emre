"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Star,
  Trash2,
  Pencil,
  Search,
  Clapperboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Input, Select } from "@/components/ui/input";
import { Hydrated } from "@/components/hydrated";
import { AnimePoster } from "@/components/movies/poster";
import { AnimeDialog, type AnimeSaveValues } from "@/components/movies/anime-dialog";
import { useHub } from "@/lib/store";
import { withToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { Movie, WatchStatus } from "@/lib/types";
import {
  displayTitle,
  isAnimeRow,
  meanScore,
  normalizeMovie,
  progressLabel,
  WATCH_LABELS,
} from "@/lib/anime/movie";

const STATUS_VARIANT: Record<WatchStatus, BadgeProps["variant"]> = {
  planned: "default",
  watching: "warning",
  watched: "success",
};

const FILTERS: (WatchStatus | "all")[] = [
  "all",
  "watching",
  "watched",
  "planned",
];

type SortKey = "updated" | "title" | "score" | "progress";

export default function AnimeListPage() {
  return (
    <Hydrated>
      <AnimeList />
    </Hydrated>
  );
}

function AnimeList() {
  const { data, add, update, remove } = useHub();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Movie | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<WatchStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [q, setQ] = useState("");

  const anime = useMemo(
    () => data.movies.map(normalizeMovie).filter(isAnimeRow),
    [data.movies],
  );

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = anime.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      if (!needle) return true;
      const hay = [
        item.title,
        item.title_english,
        item.title_japanese,
        ...(item.genres ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sort === "title") {
        return displayTitle(a).localeCompare(displayTitle(b));
      }
      if (sort === "score") {
        return (b.rating ?? -1) - (a.rating ?? -1);
      }
      if (sort === "progress") {
        const ap = a.status === "watched" ? a.episodes ?? 0 : a.episodes_watched ?? 0;
        const bp = b.status === "watched" ? b.episodes ?? 0 : b.episodes_watched ?? 0;
        return bp - ap;
      }
      return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
    });
    return sorted;
  }, [anime, filter, q, sort]);

  const watching = anime.filter((item) => item.status === "watching").length;
  const completed = anime.filter((item) => item.status === "watched").length;
  const planned = anime.filter((item) => item.status === "planned").length;
  const mean = meanScore(anime);

  async function saveAnime(values: AnimeSaveValues) {
    setSaving(true);
    let createdId: string | null = null;
    const ok = await withToast(
      async () => {
        if (editing) {
          await update("movies", editing.id, values);
        } else {
          const row = await add("movies", {
            user_id: data.profile.user_id,
            ...values,
          });
          createdId = row.id;
        }
      },
      {
        loading: editing ? "Saving…" : "Adding anime…",
        success: editing ? "Anime updated" : "Added to your list",
      },
    );
    setSaving(false);
    if (!ok) return;
    setOpen(false);
    if (createdId) router.push(`/movies/${createdId}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anime"
        description="Your list, pulled from MyAnimeList or AniList."
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

      <div className="grid gap-3 sm:grid-cols-4">
        <StatPill label="Watching" value={watching} />
        <StatPill label="Completed" value={completed} />
        <StatPill label="Plan to Watch" value={planned} />
        <StatPill label="Mean score" value={mean ?? "—"} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                filter === f
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f === "all" ? "All" : WATCH_LABELS[f]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter your list"
              className="pl-8"
            />
          </div>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="w-[10rem]"
          >
            <option value="updated">Last updated</option>
            <option value="title">Title</option>
            <option value="score">Score</option>
            <option value="progress">Progress</option>
          </Select>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title={anime.length === 0 ? "Nothing here yet" : "No matches"}
          description={
            anime.length === 0
              ? "Search MyAnimeList or AniList and add an anime to your list."
              : "Try a different status or search."
          }
          action={
            anime.length === 0 ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus /> Add title
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          {items.map((item, index) => (
            <AnimeRow
              key={item.id}
              movie={item}
              last={index === items.length - 1}
              onEdit={() => {
                setEditing(item);
                setOpen(true);
              }}
              onDelete={() =>
                void withToast(() => remove("movies", item.id), {
                  success: "Removed from list",
                })
              }
            />
          ))}
        </div>
      )}

      <AnimeDialog
        open={open}
        onClose={() => !saving && setOpen(false)}
        movie={editing}
        saving={saving}
        existing={anime}
        onSave={saveAnime}
      />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function AnimeRow({
  movie,
  last,
  onEdit,
  onDelete,
}: {
  movie: Movie;
  last: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 p-3 hover:bg-card-hover/60 sm:items-center sm:gap-4 sm:px-4",
        !last && "border-b border-border",
      )}
    >
      <Link href={`/movies/${movie.id}`} className="shrink-0">
        <AnimePoster
          src={movie.image_url}
          alt=""
          className="h-[4.75rem] w-[3.35rem] sm:h-[5.5rem] sm:w-[3.85rem]"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/movies/${movie.id}`}
              className="font-medium leading-tight hover:text-primary"
            >
              {displayTitle(movie)}
            </Link>
            {movie.title_english && movie.title_english !== movie.title && (
              <p className="truncate text-xs text-muted">{movie.title}</p>
            )}
            <p className="mt-1 text-xs text-muted-2">
              {[movie.anime_type, movie.year, movie.episodes != null ? `${movie.episodes} eps` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[movie.status]}>
            {WATCH_LABELS[movie.status]}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-muted">
            Progress{" "}
            <span className="font-medium text-foreground">
              {progressLabel(movie)}
            </span>
          </span>
          {movie.rating != null && (
            <span className="flex items-center gap-1 text-warning">
              <Star className="size-3.5 fill-current" />
              <span className="font-semibold">{movie.rating}</span>
              <span className="text-muted-2">/10</span>
            </span>
          )}
          {movie.community_score != null && (
            <span className="text-xs text-muted-2">
              Archive {movie.community_score.toFixed(2)}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col justify-center gap-1">
        <Button size="icon" variant="ghost" aria-label="Edit" onClick={onEdit}>
          <Pencil />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Delete" onClick={onDelete}>
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}
