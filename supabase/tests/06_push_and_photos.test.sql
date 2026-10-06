-- Partner notifications and private milestone photos (migration 0011).
begin;
select t.mkuser(t.u(1), 'Alex'), t.mkuser(t.u(2), 'Blake'), t.mkuser(t.u(3), 'Casey');

select t.login(t.u(1));
insert into public.babies (name) values ('Mia'), ('Leo');
select t.owner();
select set_config('t.code', (select h.invite_code from public.households h join public.profiles p on p.household_id = h.id where p.id = t.u(1)), true);
select set_config('t.h1', (select household_id::text from public.profiles where id = t.u(1)), true);
select set_config('t.h3', (select household_id::text from public.profiles where id = t.u(3)), true);
select t.login(t.u(2));
select public.join_household(current_setting('t.code'));

-- ---- tokens ----
select t.login(t.u(1));
select t.ok($$ select public.register_push_token('ExponentPushToken[alex-phone]', 'ios') $$, 'register a token');
select t.login(t.u(2));
select t.ok($$ select public.register_push_token('ExponentPushToken[blake-phone]', 'android') $$, 'partner registers');
select t.eq((select count(*) from public.push_tokens)::text, '1', 'people only see their own tokens');
select t.fails($$ insert into public.push_tokens (token, user_id) values ('ExponentPushToken[forged]', auth.uid()) $$, 'tokens cannot be written directly');
select t.fails($$ update public.push_tokens set user_id = t.u(1) $$, 'tokens cannot be re-pointed directly');
select t.fails($$ select public.register_push_token('short', 'ios') $$, 'implausible tokens rejected');
select t.anon();
select t.fails($$ select public.register_push_token('ExponentPushToken[anon-phone]', 'ios') $$, 'signed-out visitors cannot register');
select t.fails($$ select public.notify_partners_of_logs() $$, 'the trigger function is not callable by the public');

-- ---- notifications ----
select t.login(t.u(1));
insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'feeding', '{"method":"breast"}' from public.babies;
select t.owner();
select t.eq((select count(*) from net.sent)::text, '1', 'logging for both babies is ONE notification');
select t.eq((select count(*) from net.sent s, jsonb_array_elements(s.body) m where m->>'to' = 'ExponentPushToken[blake-phone]')::text, '1', 'it goes to the partner');
select t.eq((select count(*) from net.sent s, jsonb_array_elements(s.body) m where m->>'to' = 'ExponentPushToken[alex-phone]')::text, '0', 'never to the person who logged');
select t.eq((select m->>'body' from net.sent s, jsonb_array_elements(s.body) m limit 1), 'Alex logged a feeding for Leo and Mia', 'message text');

-- opt out
select t.login(t.u(2));
update public.profiles set notify_partner = false where id = auth.uid();
select t.login(t.u(1));
insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'diaper', '{}' from public.babies where name = 'Mia';
select t.owner();
select t.eq((select count(*) from net.sent)::text, '1', 'partner who switched notifications off gets nothing');
select t.login(t.u(2));
update public.profiles set notify_partner = true where id = auth.uid();

-- old entries (late offline sync), pumping and the person with no partner do not notify
select t.login(t.u(1));
insert into public.logs (user_id, baby_id, type, data, logged_at) select auth.uid(), id, 'feeding', '{}', now() - interval '5 hours' from public.babies where name = 'Mia';
insert into public.logs (user_id, type, data) values (auth.uid(), 'pumping', '{}');
select t.owner();
select t.eq((select count(*) from net.sent)::text, '1', 'late and private entries do not notify');
select t.login(t.u(3));
select public.register_push_token('ExponentPushToken[casey-phone]', 'ios');
insert into public.babies (name) values ('Solo');
insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'feeding', '{}' from public.babies where name = 'Solo';
select t.owner();
select t.eq((select count(*) from net.sent)::text, '1', 'a household of one notifies nobody (not even its own phone)');

-- wellbeing never notifies and a failing push never blocks logging
select t.login(t.u(1));
insert into public.wellbeing_entries (kind, data) values ('checkin', '{}');
select t.owner();
select t.eq((select count(*) from net.sent)::text, '1', 'wellbeing entries do not notify');
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000)
returns bigint language plpgsql as $$ begin raise exception 'network down'; end $$;
select t.login(t.u(1));
select t.ok($$ insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'feeding', '{}' from public.babies where name = 'Leo' $$, 'a failing push never blocks saving a log');

-- a phone changing hands: the token moves to the new person
select t.login(t.u(3));
select public.register_push_token('ExponentPushToken[blake-phone]', 'android');
select t.owner();
select t.eq((select user_id::text from public.push_tokens where token = 'ExponentPushToken[blake-phone]'), t.u(3)::text, 'token moved to the new owner');

-- ---- photos ----
select t.ok($$ insert into storage.objects (bucket_id, name) values ('milestone-photos', current_setting('t.h1') || '/a.jpg') $$, 'owner-less insert as owner works (setup)');
select t.login(t.u(1));
select t.ok($$ insert into storage.objects (bucket_id, name) values ('milestone-photos', current_setting('t.h1') || '/b.jpg') $$, 'a member adds a photo to the household folder');
select t.fails($$ insert into storage.objects (bucket_id, name) values ('milestone-photos', current_setting('t.h3') || '/c.jpg') $$, 'but not to another household''s folder');
select t.fails($$ insert into storage.objects (bucket_id, name) values ('milestone-photos', 'loose.jpg') $$, 'nor outside any household folder');
select t.eq((select count(*) from storage.objects where bucket_id = 'milestone-photos')::text, '2', 'member sees the household photos');
select t.login(t.u(3));
select t.eq((select count(*) from storage.objects where bucket_id = 'milestone-photos' and name like current_setting('t.h1') || '/%')::text, '0', 'a stranger cannot see them');
select t.ok($$ delete from storage.objects where bucket_id = 'milestone-photos' and name like current_setting('t.h1') || '/%' $$, 'a stranger delete runs...');
select t.owner();
select t.eq((select count(*) from storage.objects where bucket_id = 'milestone-photos' and name like current_setting('t.h1') || '/%')::text, '2', '...but removes nothing');
select t.login(t.u(2));
select t.eq((select count(*) from storage.objects where name = current_setting('t.h1') || '/b.jpg')::text, '1', 'the partner sees them');
select t.ok($$ delete from storage.objects where name = current_setting('t.h1') || '/b.jpg' $$, 'partner removes one');
select t.anon();
select t.eq((select count(*) from storage.objects where bucket_id = 'milestone-photos')::text, '0', 'signed-out visitors see nothing');

select t.owner();
select t.eq((select public::text from storage.buckets where id = 'milestone-photos'), 'false', 'the bucket is private');
select t.eq((select array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'milestone-photos'), 'image/jpeg,image/png,image/webp', 'only images');

-- a log may only point at a photo in its own household folder
select t.login(t.u(1));
select t.ok($$ insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'milestone', jsonb_build_object('milestone', 'Smiled', 'photo', current_setting('t.h1') || '/a.jpg') from public.babies where name = 'Mia' $$, 'milestone with its own household''s photo');
select t.fails($$ insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'milestone', jsonb_build_object('milestone', 'Smiled', 'photo', current_setting('t.h3') || '/c.jpg') from public.babies where name = 'Mia' $$, 'cannot point at another household''s photo');
select t.fails($$ update public.logs set data = data || jsonb_build_object('photo', 'elsewhere/x.jpg') where type = 'milestone' $$, 'editing cannot swap in a foreign photo path');
rollback;
