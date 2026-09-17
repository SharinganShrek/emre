import type { AnimeDetails, AnimeSearchHit, AnimeSource } from "./types";

async function readJson<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => null)) as
    | { data?: T; error?: string }
    | null;
  if (!res.ok) {
    throw new Error(payload?.error ?? `Request failed (${res.status})`);
  }
  if (!payload || !("data" in payload)) {
    throw new Error("Unexpected response from anime archive.");
  }
  return payload.data as T;
}

export async function searchAnimeArchive(
  source: AnimeSource,
  query: string,
): Promise<AnimeSearchHit[]> {
  const params = new URLSearchParams({ source, q: query });
  const res = await fetch(`/api/anime/search?${params.toString()}`, {
    credentials: "same-origin",
  });
  return readJson<AnimeSearchHit[]>(res);
}

export async function getAnimeArchive(
  source: AnimeSource,
  id: string,
): Promise<AnimeDetails> {
  const res = await fetch(`/api/anime/${source}/${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  });
  return readJson<AnimeDetails>(res);
}
