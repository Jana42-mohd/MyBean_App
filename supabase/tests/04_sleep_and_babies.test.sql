-- Shared sleep timers, the stop-race between two parents, expecting babies, and cascades.
begin;
select t.mkuser(t.u(1), 'Alex'), t.mkuser(t.u(2), 'Blake'), t.mkuser(t.u(3), 'Casey');

select t.login(t.u(1));
insert into public.babies (name, status) values ('Mia', 'born'), ('Leo', 'born');
insert into public.babies (name, status, due_date) values ('Unborn', 'expected', '2027-01-01');
select t.fails($$ insert into public.babies (name, status) values ('X', 'pregnant') $$, 'invalid baby status rejected');
select t.fails($$ insert into public.babies (name) values ('') $$, 'baby needs a name');

-- expected babies cannot be logged for; marking born unlocks it
select t.fails($$ insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'feeding', '{}' from public.babies where name = 'Unborn' $$, 'no logs for an unborn baby');
update public.babies set status = 'born', birth_date = '2026-06-01', due_date = null where name = 'Unborn';
select t.ok($$ insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'feeding', '{}' from public.babies where name = 'Unborn' $$, 'after birth, logging works');
update public.babies set status = 'expected', birth_date = null, due_date = '2027-01-01' where name = 'Unborn';

select t.owner();
select set_config('t.code', (select h.invite_code from public.households h join public.profiles p on p.household_id = h.id where p.id = t.u(1)), true);
select t.login(t.u(2));
select public.join_household(current_setting('t.code'));

-- timers
select t.login(t.u(1));
select t.ok($$ insert into public.active_sleeps (baby_id) select id from public.babies where name = 'Mia' $$, 'A starts Mia''s timer');
select t.fails($$ insert into public.active_sleeps (baby_id) select id from public.babies where name = 'Unborn' $$, 'no timer for an unborn baby');
select t.fails($$ insert into public.active_sleeps (baby_id, started_by) select id, t.u(2) from public.babies where name = 'Leo' $$, 'cannot start a timer in someone else''s name');
select t.login(t.u(2));
select t.eq((select count(*) from public.active_sleeps)::text, '1', 'partner sees the timer');
select t.login(t.u(3));
select t.eq((select count(*) from public.active_sleeps)::text, '0', 'stranger does not');
select t.ok($$ delete from public.active_sleeps $$, 'stranger delete is allowed to run but...');
select t.owner();
select t.eq((select count(*) from public.active_sleeps)::text, '1', '...removed nothing');

-- both parents press "Woke up": the first claim gets the row, the second gets nothing (so only one nap)
create function t.claim_mia() returns int language plpgsql as $$
declare n int;
begin
  with c as (delete from public.active_sleeps where baby_id = (select id from public.babies where name = 'Mia') returning 1)
  select count(*) into n from c;
  return n;
end $$;
select t.login(t.u(1));
select t.eq(t.claim_mia()::text, '1', 'first claim wins');
select t.login(t.u(2));
select t.eq(t.claim_mia()::text, '0', 'second claim gets nothing (so only one nap is saved)');

-- deleting a baby removes timers and logs
select t.login(t.u(1));
insert into public.active_sleeps (baby_id) select id from public.babies where name = 'Leo';
insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'feeding', '{}' from public.babies where name = 'Leo';
delete from public.babies where name = 'Leo';
select t.eq((select count(*) from public.active_sleeps)::text, '0', 'timer removed with the baby');
select t.eq((select count(*) from public.logs where baby_id is not null and type = 'feeding' and baby_id not in (select id from public.babies))::text, '0', 'no orphan logs');

-- live sync wiring
select t.owner();
select t.eq((select string_agg(tablename, ',' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime'), 'active_sleeps,babies,logs,profiles', 'realtime publishes the four synced tables');
select t.eq((select string_agg(relname, ',' order by relname) from pg_class where relname in ('logs', 'babies', 'active_sleeps') and relreplident = 'f'), 'active_sleeps,babies,logs', 'deletes carry household_id (replica identity full)');
rollback;
