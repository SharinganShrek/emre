-- Custom habit weekdays (Mon=0 … Sun=6 in app; stored as smallint[]).
alter table public.habits drop constraint if exists habits_frequency_check;

alter table public.habits
  add constraint habits_frequency_check
  check (frequency in ('daily', 'weekly', 'custom'));

alter table public.habits
  add column if not exists schedule_days smallint[] default null;
