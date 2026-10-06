-- 0002: shared households (two parents, one baby) + private wellbeing tracking.
-- Run in Supabase Dashboard -> SQL Editor AFTER 0001.

-- ---------- Households ----------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  baby jsonb not null default '{}'::jsonb,   -- shared baby info from the survey
  created_at timestamptz not null default now()
);

alter table public.profiles add column household_id uuid references public.households(id) on delete set null;
alter table public.logs     add column household_id uuid references public.households(id) on delete cascade;

-- Give every existing user their own household and move their logs/baby info into it
do $$
declare r record; h uuid;
begin
  for r in select id from public.profiles where household_id is null loop
    insert into public.households default values returning id into h;
    update public.profiles set household_id = h where id = r.id;
  end loop;

  update public.logs l set household_id = p.household_id
    from public.profiles p where p.id = l.user_id and l.household_id is null;

  update public.households h set baby = jsonb_strip_nulls(jsonb_build_object(
      'babyName', s.data->'babyName', 'babyGender', s.data->'babyGender',
      'babyBirthDate', s.data->'babyBirthDate', 'gestationalAge', s.data->'gestationalAge',
      'feedingType', s.data->'feedingType', 'trackingPreferences', s.data->'trackingPreferences'))
    from public.surveys s join public.profiles p on p.id = s.user_id
    where p.household_id = h.id;
end $$;

alter table public.logs alter column household_id set not null;

-- Logs now reference profiles so we can show "logged by <name>"
alter table public.logs drop constraint logs_user_id_fkey;
alter table public.logs add constraint logs_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

create function public.my_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from public.profiles where id = auth.uid()
$$;

alter table public.logs alter column household_id set default public.my_household();

-- Users may only change their name/photo, never their household directly (joining goes through join_household)
revoke update on public.profiles from authenticated;
grant update (name, avatar_url) on public.profiles to authenticated;

alter table public.households enable row level security;
create policy "household read own"   on public.households for select to authenticated using (id = public.my_household());
create policy "household update own" on public.households for update to authenticated
  using (id = public.my_household()) with check (id = public.my_household());

drop policy "logs own" on public.logs;
create policy "logs household read"   on public.logs for select to authenticated using (household_id = public.my_household());
create policy "logs household insert" on public.logs for insert to authenticated
  with check (household_id = public.my_household() and user_id = auth.uid());
create policy "logs household update" on public.logs for update to authenticated
  using (household_id = public.my_household()) with check (household_id = public.my_household());
create policy "logs household delete" on public.logs for delete to authenticated using (household_id = public.my_household());

-- New users get their own household automatically
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  insert into public.households default values returning id into h;
  insert into public.profiles (id, name, household_id)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name',''), 'Parent'), h);
  return new;
end $$;

-- Join a partner's household with their invite code (max 4 members)
create function public.join_household(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare target uuid; old uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into target from public.households where invite_code = upper(trim(code));
  if target is null then raise exception 'Invalid invite code'; end if;
  select household_id into old from public.profiles where id = auth.uid();
  if old = target then return target; end if;
  if (select count(*) from public.profiles where household_id = target) >= 4 then
    raise exception 'That household is full';
  end if;
  update public.profiles set household_id = target where id = auth.uid();
  update public.logs set household_id = target where user_id = auth.uid() and household_id = old;
  if not exists (select 1 from public.profiles where household_id = old) then
    delete from public.households where id = old;
  end if;
  return target;
end $$;

-- Leave a shared household and start a fresh one (logs stay with the household)
create function public.leave_household() returns uuid
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.households default values returning id into h;
  update public.profiles set household_id = h where id = auth.uid();
  return h;
end $$;

grant execute on function public.join_household(text), public.leave_household() to authenticated;
revoke execute on function public.join_household(text), public.leave_household() from anon, public;

-- ---------- Wellbeing (PRIVATE to each parent; never shared with the household) ----------
create table public.wellbeing_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('checkin','epds')),
  score int,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index wellbeing_user_time on public.wellbeing_entries (user_id, created_at desc);
alter table public.wellbeing_entries enable row level security;
create policy "wellbeing own" on public.wellbeing_entries for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
