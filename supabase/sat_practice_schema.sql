-- =============================================================================
-- Emre Hub — SAT Practice attempts (additive)
-- =============================================================================
-- Run in Supabase SQL Editor after mvp_schema / phase2_schema.
-- Stores QBank-built R&W and Math mocks separately (not a combined 1600 SAT).
-- =============================================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.sat_practice_settings (
  user_id              uuid primary key,
  ingest_token_hash    text,
  used_external_ids    jsonb not null default '[]'::jsonb,
  used_content_hashes  jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.sat_practice_settings;
create trigger set_updated_at
  before update on public.sat_practice_settings
  for each row execute function public.set_updated_at();

alter table public.sat_practice_settings enable row level security;

drop policy if exists "sat_practice_settings_select_own" on public.sat_practice_settings;
drop policy if exists "sat_practice_settings_insert_own" on public.sat_practice_settings;
drop policy if exists "sat_practice_settings_update_own" on public.sat_practice_settings;
drop policy if exists "sat_practice_settings_delete_own" on public.sat_practice_settings;

create policy "sat_practice_settings_select_own"
  on public.sat_practice_settings for select using (auth.uid() = user_id);
create policy "sat_practice_settings_insert_own"
  on public.sat_practice_settings for insert with check (auth.uid() = user_id);
create policy "sat_practice_settings_update_own"
  on public.sat_practice_settings for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sat_practice_settings_delete_own"
  on public.sat_practice_settings for delete using (auth.uid() = user_id);

create table if not exists public.sat_practice_attempts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null,
  section                  text not null check (section in ('rw', 'math')),
  title                    text not null,
  status                   text not null default 'ready'
    check (status in ('ready', 'module1_done', 'completed')),
  include_timing_in_report boolean not null default true,
  has_html                 boolean not null default false,
  module_token_hash        text,
  source_html              text,
  modules                  jsonb not null default '{}'::jsonb,
  answers                  jsonb not null default '{}'::jsonb,
  flagged                  jsonb not null default '{}'::jsonb,
  seconds_spent            jsonb not null default '{}'::jsonb,
  module1_seconds_left     int,
  module2_seconds_left     int,
  raw_correct              int,
  raw_total                int,
  scaled_estimated         int,
  domain_stats             jsonb,
  started_at               timestamptz not null default now(),
  module1_completed_at     timestamptz,
  completed_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists sat_practice_attempts_user_idx
  on public.sat_practice_attempts(user_id, created_at desc);

drop trigger if exists set_updated_at on public.sat_practice_attempts;
create trigger set_updated_at
  before update on public.sat_practice_attempts
  for each row execute function public.set_updated_at();

alter table public.sat_practice_attempts enable row level security;

drop policy if exists "sat_practice_attempts_select_own" on public.sat_practice_attempts;
drop policy if exists "sat_practice_attempts_insert_own" on public.sat_practice_attempts;
drop policy if exists "sat_practice_attempts_update_own" on public.sat_practice_attempts;
drop policy if exists "sat_practice_attempts_delete_own" on public.sat_practice_attempts;

create policy "sat_practice_attempts_select_own"
  on public.sat_practice_attempts for select using (auth.uid() = user_id);
create policy "sat_practice_attempts_insert_own"
  on public.sat_practice_attempts for insert with check (auth.uid() = user_id);
create policy "sat_practice_attempts_update_own"
  on public.sat_practice_attempts for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sat_practice_attempts_delete_own"
  on public.sat_practice_attempts for delete using (auth.uid() = user_id);
