// Media shared with one friend's site: the item, the deadline, and the checks
// on what their site sends. The wire format is the contract with their inbox.
// Network and database access live in media-share-service.ts.
//
// One item is open each way. The receiver computes the deadline from the length.

import { z } from "zod";

export const SHARE_KINDS = ["movie", "tv", "anime", "manga", "book"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export const KIND_LABEL: Record<ShareKind, string> = {
  movie: "Movie",
  tv: "TV",
  anime: "Anime",
  manga: "Manga",
  book: "Book",
};

export const KIND_SOURCE: Record<ShareKind, string> = {
  movie: "TMDB",
  tv: "TMDB",
  anime: "MyAnimeList",
  manga: "MyAnimeList",
  book: "Google Books",
};

export const NOTE_MAX = 500;
export const QUERY_MAX = 100;

export const SHARE_NOT_READY =
  "The media exchange starts once supabase/media_share_schema.sql has run in Supabase.";

export const SUPABASE_NOT_READY =
  "The media exchange needs Supabase. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run supabase/media_share_schema.sql.";

export interface ShareMedia {
  kind: ShareKind;
  sourceId: string;
  title: string;
  altTitle: string | null;
  year: number | null;
  image: string | null;
  creator: string | null;
  facts: string[];
  lengthMinutes: number | null;
  lengthLabel: string | null;
}

export interface ShareItem {
  id: string;
  direction: "sent" | "received";
  media: ShareMedia;
  note: string | null;
  sentAt: string;
  dueAt: string;
  finishedAt: string | null;
  notifiedAt: string | null;
}

export interface ShareHit {
  sourceId: string;
  title: string;
  altTitle: string | null;
  year: number | null;
  image: string | null;
  meta: string | null;
}

export interface ExchangeState {
  ready: boolean;
  message: string | null;
  friend: { name: string } | null;
  sent: ShareItem | null;
  received: ShareItem | null;
  now: string;
}

export function exchangeUnavailable(
  message: string,
  now = new Date().toISOString(),
): ExchangeState {
  return {
    ready: false,
    message,
    friend: null,
    sent: null,
    received: null,
    now,
  };
}

export const CHAPTER_MINUTES = 5;
export const VOLUME_MINUTES = 45;
export const PAGE_MINUTES = 1.5;

export const MIN_DAYS = 2;
export const MAX_DAYS = 60;
export const UNKNOWN_DAYS = 7;
export const MINUTES_PER_DAY = 60;

export function allowanceDays(lengthMinutes: number | null): number {
  if (
    lengthMinutes === null ||
    !Number.isFinite(lengthMinutes) ||
    lengthMinutes <= 0
  ) {
    return UNKNOWN_DAYS;
  }
  return Math.min(
    MAX_DAYS,
    Math.max(MIN_DAYS, Math.ceil(lengthMinutes / MINUTES_PER_DAY)),
  );
}

export function dueFrom(received: Date, lengthMinutes: number | null): Date {
  return new Date(
    received.getTime() + allowanceDays(lengthMinutes) * 24 * 60 * 60 * 1000,
  );
}

export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

export function timeLeft(due: Date, now: Date): { late: boolean; text: string } {
  const diff = due.getTime() - now.getTime();
  const late = diff < 0;
  const total = Math.floor(Math.abs(diff) / 60_000);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const span =
    days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return { late, text: late ? `${span} late` : `${span} left` };
}

export function elapsedShare(sent: Date, due: Date, now: Date): number {
  const span = due.getTime() - sent.getTime();
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now.getTime() - sent.getTime()) / span));
}

export function minQueryLength(kind: ShareKind): number {
  return kind === "anime" || kind === "manga" ? 3 : 2;
}

export function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

const NUMERIC_ID = /^[1-9]\d{0,9}$/;
const BOOK_ID = /^[A-Za-z0-9_-]{4,40}$/;
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/i;

export function isSourceId(kind: ShareKind, id: string): boolean {
  return kind === "book" ? BOOK_ID.test(id) : NUMERIC_ID.test(id);
}

export function sourceLink(kind: ShareKind, id: string): string | null {
  if (!isSourceId(kind, id)) return null;
  switch (kind) {
    case "movie":
      return `https://www.themoviedb.org/movie/${id}`;
    case "tv":
      return `https://www.themoviedb.org/tv/${id}`;
    case "anime":
      return `https://myanimelist.net/anime/${id}`;
    case "manga":
      return `https://myanimelist.net/manga/${id}`;
    case "book":
      return `https://books.google.com/books?id=${encodeURIComponent(id)}`;
  }
}

