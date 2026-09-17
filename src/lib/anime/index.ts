import { getAnilistAnime, searchAnilist } from "./anilist";
import { getJikanAnime, searchJikan } from "./jikan";
import type { AnimeDetails, AnimeSearchHit, AnimeSource } from "./types";
import { ANIME_SOURCES } from "./types";

export { ANIME_SOURCES };
export type { AnimeCatalog, AnimeDetails, AnimeRelated, AnimeSearchHit, AnimeSource } from "./types";

export function isAnimeSource(value: string): value is AnimeSource {
  return ANIME_SOURCES.some((source) => source.id === value);
}

export async function searchAnime(
  source: AnimeSource,
  query: string,
): Promise<AnimeSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return source === "anilist" ? searchAnilist(q) : searchJikan(q);
}

export async function getAnime(
  source: AnimeSource,
  id: string,
): Promise<AnimeDetails> {
  return source === "anilist" ? getAnilistAnime(id) : getJikanAnime(id);
}
