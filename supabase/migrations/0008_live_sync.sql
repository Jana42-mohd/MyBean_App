-- 0008: live sync between partners.
--  * Supabase Realtime streams changes to logs, babies, profiles and sleep timers to the household's phones
--  * the sleep timer becomes shared (either parent can see and stop it) instead of living on one phone
-- Run AFTER 0001-0007.

-- Shared sleep timers: one row per baby who is asleep right now
create table public.active_sleeps (
  baby_id uuid primary key references public.babies(id) on delete cascade,
  household_id uuid not null default public.my_household() references public.households(id) on delete cascade,
  started_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now()
);
create index active_sleeps_household on public.active_sleeps (household_id);

alter table public.active_sleeps enable row level security;
create policy "sleeps household read" on public.active_sleeps for select to authenticated
  using (household_id = public.my_household());
create policy "sleeps household start" on public.active_sleeps for insert to authenticated
  with check (
    household_id = public.my_household() and started_by = auth.uid()
    and exists (select 1 from public.babies b where b.id = baby_id and b.household_id = public.my_household() and b.status = 'born')
  );
create policy "sleeps household stop" on public.active_sleeps for delete to authenticated
  using (household_id = public.my_household());

-- Realtime: send changes of these tables to subscribed clients (row-level security still decides who receives what).
-- Guarded so the migration also runs on databases without the Realtime publication.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['logs', 'babies', 'profiles', 'active_sleeps'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;  -- already enabled
      end;
    end loop;
  end if;
end $$;

-- Deletes only carry the primary key by default; with FULL they also carry household_id so clients can filter them.
alter table public.logs replica identity full;
alter table public.babies replica identity full;
alter table public.active_sleeps replica identity full;
