-- =============================================================================
-- Emre Hub — SAT Vocabulary progress (additive)
-- =============================================================================
-- Run in Supabase SQL Editor after mvp_schema / phase2_schema.
-- Static word list lives in the app; only progress syncs here.
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

create table if not exists public.sat_vocab_progress (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sat_vocab_progress_user_idx
  on public.sat_vocab_progress(user_id);

drop trigger if exists set_updated_at on public.sat_vocab_progress;
create trigger set_updated_at
  before update on public.sat_vocab_progress
  for each row execute function public.set_updated_at();

alter table public.sat_vocab_progress enable row level security;

drop policy if exists "sat_vocab_progress_select_own" on public.sat_vocab_progress;
drop policy if exists "sat_vocab_progress_insert_own" on public.sat_vocab_progress;
drop policy if exists "sat_vocab_progress_update_own" on public.sat_vocab_progress;
drop policy if exists "sat_vocab_progress_delete_own" on public.sat_vocab_progress;

create policy "sat_vocab_progress_select_own"
  on public.sat_vocab_progress for select using (auth.uid() = user_id);
create policy "sat_vocab_progress_insert_own"
  on public.sat_vocab_progress for insert with check (auth.uid() = user_id);
create policy "sat_vocab_progress_update_own"
  on public.sat_vocab_progress for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sat_vocab_progress_delete_own"
  on public.sat_vocab_progress for delete using (auth.uid() = user_id);
