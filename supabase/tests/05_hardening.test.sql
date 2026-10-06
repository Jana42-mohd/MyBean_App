-- Security hardening (migration 0010).
begin;
select t.mkuser(t.u(1), 'Alex'), t.mkuser(t.u(2), 'Blake'), t.mkuser(t.u(3), 'Casey'), t.mkuser(t.u(4), 'Mod');
update public.profiles set is_moderator = true where id = t.u(4);

-- new invite codes are 12 characters; old 8-character codes still match
select t.eq((select count(*) from public.households where char_length(invite_code) = 12)::text, '4', 'new households get 12-character codes');

-- guessing invite codes is throttled: 10 misses per hour, then even the right code is refused
select t.login(t.u(2));
do $$ begin for i in 1..10 loop perform public.join_household('WRONG' || i); end loop; end $$;
select t.eq((select count(*) from public.join_attempts)::text, '0', 'the attempt log is not readable by members (RLS)');
select t.owner();
select t.eq((select count(*) from public.join_attempts)::text, '10', 'ten failed guesses recorded');
select set_config('t.code', (select h.invite_code from public.households h join public.profiles p on p.household_id = h.id where p.id = t.u(1)), true);
select t.login(t.u(2));
select t.fails($$ select public.join_household(current_setting('t.code')) $$, 'locked out after 10 wrong guesses, even with the right code');
select t.login(t.u(3));
select t.ok($$ select public.join_household(current_setting('t.code')) $$, 'a different person with the right code still joins');

-- size limits
select t.login(t.u(1));
insert into public.babies (name) values ('Mia');
select t.fails($$ insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'feeding', jsonb_build_object('notes', repeat('x', 9000)) from public.babies $$, 'oversized log data rejected');
select t.fails($$ insert into public.surveys (user_id, data) values (auth.uid(), jsonb_build_object('a', repeat('x', 9000))) $$, 'oversized survey rejected');
select t.fails($$ insert into public.wellbeing_entries (kind, data) values ('checkin', jsonb_build_object('a', repeat('x', 20000))) $$, 'oversized wellbeing data rejected');
select t.fails($$ update public.profiles set name = repeat('x', 61) where id = auth.uid() $$, 'names are limited to 60 characters');
select t.fails($$ update public.profiles set name = '' where id = auth.uid() $$, 'names cannot be empty');
select t.fails($$ insert into public.posts (title, excerpt, tags) values ('t', 'e', array['a','b','c','d','e','f','g','h','i','j','k']) $$, 'at most 10 tags');
select t.ok($$ insert into public.logs (user_id, baby_id, type, data) select auth.uid(), id, 'feeding', jsonb_build_object('notes', repeat('x', 500)) from public.babies $$, 'normal-sized notes are fine');

-- posting rate limit: 10 per hour
do $$ begin for i in 1..10 loop insert into public.posts (title, excerpt) values ('p' || i, 'x'); end loop; end $$;
select t.fails($$ insert into public.posts (title, excerpt) values ('eleven', 'x') $$, 'the 11th post within an hour is refused');
select t.login(t.u(2));
select t.ok($$ insert into public.posts (title, excerpt) values ('other person is not affected', 'x') $$, 'the limit is per person');

-- profiles are private to the people who need them
select t.owner();
update public.profiles set name = 'Hidden Hermit' where id = t.u(2);
delete from public.posts where user_id = t.u(2);
select t.login(t.u(4));
select t.eq((select count(*) from public.profiles)::text, '4', 'moderators can see every profile');
select t.login(t.u(1));
select t.eq((select string_agg(name, ',' order by name) from public.profiles), 'Alex,Casey', 'members see themselves, their household and post authors, not everyone');
select t.login(t.u(2));
select t.eq((select count(*) from public.profiles)::text, '2', 'a member who never posted sees only themselves and post authors');
select t.anon();
select t.eq((select count(*) from public.profiles)::text, '0', 'signed-out visitors see no profiles');

-- sign-up names are untrusted
select t.owner();
select t.mkuser('a0000000-0000-0000-0000-0000000000f1', repeat('N', 200));
select t.eq((select char_length(name)::text from public.profiles where id = 'a0000000-0000-0000-0000-0000000000f1'), '60', 'very long sign-up names are cut to 60');

-- avatar bucket limits and trigger functions
select t.eq((select file_size_limit::text from storage.buckets where id = 'avatars'), '5242880', 'avatars are limited to 5 MB');
select t.eq((select array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'avatars'), 'image/jpeg,image/png,image/webp,image/gif', 'avatars must be images');
select t.login(t.u(1));
select t.fails($$ select public.handle_new_user() $$, 'trigger functions cannot be called by members');
select t.fails($$ select public.limit_post_rate() $$, 'post-limit trigger cannot be called directly');
rollback;
