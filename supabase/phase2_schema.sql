-- =============================================================================
-- Emre OS — Phase 2 schema (additive)
-- =============================================================================
-- Run AFTER mvp_schema.sql if you already applied MVP.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- Adds: practice_tests, research_*, goal_milestones, college_counseling
-- Enables sync for notes, study_sessions, books (tables already in MVP).
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

-- ---------------------------------------------------------------------------
-- practice_tests
-- ---------------------------------------------------------------------------
create table if not exists public.practice_tests (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null,
  test_name              text not null,
  test_date              date not null default current_date,
  math_score             int check (math_score between 200 and 800),
  reading_writing_score  int check (reading_writing_score between 200 and 800),
  total_score            int check (total_score between 400 and 1600),
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists practice_tests_user_date_idx
  on public.practice_tests(user_id, test_date);

-- ---------------------------------------------------------------------------
-- research_projects + research_papers + research_experiments
-- ---------------------------------------------------------------------------
create table if not exists public.research_projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  title       text not null,
  description text,
  status      text not null default 'planning'
    check (status in ('planning','active','on_hold','done')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists research_projects_user_idx
  on public.research_projects(user_id, status);

create table if not exists public.research_papers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  project_id uuid references public.research_projects(id) on delete set null,
  title      text not null,
  authors    text,
  url        text,
  status     text not null default 'to_read'
    check (status in ('to_read','reading','read')),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_papers_project_idx
  on public.research_papers(project_id);
create index if not exists research_papers_user_idx
  on public.research_papers(user_id);

create table if not exists public.research_experiments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  project_id uuid not null references public.research_projects(id) on delete cascade,
  name       text not null,
  hypothesis text,
  result     text,
  status     text not null default 'planned'
    check (status in ('planned','running','done','failed')),
  run_date   date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_experiments_project_idx
  on public.research_experiments(project_id);

-- ---------------------------------------------------------------------------
-- goal_milestones
-- ---------------------------------------------------------------------------
create table if not exists public.goal_milestones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null,
  goal_id    uuid not null references public.goals(id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  due_date   date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists goal_milestones_goal_idx
  on public.goal_milestones(goal_id);

-- ---------------------------------------------------------------------------
-- college_counseling (single JSON document per hub user)
-- ---------------------------------------------------------------------------
create table if not exists public.college_counseling (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists college_counseling_user_idx
  on public.college_counseling(user_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers + RLS for new tables
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'practice_tests','research_projects','research_papers','research_experiments',
    'goal_milestones','college_counseling'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at();', t);

    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists "%I_select_own" on public.%I;', t, t);
    execute format('drop policy if exists "%I_insert_own" on public.%I;', t, t);
    execute format('drop policy if exists "%I_update_own" on public.%I;', t, t);
    execute format('drop policy if exists "%I_delete_own" on public.%I;', t, t);

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
