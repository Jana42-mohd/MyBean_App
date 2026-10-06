-- Deleting an account removes personal data, and never wipes a baby's history a partner still needs.
begin;
select t.mkuser(t.u(1), 'Alex'), t.mkuser(t.u(2), 'Blake'), t.mkuser(t.u(3), 'Solo');

select t.login(t.u(1));
insert into public.babies (name) values ('Mia'), ('Leo');
select t.owner();
select set_config('t.code', (select h.invite_code from public.households h join public.profiles p on p.household_id = h.id where p.id = t.u(1)), true);
select t.login(t.u(2));
select public.join_household(current_setting('t.code'));

select t.login(t.u(1));
insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'feeding', '{}' from public.babies;
insert into public.logs (user_id, baby_id, type, data) values (auth.uid(), null, 'pumping', '{}');
insert into public.wellbeing_entries (kind, score) values ('checkin', 2);
insert into public.posts (title, excerpt) values ('A post', 'by A');
insert into public.surveys (user_id, data) values (auth.uid(), '{"parentName":"Alex"}');
select t.login(t.u(2));
insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'diaper', '{}' from public.babies where name = 'Mia';
select t.login(t.u(3));
insert into public.babies (name) values ('Solo baby');
insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'feeding', '{}' from public.babies;

select t.anon();
select t.fails($$ select public.delete_my_account() $$, 'signed-out visitors cannot delete accounts');
select t.owner();
select t.fails($$ select public.delete_my_account() $$, 'no signed-in user: refused');

-- A deletes while B remains
select t.login(t.u(1));
select public.delete_my_account();
select t.owner();
select t.eq((select count(*) from auth.users where id = t.u(1))::text, '0', 'A''s login is gone');
select t.eq((select count(*) from public.profiles where id = t.u(1))::text, '0', 'A''s profile is gone');
select t.eq((select count(*) from public.wellbeing_entries)::text, '0', 'A''s wellbeing is gone');
select t.eq((select count(*) from public.posts)::text, '0', 'A''s posts are gone');
select t.eq((select count(*) from public.surveys)::text, '0', 'A''s survey is gone');
select t.eq((select count(*) from public.logs where type = 'pumping')::text, '0', 'A''s personal pumping logs are gone');
select t.login(t.u(2));
select t.eq((select count(*) from public.babies)::text, '2', 'B keeps the babies');
select t.eq((select count(*) from public.logs where type = 'feeding')::text, '2', 'B keeps the feedings A entered');
select t.eq((select count(*) from public.logs where user_id = auth.uid())::text, '3', 'those logs now belong to B');

-- B, the last member, deletes: the household goes too (but Solo's is untouched)
select public.delete_my_account();
select t.owner();
select t.eq((select count(*) from public.households)::text, '1', 'only Solo''s household remains');
select t.eq((select count(*) from public.babies)::text, '1', 'only Solo''s baby remains');
select t.eq((select count(*) from public.logs)::text, '1', 'only Solo''s log remains');
select t.login(t.u(3));
select public.delete_my_account();
select t.owner();
select t.eq((select count(*) from public.profiles)::text, '0', 'nothing is left behind');
select t.eq((select count(*) from public.households)::text, '0', 'no orphan households');
rollback;
