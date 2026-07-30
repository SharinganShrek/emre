-- =============================================================================
-- Emre Hub — drop auth.users FKs (for projects that already ran the old schema)
-- =============================================================================
-- Safe to re-run. Hub sync uses the service role and a built-in owner UUID.
-- =============================================================================

do $$
declare
  r record;
begin
  for r in
    select con.conname, rel.relname as table_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and con.contype = 'f'
      and pg_get_constraintdef(con.oid) ilike '%auth.users%'
  loop
    execute format('alter table public.%I drop constraint if exists %I;', r.table_name, r.conname);
  end loop;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
