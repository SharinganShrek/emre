-- =============================================================================
-- Emre Hub — MVP schema for Supabase
-- =============================================================================
-- Run in Supabase SQL Editor (Dashboard → SQL → New query) or via CLI migration.
--
-- Tables in this MVP:
--   profiles, habits, habit_logs, tasks, goals, study_sessions,
--   movies, books, journal_entries, notes, ai_audit_logs
--
-- Then run phase2_schema.sql for practice_tests, research_*,
-- goal_milestones, and college_counseling.
--
-- App sync (Phase 1+2): habits, habit_logs, tasks, journal_entries, movies,
-- goals, goal_milestones, study_sessions, practice_tests, research_*,
-- books, notes. Gym remains local-only.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique,
  display_name text not null default 'Emre',
  avatar_url   text,
  timezone     text not null default 'UTC',
  bio          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- habits + habit_logs (Phase 1 sync)
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  name           text not null,
  description    text,
  icon           text,
  color          text not null default '#7c9cff',
  frequency      text not null default 'daily' check (frequency in ('daily','weekly')),
  target_per_day int not null default 1 check (target_per_day > 0),
  status         text not null default 'active' check (status in ('active','archived')),
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists habits_user_idx on public.habits(user_id, status);

create table if not exists public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  habit_id   uuid not null references public.habits(id) on delete cascade,
  log_date   date not null,
  completed  boolean not null default false,
  count      int not null default 0,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index if not exists habit_logs_user_date_idx on public.habit_logs(user_id, log_date);

-- ---------------------------------------------------------------------------
-- tasks (Phase 1 sync)
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  title      text not null,
  notes      text,
  status     text not null default 'todo' check (status in ('todo','in_progress','done')),
  priority   text not null default 'medium' check (priority in ('low','medium','high')),
  due_date   date,
  project    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_user_status_idx on public.tasks(user_id, status);

-- ---------------------------------------------------------------------------
-- goals (synced)
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  title       text not null,
  description text,
  category    text,
  status      text not null default 'active' check (status in ('active','completed','paused')),
  progress    int not null default 0 check (progress between 0 and 100),
  target_date date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists goals_user_idx on public.goals(user_id, status);

-- ---------------------------------------------------------------------------
-- study_sessions (schema-ready)
-- ---------------------------------------------------------------------------
create table if not exists public.study_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  subject          text not null,
  duration_minutes int not null default 0 check (duration_minutes >= 0),
  session_date     date not null default current_date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists study_sessions_user_date_idx on public.study_sessions(user_id, session_date);

-- ---------------------------------------------------------------------------
-- movies (Phase 1 sync)
-- ---------------------------------------------------------------------------
create table if not exists public.movies (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  title         text not null,
  kind          text not null default 'anime' check (kind in ('anime','movie','series')),
  status        text not null default 'planned' check (status in ('planned','watching','watched')),
  rating        int check (rating between 0 and 10),
  review        text,
  watched_date  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists movies_user_status_idx on public.movies(user_id, status);

-- ---------------------------------------------------------------------------
-- books (schema-ready)
-- ---------------------------------------------------------------------------
create table if not exists public.books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  title         text not null,
  author        text,
  status        text not null default 'to_read' check (status in ('to_read','reading','read')),
  rating        int check (rating between 0 and 10),
  review        text,
  finished_date date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists books_user_status_idx on public.books(user_id, status);

-- ---------------------------------------------------------------------------
-- journal_entries (Phase 1 sync)
-- ---------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  entry_date date not null default current_date,
  mood       int not null default 3 check (mood between 1 and 5),
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists journal_user_date_idx on public.journal_entries(user_id, entry_date);

-- ---------------------------------------------------------------------------
-- notes (schema-ready)
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  title      text not null default 'Untitled',
  body       text not null default '',
  tags       text[] not null default '{}',
  category   text not null default 'note' check (category in ('idea','project','quote','note')),
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_idx on public.notes(user_id, pinned);

-- ---------------------------------------------------------------------------
-- ai_audit_logs (server-side AI layer only)
-- ---------------------------------------------------------------------------
create table if not exists public.ai_audit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  route      text not null,
  action     text not null check (action in ('read','write')),
  resource   text not null,
  summary    text not null,
  metadata   jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_audit_user_idx on public.ai_audit_logs(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','habits','habit_logs','tasks','goals','study_sessions',
    'movies','books','journal_entries','notes','ai_audit_logs'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security — each user owns their rows
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','habits','habit_logs','tasks','goals','study_sessions',
    'movies','books','journal_entries','notes','ai_audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "%I_select_own" on public.%I;', t, t);
    execute format('drop policy if exists "%I_insert_own" on public.%I;', t, t);
    execute format('drop policy if exists "%I_update_own" on public.%I;', t, t);
    execute format('drop policy if exists "%I_delete_own" on public.%I;', t, t);
    execute format('drop policy if exists "owner_all" on public.%I;', t);

    execute format(
      'create policy "%I_select_own" on public.%I for select using (auth.uid() = user_id);',
      t, t);
    execute format(
      'create policy "%I_insert_own" on public.%I for insert with check (auth.uid() = user_id);',
      t, t);
    execute format(
      'create policy "%I_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t, t);
    execute format(
      'create policy "%I_delete_own" on public.%I for delete using (auth.uid() = user_id);',
      t, t);
  end loop;
end;
$$;

-- No Supabase Auth: rows are owned by a built-in owner UUID on the server.
-- Access to the app is gated by APP_PASSWORD; hub mutations use the service role.
