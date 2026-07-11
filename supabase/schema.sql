-- =============================================================================
-- Emre — PostgreSQL schema for Supabase
-- =============================================================================
-- Conventions:
--   * Every user-owned table has `user_id uuid` referencing auth.users(id).
--   * Every table has `id`, `created_at`, `updated_at`.
--   * `updated_at` is maintained by a trigger.
--   * Row Level Security (RLS) is enabled on every table; users can only
--     read/write their own rows. The service role bypasses RLS and is used
--     ONLY by the server-side AI permission layer (see src/lib/ai).
--
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
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
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default 'Emre',
  avatar_url   text,
  timezone     text not null default 'UTC',
  bio          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- habits + habit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
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
  user_id    uuid not null references auth.users(id) on delete cascade,
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
create index if not exists habit_logs_habit_idx on public.habit_logs(habit_id, log_date);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
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
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);

-- ---------------------------------------------------------------------------
-- goals + goal_milestones
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
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

create table if not exists public.goal_milestones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  goal_id    uuid not null references public.goals(id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  due_date   date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goal_milestones_goal_idx on public.goal_milestones(goal_id);

-- ---------------------------------------------------------------------------
-- study_sessions + practice_tests
-- ---------------------------------------------------------------------------
create table if not exists public.study_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  subject          text not null,
  duration_minutes int not null default 0 check (duration_minutes >= 0),
  session_date     date not null default current_date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists study_sessions_user_date_idx on public.study_sessions(user_id, session_date);

create table if not exists public.practice_tests (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  test_name              text not null,
  test_date              date not null default current_date,
  math_score             int check (math_score between 200 and 800),
  reading_writing_score  int check (reading_writing_score between 200 and 800),
  total_score            int check (total_score between 400 and 1600),
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists practice_tests_user_date_idx on public.practice_tests(user_id, test_date);

-- ---------------------------------------------------------------------------
-- research_projects + research_papers + research_experiments
-- ---------------------------------------------------------------------------
create table if not exists public.research_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'planning' check (status in ('planning','active','on_hold','done')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists research_projects_user_idx on public.research_projects(user_id, status);

create table if not exists public.research_papers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.research_projects(id) on delete set null,
  title      text not null,
  authors    text,
  url        text,
  status     text not null default 'to_read' check (status in ('to_read','reading','read')),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_papers_project_idx on public.research_papers(project_id);
create index if not exists research_papers_user_idx on public.research_papers(user_id);

create table if not exists public.research_experiments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.research_projects(id) on delete cascade,
  name       text not null,
  hypothesis text,
  result     text,
  status     text not null default 'planned' check (status in ('planned','running','done','failed')),
  run_date   date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_experiments_project_idx on public.research_experiments(project_id);

-- ---------------------------------------------------------------------------
-- gym_sessions + gym_exercises
-- ---------------------------------------------------------------------------
create table if not exists public.gym_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  session_date     date not null default current_date,
  duration_minutes int not null default 0 check (duration_minutes >= 0),
  focus            text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists gym_sessions_user_date_idx on public.gym_sessions(user_id, session_date);

create table if not exists public.gym_exercises (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.gym_sessions(id) on delete cascade,
  name       text not null,
  sets       int not null default 0,
  reps       int not null default 0,
  weight_kg  numeric(6,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gym_exercises_session_idx on public.gym_exercises(session_id);

-- ---------------------------------------------------------------------------
-- movies (also used for anime/series) + books
-- ---------------------------------------------------------------------------
create table if not exists public.movies (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
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

create table if not exists public.books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
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
-- journal_entries
-- ---------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default current_date,
  mood       int not null default 3 check (mood between 1 and 5),
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists journal_user_date_idx on public.journal_entries(user_id, entry_date);

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null default 'Untitled',
  body       text not null default '',
  tags       text[] not null default '{}',
  category   text not null default 'note' check (category in ('idea','project','quote','note')),
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_idx on public.notes(user_id, pinned);
create index if not exists notes_tags_idx on public.notes using gin (tags);

-- ---------------------------------------------------------------------------
-- ai_audit_logs — records every AI read/write action
-- ---------------------------------------------------------------------------
create table if not exists public.ai_audit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
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
-- updated_at triggers for every table
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','habits','habit_logs','tasks','goals','goal_milestones',
    'study_sessions','practice_tests','research_projects','research_papers',
    'research_experiments','gym_sessions','gym_exercises','movies','books',
    'journal_entries','notes','ai_audit_logs'
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
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Every table: enable RLS and add an "owner can do everything" policy keyed on
-- auth.uid() = user_id. The service role bypasses RLS (used by AI layer only).
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','habits','habit_logs','tasks','goals','goal_milestones',
    'study_sessions','practice_tests','research_projects','research_papers',
    'research_experiments','gym_sessions','gym_exercises','movies','books',
    'journal_entries','notes','ai_audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "owner_all" on public.%I;', t);
    execute format(
      'create policy "owner_all" on public.%I
         for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id);', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Emre'))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
