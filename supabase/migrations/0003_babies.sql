-- 0003: multiple babies per household (twins, triplets, siblings). Run AFTER 0001 and 0002.

create table public.babies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  gender text,
  birth_date date,
  gestational_age text,
  feeding_type text,
  created_at timestamptz not null default now()
);
create index babies_household on public.babies (household_id);

alter table public.babies enable row level security;
create policy "babies household all" on public.babies for all to authenticated
  using (household_id = public.my_household()) with check (household_id = public.my_household());

-- Move the single baby stored on each household into the new table (only where one was entered or logs exist)
insert into public.babies (household_id, name, gender, birth_date, gestational_age, feeding_type)
select h.id,
       coalesce(nullif(h.baby->>'babyName', ''), 'Baby'),
       nullif(h.baby->>'babyGender', ''),
       case when h.baby->>'babyBirthDate' ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])' then left(h.baby->>'babyBirthDate', 10)::date end,
       nullif(h.baby->>'gestationalAge', ''),
       nullif(h.baby->>'feedingType', '')
from public.households h
where h.baby ? 'babyName' or exists (select 1 from public.logs l where l.household_id = h.id);

-- Every log belongs to one baby, except pumping (that belongs to the parent)
alter table public.logs add column baby_id uuid references public.babies(id) on delete cascade;
update public.logs l set baby_id = (
  select b.id from public.babies b where b.household_id = l.household_id order by b.created_at limit 1
);
alter table public.logs add constraint logs_baby_required check (type = 'pumping' or baby_id is not null);
create index logs_baby_time on public.logs (baby_id, logged_at desc);

drop policy "logs household insert" on public.logs;
drop policy "logs household update" on public.logs;
create policy "logs household insert" on public.logs for insert to authenticated
  with check (
    household_id = public.my_household() and user_id = auth.uid()
    and (baby_id is null or exists (select 1 from public.babies b where b.id = baby_id and b.household_id = public.my_household()))
  );
create policy "logs household update" on public.logs for update to authenticated
  using (household_id = public.my_household())
  with check (
    household_id = public.my_household()
    and (baby_id is null or exists (select 1 from public.babies b where b.id = baby_id and b.household_id = public.my_household()))
  );

alter table public.households drop column baby;

-- Joining a partner's household: if you were alone in yours, your babies and logs come with you
create or replace function public.join_household(code text) returns uuid
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
  if not exists (select 1 from public.profiles where household_id = old and id <> auth.uid()) then
    update public.babies set household_id = target where household_id = old;
    update public.logs   set household_id = target where household_id = old;
  end if;
  update public.profiles set household_id = target where id = auth.uid();
  if not exists (select 1 from public.profiles where household_id = old) then
    delete from public.households where id = old;
  end if;
  return target;
end $$;
