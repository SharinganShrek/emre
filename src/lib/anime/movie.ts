import type { Movie, WatchStatus } from "@/lib/types";
import type { AnimeCatalog, AnimeDetails, AnimeSource } from "./types";
import { EMPTY_CATALOG } from "./types";

export const WATCH_LABELS: Record<WatchStatus, string> = {
  planned: "Plan to Watch",
  watching: "Watching",
  watched: "Completed",
};

export function isAnimeRow(movie: Movie): boolean {
  return movie.kind !== "movie" && movie.kind !== "series";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeCatalog(value: unknown): AnimeCatalog {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_CATALOG };
  }
  const row = value as AnimeCatalog;
  return {
    ...row,
    studios: asStringArray(row.studios),
    producers: asStringArray(row.producers),
    licensors: asStringArray(row.licensors),
    synonyms: asStringArray(row.synonyms),
    related: Array.isArray(row.related) ? row.related : [],
    openings: asStringArray(row.openings),
    endings: asStringArray(row.endings),
  };
}

export function normalizeMovie(row: Movie): Movie {
  const source: AnimeSource | null =
    row.source === "anilist" || row.source === "mal" ? row.source : null;
  return {
    ...row,
    kind: row.kind ?? "anime",
    source,
    external_id: row.external_id ?? null,
    image_url: row.image_url ?? null,
    title_english: row.title_english ?? null,
    title_japanese: row.title_japanese ?? null,
    anime_type: row.anime_type ?? null,
    episodes: asNumber(row.episodes),
    episodes_watched: asNumber(row.episodes_watched) ?? 0,
    year: asNumber(row.year),
    genres: asStringArray(row.genres),
    synopsis: row.synopsis ?? null,
    site_url: row.site_url ?? null,
    community_score: asNumber(row.community_score),
    airing_status: row.airing_status ?? null,
    catalog: normalizeCatalog(row.catalog),
  };
}

export function detailsToMovieFields(details: AnimeDetails) {
  return {
    title: details.title,
    kind: "anime" as const,
    source: details.source,
    external_id: details.external_id,
    image_url: details.image_url,
    title_english: details.title_english,
    title_japanese: details.title_japanese,
    anime_type: details.anime_type,
    episodes: details.episodes,
    year: details.year,
    genres: details.genres,
    synopsis: details.synopsis,
    site_url: details.site_url,
    community_score: details.community_score,
    airing_status: details.airing_status,
    catalog: details.catalog,
  };
}

export function movieCatalogFields(movie: Movie) {
  return {
    title: movie.title,
    kind: "anime" as const,
    source: (movie.source === "anilist" ? "anilist" : "mal") as AnimeSource,
    external_id: movie.external_id ?? null,
    image_url: movie.image_url ?? null,
    title_english: movie.title_english ?? null,
    title_japanese: movie.title_japanese ?? null,
    anime_type: movie.anime_type ?? null,
    episodes: movie.episodes ?? null,
    year: movie.year ?? null,
    genres: movie.genres ?? [],
    synopsis: movie.synopsis ?? null,
    site_url: movie.site_url ?? null,
    community_score: movie.community_score ?? null,
    airing_status: movie.airing_status ?? null,
    catalog: normalizeCatalog(movie.catalog),
  };
}

export function displayTitle(movie: Pick<Movie, "title" | "title_english">): string {
  return movie.title_english?.trim() || movie.title;
}

export function progressLabel(movie: Movie): string {
  const watched = movie.episodes_watched ?? 0;
  const total = movie.episodes;
  if (movie.status === "watched" && total != null) return `${total}/${total}`;
  if (total != null) return `${watched}/${total}`;
  return `${watched}/?`;
}

export function meanScore(items: Movie[]): number | null {
  const rated = items.filter((item) => item.rating != null);
  if (rated.length === 0) return null;
  const sum = rated.reduce((acc, item) => acc + (item.rating ?? 0), 0);
  return Number((sum / rated.length).toFixed(2));
}
