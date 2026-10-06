-- 0005: expecting parents. A baby can be 'expected' (due date, no birth date yet) and becomes 'born' later.
-- Run AFTER 0001-0004.

alter table public.babies add column status text not null default 'born' check (status in ('born', 'expected'));
alter table public.babies add column due_date date;

-- Logs can only be recorded for babies who have been born (pumping has no baby)
drop policy "logs household insert" on public.logs;
create policy "logs household insert" on public.logs for insert to authenticated
  with check (
    household_id = public.my_household() and user_id = auth.uid()
    and (baby_id is null or exists (
      select 1 from public.babies b
      where b.id = baby_id and b.household_id = public.my_household() and b.status = 'born'
    ))
  );
