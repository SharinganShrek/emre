-- Anime catalog metadata + watch progress on movies (used as the anime list).
alter table public.movies
  add column if not exists source text not null default 'mal',
  add column if not exists external_id text,
  add column if not exists image_url text,
  add column if not exists title_english text,
  add column if not exists title_japanese text,
  add column if not exists anime_type text,
  add column if not exists episodes integer,
  add column if not exists episodes_watched integer not null default 0,
  add column if not exists year integer,
  add column if not exists genres text[] not null default '{}',
  add column if not exists synopsis text,
  add column if not exists site_url text,
  add column if not exists community_score numeric,
  add column if not exists airing_status text,
  add column if not exists catalog jsonb not null default '{}'::jsonb;

alter table public.movies drop constraint if exists movies_source_check;
alter table public.movies
  add constraint movies_source_check
  check (source in ('mal', 'anilist'));

alter table public.movies drop constraint if exists movies_episodes_watched_check;
alter table public.movies
  add constraint movies_episodes_watched_check
  check (episodes_watched >= 0);

create unique index if not exists movies_user_source_external_uidx
  on public.movies (user_id, source, external_id)
  where external_id is not null;

create index if not exists movies_user_kind_status_idx
  on public.movies (user_id, kind, status);
