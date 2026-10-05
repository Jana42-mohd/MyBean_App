-- Households: two parents, one baby; strangers see nothing; no way to join without the code.
begin;
select t.mkuser(t.u(1), 'Alex'), t.mkuser(t.u(2), 'Blake'), t.mkuser(t.u(3), 'Casey');
select t.eq((select count(*) from public.profiles where household_id is not null)::text, '3', 'every new user gets a profile and a household');

select t.login(t.u(1));
insert into public.babies (name) values ('Mia'), ('Leo');
insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'feeding', '{}' from public.babies;
insert into public.logs (user_id, baby_id, type, data) values (auth.uid(), null, 'pumping', '{"volumeOz":"3"}');
select t.eq((select count(*) from public.logs)::text, '3', 'A sees own logs');
select t.fails($$ insert into public.logs (user_id, baby_id, type, data) values (auth.uid(), null, 'feeding', '{}') $$, 'a feeding needs a baby');
select t.fails($$ insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'bogus', '{}' from public.babies limit 1 $$, 'unknown log type is rejected');
select t.ok($$ insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'growth', '{"date":"2026-01-01","weightKg":4.2}' from public.babies limit 1 $$, 'growth measurements are a valid log type');
select t.fails($$ insert into public.wellbeing_entries (kind, score) values ('diary', 3) $$, 'unknown wellbeing kind rejected');
select t.ok($$ insert into public.wellbeing_entries (kind, score) values ('checkin', 2) $$, 'A can record wellbeing');

-- B starts alone and cannot see or join anything by itself
select t.login(t.u(2));
insert into public.babies (name) values ('Zed');
select t.eq((select count(*) from public.logs)::text, '0', 'B sees none of A''s logs');
select t.eq((select count(*) from public.wellbeing_entries)::text, '0', 'B sees none of A''s wellbeing');
select t.fails($$ update public.profiles set household_id = (select id from public.households limit 1) where id = auth.uid() $$, 'cannot move yourself into a household directly');
select t.eq(coalesce(public.join_household('NOPE0000')::text, 'null'), 'null', 'an invalid invite code joins nothing');

-- B joins with A's code; B's own baby comes along
select t.owner();
select set_config('t.code', (select h.invite_code from public.households h join public.profiles p on p.household_id = h.id where p.id = t.u(1)), true);
select t.login(t.u(2));
select public.join_household(current_setting('t.code'));
select t.eq((select string_agg(name, ',' order by name) from public.babies), 'Leo,Mia,Zed', 'after joining, B sees A''s babies plus their own');
select t.eq((select count(*) from public.logs)::text, '4', 'B sees the shared logs');
select t.eq((select count(*) from public.profiles where household_id = public.my_household())::text, '2', 'two members');
insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'diaper', '{"type":"pee"}' from public.babies where name = 'Mia';
select t.fails($$ insert into public.logs (user_id, baby_id, type, data) select t.u(1), id, 'diaper', '{}' from public.babies where name = 'Mia' $$, 'cannot log in someone else''s name');
select t.eq((select string_agg(distinct p.name, ',') from public.logs l join public.profiles p on p.id = l.user_id), 'Alex,Blake', 'logs show who logged them');

-- A sees B's log, but never B's private wellbeing
select t.login(t.u(1));
select t.eq((select count(*) from public.logs where type = 'diaper')::text, '1', 'A sees B''s diaper log');
select t.login(t.u(2));
insert into public.wellbeing_entries (kind, score) values ('checkin', 1);
select t.login(t.u(1));
select t.eq((select count(*) from public.wellbeing_entries)::text, '1', 'A sees only A''s own wellbeing (not B''s)');

-- a stranger sees nothing and cannot write into the household
select t.owner();
select set_config('t.mia', (select id::text from public.babies where name = 'Mia'), true);
select set_config('t.hh', (select household_id::text from public.profiles where id = t.u(1)), true);
select t.login(t.u(3));
select t.eq((select count(*) from public.logs)::text, '0', 'stranger sees no logs');
select t.eq((select count(*) from public.babies)::text, '0', 'stranger sees no babies');
select t.fails($$ insert into public.logs (user_id, baby_id, type, data) values (auth.uid(), current_setting('t.mia')::uuid, 'diaper', '{}') $$, 'cannot log for another household''s baby');
select t.fails($$ insert into public.babies (household_id, name) values (current_setting('t.hh')::uuid, 'x') $$, 'cannot add a baby to a household you are not in');

-- leaving starts a fresh household
select t.login(t.u(2));
select public.leave_household();
select t.eq((select count(*) from public.babies)::text, '0', 'after leaving, B has no babies');
select t.login(t.u(1));
select t.eq((select count(*) from public.babies)::text, '3', 'A keeps the shared babies');
rollback;
