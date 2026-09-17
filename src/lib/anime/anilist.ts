import { cacheGet, cacheSet } from "./cache";
import type { AnimeCatalog, AnimeDetails, AnimeRelated, AnimeSearchHit } from "./types";

const ANILIST_URL = "https://graphql.anilist.co";
const SEARCH_TTL = 10 * 60 * 1000;
const DETAILS_TTL = 60 * 60 * 1000;

const SEARCH_QUERY = `
query ($search: String) {
  Page(page: 1, perPage: 10) {
    media(search: $search, type: ANIME, isAdult: false) {
      id
      title { romaji english native }
      coverImage { extraLarge large }
      format
      episodes
      status
      seasonYear
      averageScore
      genres
    }
  }
}
`;

const DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    synonyms
    coverImage { extraLarge large }
    bannerImage
    format
    episodes
    duration
    status
    season
    seasonYear
    startDate { year month day }
    endDate { year month day }
    averageScore
    popularity
    favourites
    rankings { rank type allTime }
    genres
    source
    description(asHtml: false)
    trailer { id site }
    studios { nodes { name isAnimationStudio } }
    relations {
      edges {
        relationType(version: 2)
        node {
          id
          type
          title { romaji english }
          format
        }
      }
    }
    siteUrl
  }
}
`;

const DETAILS_BY_MAL_QUERY = `
query ($id: Int) {
  Media(idMal: $id, type: ANIME) {
    id
    title { romaji english native }
    synonyms
    coverImage { extraLarge large }
    bannerImage
    format
    episodes
    duration
    status
    season
    seasonYear
    startDate { year month day }
    endDate { year month day }
    averageScore
    popularity
    favourites
    rankings { rank type allTime }
    genres
    source
    description(asHtml: false)
    trailer { id site }
    studios { nodes { name isAnimationStudio } }
    relations {
      edges {
        relationType(version: 2)
        node {
          id
          type
          title { romaji english }
          format
        }
      }
    }
    siteUrl
  }
}
`;

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
  return null;
}

function stripDescription(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/~![\s\S]*?!~/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatAnimeType(format: string | null): string | null {
  if (!format) return null;
  const map: Record<string, string> = {
    TV: "TV",
    TV_SHORT: "TV Short",
    MOVIE: "Movie",
    SPECIAL: "Special",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "Music",
  };
  return map[format] ?? format.replace(/_/g, " ");
}

function formatStatus(status: string | null): string | null {
  if (!status) return null;
  const map: Record<string, string> = {
    FINISHED: "Finished Airing",
    RELEASING: "Currently Airing",
    NOT_YET_RELEASED: "Not yet aired",
    CANCELLED: "Cancelled",
    HIATUS: "Hiatus",
  };
  return map[status] ?? status;
}

function prettyEnum(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatSeason(season: string | null, year: number | null): string | null {
  if (!season) return year != null ? String(year) : null;
  const label = season.charAt(0) + season.slice(1).toLowerCase();
  return year != null ? `${label} ${year}` : label;
}

function fuzzyDate(value: unknown): string | null {
  const rec = asRecord(value);
  const year = asNumber(rec?.year);
  if (year == null) return null;
  const month = String(asNumber(rec?.month) ?? 1).padStart(2, "0");
  const day = String(asNumber(rec?.day) ?? 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function youtubeEmbed(trailer: Record<string, unknown> | null): {
  url: string | null;
  embed: string | null;
} {
  if (!trailer) return { url: null, embed: null };
  const site = asString(trailer.site)?.toLowerCase();
  const id = asString(trailer.id);
  if (site !== "youtube" || !id) return { url: null, embed: null };
  return {
    url: `https://www.youtube.com/watch?v=${id}`,
    embed: `https://www.youtube-nocookie.com/embed/${id}`,
  };
}

async function anilistFetch(
  query: string,
  variables: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "60");
    throw new Error(`AniList is rate-limited. Retry-After=${Number.isFinite(retryAfter) ? retryAfter : 60}`);
  }
  if (!res.ok) throw new Error(`AniList archive returned ${res.status}`);
  const payload = asRecord(await res.json());
  if (!payload) throw new Error("AniList returned an empty response.");
  if (payload.errors) {
    throw new Error("AniList could not complete that search.");
  }
  const data = asRecord(payload.data);
  if (!data) throw new Error("AniList returned no data.");
  return data;
}

function mapHit(row: Record<string, unknown>): AnimeSearchHit | null {
  const id = asNumber(row.id);
  const titles = asRecord(row.title);
  const title =
    asString(titles?.romaji) ?? asString(titles?.english) ?? asString(titles?.native);
  if (id == null || !title) return null;
  const cover = asRecord(row.coverImage);
  const score = asNumber(row.averageScore);
  return {
    source: "anilist",
    external_id: String(id),
    title,
    title_english: asString(titles?.english),
    title_japanese: asString(titles?.native),
    image_url: asString(cover?.extraLarge) ?? asString(cover?.large),
    anime_type: formatAnimeType(asString(row.format)),
    episodes: asNumber(row.episodes),
    year: asNumber(row.seasonYear),
    community_score: score != null ? Number((score / 10).toFixed(2)) : null,
    airing_status: formatStatus(asString(row.status)),
    genres: asArray(row.genres).filter(
      (item): item is string => typeof item === "string",
    ),
  };
}

