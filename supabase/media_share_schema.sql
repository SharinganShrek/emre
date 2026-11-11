-- =============================================================================
-- Emre Hub — media exchange with one friend's site (additive)
-- =============================================================================
-- Run in the Supabase SQL Editor. One open item each way (sent / received).
-- The app reads and writes this table with the service role only.
-- Row Level Security is on and there is no anon/authenticated policy, so the
-- public API cannot read the rows.
-- =============================================================================

create table if not exists public.media_share (
  id          text primary key,
  direction   text not null check (direction in ('sent', 'received')),
  kind        text not null check (kind in ('movie', 'tv', 'anime', 'manga', 'book')),
  title       text not null,
  media       jsonb not null,
  note        text,
  sent_at     timestamptz not null,
  due_at      timestamptz not null,
  finished_at timestamptz,
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint media_share_note_len check (note is null or char_length(note) <= 500)
);

create index if not exists media_share_direction_sent_at_idx
  on public.media_share (direction, sent_at desc);

-- One unfinished row per direction. A second insert fails until the first is finished.
create unique index if not exists media_share_one_open_idx
  on public.media_share (direction)
  where finished_at is null;

alter table public.media_share enable row level security;
