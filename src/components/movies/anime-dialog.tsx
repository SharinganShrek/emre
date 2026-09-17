"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { AnimePoster } from "@/components/movies/poster";
import { getAnimeArchive, searchAnimeArchive } from "@/lib/anime/client";
import { ANIME_SOURCES, type AnimeDetails, type AnimeSource } from "@/lib/anime";
import { detailsToMovieFields, movieCatalogFields, WATCH_LABELS } from "@/lib/anime/movie";
import type { Movie, WatchStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AnimeSaveValues = ReturnType<typeof movieCatalogFields> & {
  status: WatchStatus;
  rating: number | null;
  review: string | null;
  watched_date: string | null;
  episodes_watched: number;
};

export function AnimeDialog({
  open,
  onClose,
  movie,
  saving,
  existing,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  movie: Movie | null;
  saving: boolean;
  existing: Movie[];
  onSave: (values: AnimeSaveValues) => void | Promise<void>;
}) {
  const editing = Boolean(movie);
  const [source, setSource] = useState<AnimeSource>("anilist");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Awaited<ReturnType<typeof searchAnimeArchive>>>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selected, setSelected] = useState<AnimeDetails | null>(null);
  const [status, setStatus] = useState<WatchStatus>("planned");
  const [rating, setRating] = useState(8);
  const [hasRating, setHasRating] = useState(true);
  const [review, setReview] = useState("");
  const [watchedDate, setWatchedDate] = useState("");
  const [episodesWatched, setEpisodesWatched] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const catalog = selected ?? null;
  const totalEpisodes = catalog?.episodes ?? movie?.episodes ?? null;

  useEffect(() => {
    if (!open) return;
    setSource(
      movie?.source === "mal"
        ? "mal"
        : movie?.source === "anilist"
          ? "anilist"
          : "anilist",
    );
    setQuery("");
    setHits([]);
    setSearchError(null);
    setSelected(null);
    setStatus(movie?.status ?? "planned");
    setRating(movie?.rating ?? 8);
    setHasRating(movie ? movie.rating != null : true);
    setReview(movie?.review ?? "");
    setWatchedDate(movie?.watched_date ?? "");
    setEpisodesWatched(movie?.episodes_watched ?? 0);
    setError(null);
    setLoadingDetails(false);
  }, [open, movie]);

  useEffect(() => {
    if (!open || editing) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const seq = ++requestSeq.current;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void searchAnimeArchive(source, q)
        .then((data) => {
          if (seq !== requestSeq.current) return;
          setHits(data);
        })
        .catch((err: unknown) => {
          if (seq !== requestSeq.current) return;
          setHits([]);
          setSearchError(
            err instanceof Error ? err.message : "Search failed.",
          );
        })
        .finally(() => {
          if (seq === requestSeq.current) setSearching(false);
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, source, open, editing]);

  useEffect(() => {
    if (status === "watched" && totalEpisodes != null) {
      setEpisodesWatched(totalEpisodes);
    }
    if (status === "planned") setEpisodesWatched(0);
  }, [status, totalEpisodes]);

  async function pickHit(hit: (typeof hits)[number]) {
    setSelected({
      ...hit,
      synopsis: null,
      site_url: null,
      catalog: {},
    });
    setQuery(hit.title);
    setHits([]);
    setLoadingDetails(true);
    setError(null);
    try {
      const details = await getAnimeArchive(source, hit.external_id);
      setSelected(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load that title.");
    } finally {
      setLoadingDetails(false);
    }
  }

  function alreadyListed(externalId: string, src: AnimeSource) {
    return existing.some(
      (item) =>
        item.id !== movie?.id &&
        item.source === src &&
        item.external_id === externalId,
    );
  }

  function submit() {
    if (!editing && !selected) {
      setError("Pick a title from the archive search.");
      return;
    }
    if (selected && alreadyListed(selected.external_id, selected.source)) {
      setError("That title is already on your list.");
      return;
    }
    const fields = selected
      ? detailsToMovieFields(selected)
      : movie
        ? movieCatalogFields(movie)
        : null;
    if (!fields) {
      setError("Pick a title from the archive search.");
      return;
    }

    const maxEp = fields.episodes;
    let progress = episodesWatched;
    if (status === "planned") progress = 0;
    if (status === "watched" && maxEp != null) progress = maxEp;
    if (maxEp != null) progress = Math.min(progress, maxEp);
    progress = Math.max(0, progress);

    void onSave({
      ...fields,
      status,
      rating: hasRating ? rating : null,
      review: review.trim() || null,
      watched_date: watchedDate || null,
      episodes_watched: progress,
    });
  }

  const dateLabel =
    status === "watched"
      ? "Completed date"
      : status === "watching"
        ? "Started date"
        : "Date";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit anime" : "Add anime"}
      description={
        editing
          ? "Update your score, date, and progress."
          : "Search an archive, pick a title, then add your score and date."
      }
      className="max-w-2xl"
    >
      <div className="space-y-3">
        {!editing && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Archive</Label>
                <Select
                  value={source}
                  disabled={saving || loadingDetails}
                  onChange={(e) => {
                    setSource(e.target.value as AnimeSource);
                    setSelected(null);
                    setHits([]);
                  }}
                >
                  {ANIME_SOURCES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Search title</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-2" />
                  <Input
                    autoFocus
                    value={query}
                    disabled={saving || loadingDetails}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelected(null);
                    }}
                    placeholder="e.g. Frieren"
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
            {searching && (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="size-3.5 animate-spin" /> Searching…
              </p>
            )}
            {searchError && (
              <p className="text-sm text-danger">{searchError}</p>
            )}
            {hits.length > 0 && !selected && (
              <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {hits.map((hit) => {
                  const listed = alreadyListed(hit.external_id, hit.source);
                  return (
                    <li key={`${hit.source}-${hit.external_id}`}>
                      <button
                        type="button"
                        disabled={listed || loadingDetails}
                        onClick={() => void pickHit(hit)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2",
                          listed && "opacity-50",
                        )}
                      >
                        <AnimePoster
                          src={hit.image_url}
                          alt=""
                          className="size-12 shrink-0 rounded-md"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {hit.title}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {[hit.title_english, hit.anime_type, hit.year]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-2">
                          {listed ? (
                            "On list"
                          ) : hit.community_score != null ? (
                            <span className="font-medium text-warning">
                              {hit.community_score.toFixed(2)}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {(selected || editing) && (
          <SelectedPreview
            title={selected?.title ?? movie?.title ?? ""}
            english={selected?.title_english ?? movie?.title_english}
            japanese={selected?.title_japanese ?? movie?.title_japanese}
            image={selected?.image_url ?? movie?.image_url}
            type={selected?.anime_type ?? movie?.anime_type}
            episodes={totalEpisodes}
            year={selected?.year ?? movie?.year}
            score={selected?.community_score ?? movie?.community_score}
            genres={selected?.genres ?? movie?.genres ?? []}
            synopsis={selected?.synopsis ?? movie?.synopsis}
          />
        )}

        {loadingDetails && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="size-3.5 animate-spin" /> Loading catalog details…
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Status</Label>
            <Select
              value={status}
              disabled={saving}
              onChange={(e) => setStatus(e.target.value as WatchStatus)}
            >
              {(Object.keys(WATCH_LABELS) as WatchStatus[]).map((key) => (
                <option key={key} value={key}>
                  {WATCH_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{dateLabel}</Label>
            <Input
              type="date"
              value={watchedDate}
              disabled={saving}
              onChange={(e) => setWatchedDate(e.target.value)}
            />
          </div>
        </div>

        {status === "watching" && (
          <div>
            <Label>
              Progress
              {totalEpisodes != null ? ` (${episodesWatched}/${totalEpisodes})` : ""}
            </Label>
            <Input
              type="number"
              min={0}
              max={totalEpisodes ?? undefined}
              value={episodesWatched}
              disabled={saving}
              onChange={(e) =>
                setEpisodesWatched(Math.max(0, Number(e.target.value) || 0))
              }
            />
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="mb-0">
              Your score{hasRating ? `: ${rating}/10` : ""}
            </Label>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={hasRating}
                onChange={(e) => setHasRating(e.target.checked)}
              />
              Rate
            </label>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={rating}
            disabled={saving || !hasRating}
            onChange={(e) => setRating(Number(e.target.value))}
            className="w-full accent-[var(--primary)] disabled:opacity-40"
          />
        </div>

        <div>
          <Label>Review (optional)</Label>
          <Textarea
            value={review}
            disabled={saving}
            onChange={(e) => setReview(e.target.value)}
            placeholder="What did you think?"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving || loadingDetails || (!editing && !selected)}
            onClick={submit}
          >
            {saving ? "Saving…" : editing ? "Save" : "Add to list"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function SelectedPreview({
  title,
  english,
  japanese,
  image,
  type,
  episodes,
  year,
  score,
  genres,
  synopsis,
}: {
  title: string;
  english?: string | null;
  japanese?: string | null;
  image?: string | null;
  type?: string | null;
  episodes?: number | null;
  year?: number | null;
  score?: number | null;
  genres: string[];
  synopsis?: string | null;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-surface-2/60 p-3">
      <AnimePoster src={image} alt="" className="h-[7.5rem] w-[5.25rem] shrink-0" />
      <div className="min-w-0">
        <p className="font-medium leading-tight">{title}</p>
        {(english || japanese) && (
          <p className="mt-0.5 truncate text-xs text-muted">
            {[english, japanese].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-2">
          {[type, episodes != null ? `${episodes} eps` : null, year]
            .filter(Boolean)
            .join(" · ")}
          {score != null ? ` · Score ${score.toFixed(2)}` : ""}
        </p>
        {genres.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted">{genres.join(", ")}</p>
        )}
        {synopsis && (
          <p className="mt-1 line-clamp-3 text-xs text-muted">{synopsis}</p>
        )}
      </div>
    </div>
  );
}