const IMAGE_HOSTS = new Set([
  "image.tmdb.org",
  "cdn.myanimelist.net",
  "books.google.com",
  "books.googleusercontent.com",
]);

export function isShareImage(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && IMAGE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function cleanImage(src: string | null): string | null {
  if (!src) return null;
  const https = src.replace(/^http:\/\//i, "https://");
  return isShareImage(https) ? https : null;
}

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const shareMediaSchema = z
  .object({
    kind: z.enum(SHARE_KINDS),
    sourceId: z.string().max(40),
    title: shortText(300),
    altTitle: shortText(300).nullable(),
    year: z.number().int().min(1000).max(3000).nullable(),
    image: z.string().max(1000).nullable(),
    creator: shortText(300).nullable(),
    facts: z.array(shortText(120)).max(6),
    lengthMinutes: z.number().int().positive().max(1_000_000).nullable(),
    lengthLabel: shortText(120).nullable(),
  })
  .superRefine((media, ctx) => {
    if (!isSourceId(media.kind, media.sourceId)) {
      ctx.addIssue({
        code: "custom",
        message: "Bad catalogue id",
        path: ["sourceId"],
      });
    }
  });

export const inboxSchema = z.object({
  id: z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Invalid UUID",
  ),
  sentAt: z
    .string()
    .max(40)
    .refine((value) => ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value)), {
      message: "Invalid datetime",
    }),
  note: z.string().trim().max(NOTE_MAX).nullable(),
  media: shareMediaSchema,
});

export interface InboxBody {
  id: string;
  sentAt: string;
  note: string | null;
  media: ShareMedia;
}

export function parseInbox(
  raw: unknown,
): { ok: true; data: InboxBody } | { ok: false; issues: unknown[] } {
  const parsed = inboxSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };
  const note = parsed.data.note?.trim() ?? "";
  return {
    ok: true,
    data: {
      id: parsed.data.id,
      sentAt: parsed.data.sentAt,
      note: note ? note : null,
      media: {
        ...parsed.data.media,
        image:
          parsed.data.media.image && isShareImage(parsed.data.media.image)
            ? parsed.data.media.image
            : null,
      },
    },
  };
}

export const sendSchema = z.object({
  kind: z.enum(SHARE_KINDS),
  sourceId: z.string().trim().max(40),
  note: z.string().trim().max(NOTE_MAX).optional().nullable(),
});

export const finishedSchema = z.object({
  finishedAt: z
    .string()
    .max(40)
    .refine((value) => ISO_DATE_TIME.test(value) && !Number.isNaN(Date.parse(value)), {
      message: "Invalid datetime",
    }),
});

export function friendBaseUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const local =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1" ||
      url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export interface TmdbFilm {
  id: number;
  title: string;
  year: number | null;
  poster: string | null;
  director: string | null;
  studio: string | null;
  runtime: number | null;
}

export interface TmdbShow {
  id: number;
  name: string;
  year: number | null;
  poster: string | null;
  creator: string | null;
  network: string | null;
  /** Typical episode length. 45 when the catalogue doesn't say. */
  runtime: number;
  seasons: { episodeCount: number; runtime: number | null }[];
}

export interface MalAnime {
  id: number;
  title: string;
  titleEn: string | null;
  year: number | null;
  poster: string | null;
  studio: string | null;
  mediaType: string;
  episodes: number | null;
  /** Minutes per episode. */
  duration: number | null;
  airing: string | null;
}

export interface MalManga {
  id: number;
  title: string;
  titleEn: string | null;
  year: number | null;
  cover: string | null;
  writers: string[];
  artists: string[];
  chapters: number | null;
  volumes: number | null;
  publishing: string | null;
}

export interface CatalogBook {
  id: string;
  title: string;
  author: string | null;
  year: number | null;
  cover: string | null;
  publisher: string | null;
  pages: number | null;
}