function relatedFromAnilist(value: unknown): AnimeRelated[] {
  const edges = asArray(asRecord(value)?.edges);
  const related: AnimeRelated[] = [];
  for (const edge of edges) {
    const rec = asRecord(edge);
    const node = asRecord(rec?.node);
    if (!node || asString(node.type) !== "ANIME") continue;
    const id = asNumber(node.id);
    const titles = asRecord(node.title);
    const title =
      asString(titles?.romaji) ?? asString(titles?.english);
    if (id == null || !title) continue;
    related.push({
      relation: prettyEnum(asString(rec?.relationType)) ?? "Related",
      title,
      external_id: String(id),
      type: formatAnimeType(asString(node.format)),
    });
  }
  return related;
}

function catalogFromAnilist(row: Record<string, unknown>): AnimeCatalog {
  const studios = asArray(asRecord(row.studios)?.nodes)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item != null);
  const animationStudios = studios
    .filter((item) => item.isAnimationStudio === true)
    .map((item) => asString(item.name))
    .filter((name): name is string => Boolean(name));
  const producers = studios
    .filter((item) => item.isAnimationStudio !== true)
    .map((item) => asString(item.name))
    .filter((name): name is string => Boolean(name));
  const rankings = asArray(row.rankings)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item != null);
  const rated = rankings.find((item) => item.type === "RATED" && item.allTime);
  const popular = rankings.find((item) => item.type === "POPULAR" && item.allTime);
  const trailer = youtubeEmbed(asRecord(row.trailer));
  const duration = asNumber(row.duration);
  const start = fuzzyDate(row.startDate);
  const end = fuzzyDate(row.endDate);
  return {
    duration: duration != null ? `${duration} min per ep` : null,
    aired_from: start,
    aired_to: end,
    aired_text: [start, end].filter(Boolean).join(" to ") || null,
    season: formatSeason(asString(row.season), asNumber(row.seasonYear)),
    studios: animationStudios,
    producers,
    licensors: [],
    source_material: prettyEnum(asString(row.source)),
    rank: asNumber(rated?.rank),
    popularity: asNumber(popular?.rank),
    members: asNumber(row.popularity),
    favorites: asNumber(row.favourites),
    trailer_url: trailer.url,
    trailer_embed: trailer.embed,
    synonyms: asArray(row.synonyms).filter(
      (item): item is string => typeof item === "string" && Boolean(item.trim()),
    ),
    related: relatedFromAnilist(row.relations),
    banner_image: asString(row.bannerImage),
  };
}

function detailsFromRow(row: Record<string, unknown>): AnimeDetails {
  const hit = mapHit(row);
  if (!hit) throw new Error("Anime not found on AniList.");
  return {
    ...hit,
    synopsis: stripDescription(asString(row.description)),
    site_url: asString(row.siteUrl),
    catalog: catalogFromAnilist(row),
  };
}

export async function searchAnilist(query: string): Promise<AnimeSearchHit[]> {
  const key = `anilist:search:${query.toLowerCase()}`;
  const cached = cacheGet<AnimeSearchHit[]>(key);
  if (cached) return cached;
  const data = await anilistFetch(SEARCH_QUERY, { search: query });
  const page = asRecord(data.Page);
  const hits = asArray(page?.media)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item != null)
    .map(mapHit)
    .filter((item): item is AnimeSearchHit => item != null);
  cacheSet(key, hits, SEARCH_TTL);
  return hits;
}

export async function getAnilistAnime(id: string): Promise<AnimeDetails> {
  const key = `anilist:id:${id}`;
  const cached = cacheGet<AnimeDetails>(key);
  if (cached) return cached;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) throw new Error("Invalid AniList id.");
  const data = await anilistFetch(DETAILS_QUERY, { id: numericId });
  const row = asRecord(data.Media);
  if (!row) throw new Error("Anime not found on AniList.");
  const details = detailsFromRow(row);
  cacheSet(key, details, DETAILS_TTL);
  return details;
}

export async function getAnilistByMalId(malId: number): Promise<AnimeDetails> {
  const key = `anilist:mal:${malId}`;
  const cached = cacheGet<AnimeDetails>(key);
  if (cached) return cached;
  const data = await anilistFetch(DETAILS_BY_MAL_QUERY, { id: malId });
  const row = asRecord(data.Media);
  if (!row) throw new Error(`Anime not found on AniList for MAL ${malId}.`);
  const details = detailsFromRow(row);
  cacheSet(key, details, DETAILS_TTL);
  cacheSet(`anilist:id:${details.external_id}`, details, DETAILS_TTL);
  return details;
}
