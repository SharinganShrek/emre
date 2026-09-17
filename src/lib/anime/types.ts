export const ANIME_SOURCES = [
  { id: "anilist", label: "AniList" },
  { id: "mal", label: "MyAnimeList" },
] as const;

export type AnimeSource = (typeof ANIME_SOURCES)[number]["id"];

export interface AnimeRelated {
  relation: string;
  title: string;
  external_id: string;
  type?: string | null;
}

export interface AnimeCatalog {
  duration?: string | null;
  aired_from?: string | null;
  aired_to?: string | null;
  aired_text?: string | null;
  season?: string | null;
  broadcast?: string | null;
  studios?: string[];
  producers?: string[];
  licensors?: string[];
  source_material?: string | null;
  rating_pg?: string | null;
  rank?: number | null;
  popularity?: number | null;
  members?: number | null;
  favorites?: number | null;
  trailer_url?: string | null;
  trailer_embed?: string | null;
  synonyms?: string[];
  background?: string | null;
  related?: AnimeRelated[];
  openings?: string[];
  endings?: string[];
  banner_image?: string | null;
}

export interface AnimeSearchHit {
  source: AnimeSource;
  external_id: string;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  image_url: string | null;
  anime_type: string | null;
  episodes: number | null;
  year: number | null;
  community_score: number | null;
  airing_status: string | null;
  genres: string[];
}

export interface AnimeDetails extends AnimeSearchHit {
  synopsis: string | null;
  site_url: string | null;
  catalog: AnimeCatalog;
}

export const EMPTY_CATALOG: AnimeCatalog = {};
