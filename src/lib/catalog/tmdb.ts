import "server-only";
import { CatalogError, getJson } from "@/lib/catalog/http";
import { asArray, asNumber, asRecord, asString, yearFrom } from "@/lib/catalog/json";
import { cleanImage, type TmdbFilm, type TmdbShow } from "@/lib/media-share";

const BASE = "https://api.themoviedb.org/3";

function key(): string {
  const value = process.env.TMDB_API_KEY?.trim();
  if (!value) {
    throw new CatalogError("Set TMDB_API_KEY to search movies and shows.", 503);
  }
  return value;
}

function poster(path: unknown): string | null {
  const value = asString(path);
  if (!value || !value.startsWith("/")) return null;
  return cleanImage(`https://image.tmdb.org/t/p/w500${value}`);
}

async function tmdb(path: string): Promise<Record<string, unknown>> {
  const { status, body } = await getJson(
    `${BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(key())}`,
  );
  const record = asRecord(body);
  if (status === 401 || status === 403) {
    throw new CatalogError("TMDB refused the API key.", 502);
  }
  if (status === 404) {
    throw new CatalogError("The catalogue doesn't have that any more.", 404);
  }
  if (status < 200 || status >= 300 || !record) {
    throw new CatalogError(`TMDB answered ${status}.`, status >= 500 ? 502 : 502);
  }
  return record;
}

export async function searchTmdbMovies(query: string): Promise<TmdbFilm[]> {
  const body = await tmdb(
    `/search/movie?query=${encodeURIComponent(query)}&include_adult=false`,
  );
  return asArray(body.results)
    .map((row): TmdbFilm | null => {
      const film = asRecord(row);
      const id = asNumber(film?.id);
      const title = asString(film?.title);
      if (!film || !id || id <= 0 || !title) return null;
      return {
        id,
        title,
        year: yearFrom(film.release_date),
        poster: poster(film.poster_path),
        director: null,
        studio: null,
        runtime: null,
      };
    })
    .filter((film): film is TmdbFilm => film !== null)
    .slice(0, 12);
}

export async function getTmdbMovie(id: number): Promise<TmdbFilm> {
  const body = await tmdb(`/movie/${id}?append_to_response=credits`);
  const title = asString(body.title);
  if (!title) throw new CatalogError("The catalogue doesn't have that any more.", 404);
  const credits = asRecord(body.credits);
  const director = asArray(credits?.crew)
    .map((entry) => asRecord(entry))
    .find((entry) => asString(entry?.job) === "Director");
  const studio = asRecord(asArray(body.production_companies)[0]);
  return {
    id,
    title,
    year: yearFrom(body.release_date),
    poster: poster(body.poster_path),
    director: asString(director?.name),
    studio: asString(studio?.name),
    runtime: asNumber(body.runtime),
  };
}

export async function searchTmdbShows(query: string): Promise<TmdbShow[]> {
  const body = await tmdb(`/search/tv?query=${encodeURIComponent(query)}`);
  return asArray(body.results)
    .map((row): TmdbShow | null => {
      const show = asRecord(row);
      const id = asNumber(show?.id);
      const name = asString(show?.name);
      if (!show || !id || id <= 0 || !name) return null;
      return {
        id,
        name,
        year: yearFrom(show.first_air_date),
        poster: poster(show.poster_path),
        creator: null,
        network: null,
        runtime: 45,
        seasons: [],
      };
    })
    .filter((show): show is TmdbShow => show !== null)
    .slice(0, 12);
}

export async function getTmdbShow(id: number): Promise<TmdbShow> {
  const body = await tmdb(`/tv/${id}`);
  const name = asString(body.name);
  if (!name) throw new CatalogError("The catalogue doesn't have that any more.", 404);
  const typical =
    asArray(body.episode_run_time)
      .map((value) => asNumber(value))
      .find((value) => value !== null && value > 0) ?? 45;
  const seasons = asArray(body.seasons)
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .filter((row) => (asNumber(row.season_number) ?? 0) > 0)
    .map((row) => ({
      episodeCount: Math.max(0, Math.round(asNumber(row.episode_count) ?? 0)),
      runtime: null,
    }));
  const creator = asRecord(asArray(body.created_by)[0]);
  const network = asRecord(asArray(body.networks)[0]);
  return {
    id,
    name,
    year: yearFrom(body.first_air_date),
    poster: poster(body.poster_path),
    creator: asString(creator?.name),
    network: asString(network?.name),
    runtime: typical,
    seasons,
  };
}