function positive(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export function fromFilm(d: TmdbFilm): ShareMedia {
  const runtime = positive(d.runtime) ? Math.round(d.runtime) : null;
  return {
    kind: "movie",
    sourceId: String(d.id),
    title: clip(d.title, 300) ?? d.title,
    altTitle: null,
    year: d.year,
    image: cleanImage(d.poster),
    creator: clip(d.director, 300),
    facts: clip(d.studio, 120) ? [clip(d.studio, 120)!] : [],
    lengthMinutes: runtime,
    lengthLabel: runtime ? formatMinutes(runtime) : null,
  };
}

export function fromShow(d: TmdbShow): ShareMedia {
  let episodes = 0;
  let minutes = 0;
  for (const season of d.seasons) {
    const count = positive(season.episodeCount) ? Math.round(season.episodeCount) : 0;
    episodes += count;
    const each = positive(season.runtime) ? season.runtime : d.runtime;
    minutes += count * each;
  }
  const label =
    episodes > 0
      ? `${plural(d.seasons.length, "season")} · ${plural(episodes, "episode")}`
      : null;
  return {
    kind: "tv",
    sourceId: String(d.id),
    title: clip(d.name, 300) ?? d.name,
    altTitle: null,
    year: d.year,
    image: cleanImage(d.poster),
    creator: clip(d.creator, 300),
    facts: clip(d.network, 120) ? [clip(d.network, 120)!] : [],
    lengthMinutes: minutes > 0 ? Math.round(minutes) : null,
    lengthLabel: clip(label, 120),
  };
}

const ANIME_TYPES: Record<string, string> = {
  tv: "TV",
  movie: "Movie",
  ova: "OVA",
  ona: "ONA",
  special: "Special",
  music: "Music",
  tv_special: "TV special",
};

export function fromAnime(entry: MalAnime): ShareMedia {
  const episodes = positive(entry.episodes) ? Math.round(entry.episodes) : null;
  const each = positive(entry.duration) ? Math.round(entry.duration) : null;
  const minutes = episodes !== null && each !== null ? episodes * each : null;
  let label: string | null = null;
  if (episodes === 1 && each !== null) label = formatMinutes(each);
  else if (episodes !== null) {
    label =
      each !== null
        ? `${plural(episodes, "episode")} × ${formatMinutes(each)}`
        : plural(episodes, "episode");
  }
  const typeLabel = ANIME_TYPES[entry.mediaType];
  return {
    kind: "anime",
    sourceId: String(entry.id),
    title: clip(entry.title, 300) ?? entry.title,
    altTitle:
      entry.titleEn && entry.titleEn !== entry.title ? clip(entry.titleEn, 300) : null,
    year: entry.year,
    image: cleanImage(entry.poster),
    creator: clip(entry.studio, 300),
    facts: [typeLabel, entry.airing === "airing" ? "Still airing" : null].filter(
      (fact): fact is string => Boolean(fact),
    ),
    lengthMinutes: minutes,
    lengthLabel: clip(label, 120),
  };
}

export function fromManga(manga: MalManga): ShareMedia {
  const chapters = positive(manga.chapters) ? Math.round(manga.chapters) : null;
  const volumes = positive(manga.volumes) ? Math.round(manga.volumes) : null;
  const minutes =
    chapters !== null
      ? chapters * CHAPTER_MINUTES
      : volumes !== null
        ? volumes * VOLUME_MINUTES
        : null;
  const parts = [
    volumes !== null ? plural(volumes, "volume") : null,
    chapters !== null ? plural(chapters, "chapter") : null,
  ].filter((part): part is string => Boolean(part));
  const people = [...new Set([...manga.writers, ...manga.artists])];
  return {
    kind: "manga",
    sourceId: String(manga.id),
    title: clip(manga.title, 300) ?? manga.title,
    altTitle:
      manga.titleEn && manga.titleEn !== manga.title ? clip(manga.titleEn, 300) : null,
    year: manga.year,
    image: cleanImage(manga.cover),
    creator: clip(people.join(", "), 300),
    facts: manga.publishing === "currently_publishing" ? ["Still publishing"] : [],
    lengthMinutes: minutes,
    lengthLabel: parts.length ? clip(parts.join(" · "), 120) : null,
  };
}

export function fromBook(book: CatalogBook): ShareMedia {
  const pages = positive(book.pages) ? Math.round(book.pages) : null;
  return {
    kind: "book",
    sourceId: book.id,
    title: clip(book.title, 300) ?? book.title,
    altTitle: null,
    year: book.year,
    image: cleanImage(book.cover),
    creator: clip(book.author, 300),
    facts: clip(book.publisher, 120) ? [clip(book.publisher, 120)!] : [],
    lengthMinutes: pages !== null ? Math.round(pages * PAGE_MINUTES) : null,
    lengthLabel: pages !== null ? plural(pages, "page") : null,
  };
}
