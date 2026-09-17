import { cacheGet, cacheSet } from "./cache";
import type { AnimeCatalog, AnimeDetails, AnimeRelated, AnimeSearchHit } from "./types";

const JIKAN_BASE = "https://api.jikan.moe/v4";
const USER_AGENT = "EmreOS/1.0 (personal anime list)";
const SEARCH_TTL = 10 * 60 * 1000;
const DETAILS_TTL = 60 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function namesFromNodes(value: unknown): string[] {
  return asArray(value)
    .map((item) => asString(asRecord(item)?.name))
    .filter((name): name is string => Boolean(name));
}

async function jikanFetch(path: string): Promise<unknown> {
  const url = `${JIKAN_BASE}${path}`;
  const retryable = new Set([429, 500, 502, 503, 504]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      cache: "no-store",
    });
    if (retryable.has(res.status) && attempt < 2) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "0");
      const waitMs = Math.max(
        retryAfter * 1000,
        700 * (attempt + 1),
      );
      await sleep(Math.min(waitMs, 4000));
      continue;
    }
    if (!res.ok) {
      if (res.status === 429 || res.status >= 500) {
        throw new Error(
          "MyAnimeList is busy right now. Wait a few seconds or switch the archive to AniList.",
        );
      }
      throw new Error(`MyAnimeList archive returned ${res.status}`);
    }
    return res.json();
  }
  throw new Error(
    "MyAnimeList is busy right now. Wait a few seconds or switch the archive to AniList.",
  );
}

function mapSearchHit(row: Record<string, unknown>): AnimeSearchHit | null {
  const id = asNumber(row.mal_id);
  const title = asString(row.title);
  if (id == null || !title) return null;
  const images = asRecord(row.images);
  const jpg = asRecord(images?.jpg);
  const webp = asRecord(images?.webp);
  return {
    source: "mal",
    external_id: String(id),
    title,
    title_english: asString(row.title_english),
    title_japanese: asString(row.title_japanese),
    image_url:
      asString(webp?.large_image_url) ??
      asString(jpg?.large_image_url) ??
      asString(jpg?.image_url),
    anime_type: asString(row.type),
    episodes: asNumber(row.episodes),
    year: yearFromAired(row),
    community_score: asNumber(row.score),
    airing_status: asString(row.status),
    genres: namesFromNodes(row.genres),
  };
}

function isoDay(value: unknown): string | null {
  const iso = asString(value);
  return iso ? iso.slice(0, 10) : null;
}

function relatedFromJikan(value: unknown): AnimeRelated[] {
  const related: AnimeRelated[] = [];
  for (const group of asArray(value)) {
    const rec = asRecord(group);
    const relation = asString(rec?.relation) ?? "Related";
    for (const entry of asArray(rec?.entry)) {
      const item = asRecord(entry);
      const id = asNumber(item?.mal_id);
      const title = asString(item?.name);
      if (id == null || !title) continue;
      related.push({
        relation,
        title,
        external_id: String(id),
        type: asString(item?.type),
      });
    }
  }
  return related;
}

function catalogFromJikan(row: Record<string, unknown>): AnimeCatalog {
  const aired = asRecord(row.aired);
  const trailer = asRecord(row.trailer);
  const broadcast = asRecord(row.broadcast);
  const theme = asRecord(row.theme);
  const season = asString(row.season);
  const year = asNumber(row.year);
  return {
    duration: asString(row.duration),
    aired_from: isoDay(aired?.from),
    aired_to: isoDay(aired?.to),
    aired_text: asString(aired?.string),
    season: season && year != null ? `${capitalize(season)} ${year}` : season,
    broadcast: asString(broadcast?.string),
    studios: namesFromNodes(row.studios),
    producers: namesFromNodes(row.producers),
    licensors: namesFromNodes(row.licensors),
    source_material: asString(row.source),
    rating_pg: asString(row.rating),
    rank: asNumber(row.rank),
    popularity: asNumber(row.popularity),
    members: asNumber(row.members),
    favorites: asNumber(row.favorites),
    trailer_url: asString(trailer?.url),
    trailer_embed: asString(trailer?.embed_url),
    synonyms: asArray(row.title_synonyms).filter(
      (item): item is string => typeof item === "string" && Boolean(item.trim()),
    ),
    background: asString(row.background),
    related: relatedFromJikan(row.relations),
    openings: asArray(theme?.openings).filter(
      (item): item is string => typeof item === "string",
    ),
    endings: asArray(theme?.endings).filter(
      (item): item is string => typeof item === "string",
    ),
  };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function yearFromAired(row: Record<string, unknown>): number | null {
  const explicit = asNumber(row.year);
  if (explicit != null) return explicit;
  const from = asString(asRecord(row.aired)?.from);
  if (!from) return null;
  const year = Number(from.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

export async function searchJikan(query: string): Promise<AnimeSearchHit[]> {
  const key = `mal:search:${query.toLowerCase()}`;
  const cached = cacheGet<AnimeSearchHit[]>(key);
  if (cached) return cached;

  const path = `/anime?q=${encodeURIComponent(query)}&limit=10&sfw=true`;
  const payload = asRecord(await jikanFetch(path));
  const hits = asArray(payload?.data)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item != null)
    .map(mapSearchHit)
    .filter((item): item is AnimeSearchHit => item != null);

  cacheSet(key, hits, SEARCH_TTL);
  return hits;
}

export async function getJikanAnime(id: string): Promise<AnimeDetails> {
  const key = `mal:id:${id}`;
  const cached = cacheGet<AnimeDetails>(key);
  if (cached) return cached;

  let payload = asRecord(await jikanFetch(`/anime/${encodeURIComponent(id)}/full`).catch(() => null));
  if (!payload) {
    payload = asRecord(await jikanFetch(`/anime/${encodeURIComponent(id)}`));
  }
  const row = asRecord(payload?.data);
  if (!row) throw new Error("Anime not found on MyAnimeList.");
  const hit = mapSearchHit(row);
  if (!hit) throw new Error("Anime not found on MyAnimeList.");

  const details: AnimeDetails = {
    ...hit,
    year: yearFromAired(row) ?? hit.year,
    synopsis: asString(row.synopsis),
    site_url: asString(row.url),
    catalog: catalogFromJikan(row),
  };
  cacheSet(key, details, DETAILS_TTL);
  return details;
}
