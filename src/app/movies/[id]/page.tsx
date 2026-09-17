"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Hydrated } from "@/components/hydrated";
import { AnimePoster } from "@/components/movies/poster";
import { AnimeDialog, type AnimeSaveValues } from "@/components/movies/anime-dialog";
import { getAnimeArchive } from "@/lib/anime/client";
import type { AnimeDetails } from "@/lib/anime";
import {
  detailsToMovieFields,
  displayTitle,
  isAnimeRow,
  normalizeMovie,
  progressLabel,
  WATCH_LABELS,
} from "@/lib/anime/movie";
import { useHub } from "@/lib/store";
import { withToast } from "@/lib/toast";
import type { Movie, WatchStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<WatchStatus, BadgeProps["variant"]> = {
  planned: "default",
  watching: "warning",
  watched: "success",
};

export default function AnimeDetailPage() {
  return (
    <Hydrated>
      <AnimeDetail />
    </Hydrated>
  );
}

function AnimeDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, update, remove } = useHub();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [live, setLive] = useState<AnimeDetails | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const anime = useMemo(
    () => data.movies.map(normalizeMovie).filter(isAnimeRow),
    [data.movies],
  );
  const movie = anime.find((item) => item.id === params.id) ?? null;

  useEffect(() => {
    if (!movie?.source || !movie.external_id) {
      setLive(null);
      return;
    }
    let cancelled = false;
    void getAnimeArchive(movie.source, movie.external_id)
      .then((details) => {
        if (!cancelled) setLive(details);
      })
      .catch(() => {
        if (!cancelled) setLive(null);
      });
    return () => {
      cancelled = true;
    };
  }, [movie?.id, movie?.source, movie?.external_id]);

  if (!movie) {
    return (
      <EmptyState
        title="Anime not found"
        description="This title is not on your list."
        action={
          <Link href="/movies">
            <Button size="sm">
              <ArrowLeft /> Back to list
            </Button>
          </Link>
        }
      />
    );
  }

  const catalog = live?.catalog ?? movie.catalog ?? {};
  const title = live?.title ?? movie.title;
  const english = live?.title_english ?? movie.title_english;
  const japanese = live?.title_japanese ?? movie.title_japanese;
  const image = live?.image_url ?? movie.image_url;
  const synopsis = live?.synopsis ?? movie.synopsis;
  const genres = live?.genres?.length ? live.genres : movie.genres ?? [];
  const community = live?.community_score ?? movie.community_score;
  const siteUrl = live?.site_url ?? movie.site_url;
  const animeType = live?.anime_type ?? movie.anime_type;
  const episodes = live?.episodes ?? movie.episodes;
  const year = live?.year ?? movie.year;
  const airing = live?.airing_status ?? movie.airing_status;
  const related = catalog.related ?? [];
  const archiveLabel = movie.source === "anilist" ? "AniList" : "MyAnimeList";

  async function saveAnime(values: AnimeSaveValues) {
    if (!movie) return;
    setSaving(true);
    const ok = await withToast(() => update("movies", movie.id, values), {
      loading: "Saving…",
      success: "Anime updated",
    });
    setSaving(false);
    if (ok) setOpen(false);
  }

  async function refreshCatalog() {
    if (!movie?.source || !movie.external_id) return;
    setRefreshing(true);
    const ok = await withToast(
      async () => {
        const details = await getAnimeArchive(movie.source!, movie.external_id!);
        setLive(details);
        await update("movies", movie.id, detailsToMovieFields(details));
      },
      { loading: "Refreshing…", success: "Catalog details updated" },
    );
    setRefreshing(false);
    return ok;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/movies"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Anime list
        </Link>
        <div className="flex gap-1.5">
          {movie.source && movie.external_id && (
            <Button
              size="sm"
              variant="outline"
              disabled={refreshing}
              onClick={() => void refreshCatalog()}
            >
              <RefreshCw className={cn(refreshing && "animate-spin")} />
              Refresh
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <Pencil /> Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              void withToast(
                async () => {
                  await remove("movies", movie.id);
                  router.push("/movies");
                },
                { success: "Removed from list" },
              )
            }
          >
            <Trash2 /> Remove
          </Button>
        </div>
      </div>

      {catalog.banner_image && (
        <div className="overflow-hidden rounded-2xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={catalog.banner_image}
            alt=""
            className="h-36 w-full object-cover sm:h-48"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <AnimePoster
            src={image}
            alt={title}
            className="mx-auto aspect-[225/318] w-48 lg:w-full"
          />
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
              Your list
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <InfoRow
                label="Status"
                value={
                  <Badge variant={STATUS_VARIANT[movie.status]}>
                    {WATCH_LABELS[movie.status]}
                  </Badge>
                }
              />
              <InfoRow
                label="Score"
                value={
                  movie.rating != null ? (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <Star className="size-3.5 fill-current" />
                      {movie.rating}/10
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow label="Progress" value={progressLabel(movie)} />
              <InfoRow
                label={movie.status === "watched" ? "Completed" : "Date"}
                value={movie.watched_date ?? "—"}
              />
            </dl>
            {movie.review && (
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted">
                {movie.review}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">
              Information
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <InfoRow label="Type" value={animeType ?? "—"} />
              <InfoRow
                label="Episodes"
                value={episodes != null ? String(episodes) : "Unknown"}
              />
              <InfoRow label="Status" value={airing ?? "—"} />
              <InfoRow label="Aired" value={catalog.aired_text ?? year ?? "—"} />
              <InfoRow label="Premiered" value={catalog.season ?? "—"} />
              <InfoRow label="Broadcast" value={catalog.broadcast ?? "—"} />
              <InfoRow
                label="Producers"
                value={joinList(catalog.producers)}
              />
              <InfoRow
                label="Licensors"
                value={joinList(catalog.licensors)}
              />
              <InfoRow label="Studios" value={joinList(catalog.studios)} />
              <InfoRow
                label="Source"
                value={catalog.source_material ?? "—"}
              />
              <InfoRow label="Genres" value={joinList(genres)} />
              <InfoRow label="Duration" value={catalog.duration ?? "—"} />
              <InfoRow label="Rating" value={catalog.rating_pg ?? "—"} />
            </dl>
          </div>
        </aside>

        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {displayTitle({ title, title_english: english })}
            </h1>
            <p className="mt-1 text-sm text-muted">{title}</p>
            {japanese && (
              <p className="text-sm text-muted-2">{japanese}</p>
            )}
            {siteUrl && (
              <a
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View on {archiveLabel}
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ScoreBox
              label="Score"
              value={community != null ? community.toFixed(2) : "N/A"}
              hint="Archive score"
            />
            <ScoreBox
              label="Ranked"
              value={catalog.rank != null ? `#${catalog.rank}` : "N/A"}
            />
            <ScoreBox
              label="Popularity"
              value={
                catalog.popularity != null ? `#${catalog.popularity}` : "N/A"
              }
            />
            <ScoreBox
              label="Members"
              value={
                catalog.members != null
                  ? catalog.members.toLocaleString()
                  : "N/A"
              }
            />
          </div>

          {catalog.synonyms && catalog.synonyms.length > 0 && (
            <Section title="Alternative titles">
              <p className="text-sm text-muted">{catalog.synonyms.join(", ")}</p>
            </Section>
          )}

          <Section title="Synopsis">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {synopsis || "No synopsis yet."}
            </p>
          </Section>

          {catalog.background && (
            <Section title="Background">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {catalog.background}
              </p>
            </Section>
          )}

          {trailerSrc(catalog.trailer_embed ?? catalog.trailer_url) && (
            <Section title="Trailer">
              <div className="overflow-hidden rounded-xl border border-border bg-black">
                <iframe
                  title={`${title} trailer`}
                  src={trailerSrc(catalog.trailer_embed ?? catalog.trailer_url)!}
                  className="aspect-video w-full"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </Section>
          )}

          {related.length > 0 && (
            <Section title="Related anime">
              <ul className="space-y-1.5 text-sm">
                {related.map((item) => {
                  const listed = anime.find(
                    (row) =>
                      row.source === movie.source &&
                      row.external_id === item.external_id,
                  );
                  return (
                    <li
                      key={`${item.relation}-${item.external_id}-${item.title}`}
                      className="flex flex-wrap gap-x-2"
                    >
                      <span className="text-muted-2">{item.relation}:</span>
                      {listed ? (
                        <Link
                          href={`/movies/${listed.id}`}
                          className="text-primary hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <span>{item.title}</span>
                      )}
                      {item.type && (
                        <span className="text-muted-2">({item.type})</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {(catalog.openings?.length || catalog.endings?.length) && (
            <Section title="Theme songs">
              {catalog.openings && catalog.openings.length > 0 && (
                <ThemeList label="Openings" items={catalog.openings} />
              )}
              {catalog.endings && catalog.endings.length > 0 && (
                <ThemeList label="Endings" items={catalog.endings} />
              )}
            </Section>
          )}
        </div>
      </div>

      <AnimeDialog
        open={open}
        onClose={() => !saving && setOpen(false)}
        movie={movie}
        saving={saving}
        existing={anime}
        onSave={saveAnime}
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ScoreBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-2">{hint}</p>}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-2">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}

function ThemeList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs font-medium text-muted-2">{label}</p>
      <ul className="mt-1 space-y-1 text-sm text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function joinList(items?: string[] | null) {
  if (!items || items.length === 0) return "—";
  return items.join(", ");
}

function trailerSrc(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be")
    ) {
      const id =
        parsed.searchParams.get("v") ||
        parsed.pathname.split("/").filter(Boolean).pop();
      if (!id) return null;
      return `https://www.youtube-nocookie.com/embed/${id}`;
    }
    return url;
  } catch {
    return null;
  }
}
