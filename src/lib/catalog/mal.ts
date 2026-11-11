import "server-only";
import { CatalogError, getJson } from "@/lib/catalog/http";
import { asArray, asNumber, asRecord, asString, yearFrom } from "@/lib/catalog/json";
import { cleanImage, type MalAnime, type MalManga } from "@/lib/media-share";

const BASE = "https://api.myanimelist.net/v2";

const ANIME_FIELDS =
  "id,title,alternative_titles,main_picture,start_date,media_type,num_episodes,average_episode_duration,studios,status";
const MANGA_FIELDS =
  "id,title,alternative_titles,main_picture,start_date,num_volumes,num_chapters,authors{first_name,last_name},status";

function clientId(): string {
  const value = process.env.MAL_CLIENT_ID?.trim();
  if (!value) {
    throw new CatalogError("Set MAL_CLIENT_ID to search anime and manga.", 503);
  }
  return value;
}

function picture(value: unknown): string | null {
  const record = asRecord(value);
  return cleanImage(asString(record?.large) ?? asString(record?.medium));
}

function englishTitle(value: unknown, title: string): string | null {
  const english = asString(asRecord(value)?.en);
  if (!english || english === title) return null;
  return english;
}

async function mal(path: string): Promise<unknown> {
  const { status, body } = await getJson(`${BASE}${path}`, {
    "X-MAL-CLIENT-ID": clientId(),
  });
  if (status === 401 || status === 403) {
    throw new CatalogError("MyAnimeList refused the client id.", 502);
  }
  if (status === 404) {
    throw new CatalogError("The catalogue doesn't have that any more.", 404);
  }
  if (status < 200 || status >= 300) {
    throw new CatalogError("MyAnimeList didn't answer — try again in a minute.", 502);
  }
  return body;
}

function animeFrom(node: Record<string, unknown>): MalAnime | null {
  const id = asNumber(node.id);
  const title = asString(node.title);
  if (!id || id <= 0 || !title) return null;
  const seconds = asNumber(node.average_episode_duration);
  const rounded =
    seconds !== null && seconds > 0 ? Math.round(seconds / 60) : null;
  const duration = rounded !== null && rounded > 0 ? rounded : null;
  const studio = asRecord(asArray(node.studios)[0]);
  const status = asString(node.status);
  return {
    id,
    title,
    titleEn: englishTitle(node.alternative_titles, title),
    year: yearFrom(node.start_date),
    poster: picture(node.main_picture),
    studio: asString(studio?.name),
    mediaType: asString(node.media_type) ?? "",
    episodes: asNumber(node.num_episodes),
    duration,
    airing: status === "currently_airing" ? "airing" : status,
  };
}

function namesFromAuthors(value: unknown): { writers: string[]; artists: string[] } {
  const writers: string[] = [];
  const artists: string[] = [];
  for (const entry of asArray(value)) {
    const record = asRecord(entry);
    if (!record) continue;
    const node = asRecord(record.node) ?? record;
    const name = [asString(node.first_name), asString(node.last_name)]
      .filter((part): part is string => Boolean(part))
      .join(" ");
    if (!name) continue;
    const role = (asString(record.role) ?? "").toLowerCase();
    if (!role || role.includes("story")) writers.push(name);
    if (role.includes("art")) artists.push(name);
  }
  return { writers, artists };
}

function mangaFrom(node: Record<string, unknown>): MalManga | null {
  const id = asNumber(node.id);
  const title = asString(node.title);
  if (!id || id <= 0 || !title) return null;
  const people = namesFromAuthors(node.authors);
  return {
    id,
    title,
    titleEn: englishTitle(node.alternative_titles, title),
    year: yearFrom(node.start_date),
    cover: picture(node.main_picture),
    writers: people.writers,
    artists: people.artists,
    chapters: asNumber(node.num_chapters),
    volumes: asNumber(node.num_volumes),
    publishing: asString(node.status),
  };
}

function searchNodes(body: unknown): Record<string, unknown>[] {
  return asArray(asRecord(body)?.data)
    .map((row) => asRecord(asRecord(row)?.node))
    .filter((node): node is Record<string, unknown> => Boolean(node));
}

export async function searchMalAnime(query: string): Promise<MalAnime[]> {
  const body = await mal(
    `/anime?q=${encodeURIComponent(query)}&limit=12&fields=${encodeURIComponent(ANIME_FIELDS)}`,
  );
  return searchNodes(body)
    .map((node) => animeFrom(node))
    .filter((entry): entry is MalAnime => Boolean(entry));
}

export async function getMalAnime(id: number): Promise<MalAnime> {
  const body = asRecord(
    await mal(`/anime/${id}?fields=${encodeURIComponent(ANIME_FIELDS)}`),
  );
  const entry = body ? animeFrom(body) : null;
  if (!entry) throw new CatalogError("The catalogue doesn't have that any more.", 404);
  return entry;
}

export async function searchMalManga(query: string): Promise<MalManga[]> {
  const body = await mal(
    `/manga?q=${encodeURIComponent(query)}&limit=12&fields=${encodeURIComponent(MANGA_FIELDS)}`,
  );
  return searchNodes(body)
    .map((node) => mangaFrom(node))
    .filter((entry): entry is MalManga => Boolean(entry));
}

export async function getMalManga(id: number): Promise<MalManga> {
  const body = asRecord(
    await mal(`/manga/${id}?fields=${encodeURIComponent(MANGA_FIELDS)}`),
  );
  const entry = body ? mangaFrom(body) : null;
  if (!entry) throw new CatalogError("The catalogue doesn't have that any more.", 404);
  return entry;
}
