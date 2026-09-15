-- =============================================================================
-- Emre Hub — Study timer subjects / colors / D-Day (additive)
-- =============================================================================
-- Run in Supabase SQL Editor after mvp_schema / phase2_schema.
-- Study session logs already live in public.study_sessions.
-- This table syncs the subject list, colors, and D-Day across devices.
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

create table if not exists public.study_settings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_settings_user_idx
  on public.study_settings(user_id);

drop trigger if exists set_updated_at on public.study_settings;
create trigger set_updated_at
  before update on public.study_settings
  for each row execute function public.set_updated_at();

alter table public.study_settings enable row level security;

drop policy if exists "study_settings_select_own" on public.study_settings;
drop policy if exists "study_settings_insert_own" on public.study_settings;
drop policy if exists "study_settings_update_own" on public.study_settings;
drop policy if exists "study_settings_delete_own" on public.study_settings;

create policy "study_settings_select_own"
  on public.study_settings for select using (auth.uid() = user_id);
create policy "study_settings_insert_own"
  on public.study_settings for insert with check (auth.uid() = user_id);
create policy "study_settings_update_own"
  on public.study_settings for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "study_settings_delete_own"
  on public.study_settings for delete using (auth.uid() = user_id);
