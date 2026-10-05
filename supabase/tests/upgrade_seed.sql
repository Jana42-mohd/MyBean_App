-- State of a real project right after migration 0001 (before households, babies, etc.): one user who did the
-- survey, logged things, and wrote a post. Used to prove the later migrations upgrade existing data correctly.
insert into auth.users (id, email, raw_user_meta_data) values ('a0000000-0000-0000-0000-000000000001', 'me@x.com', '{"name":"Jana"}');
insert into public.surveys (user_id, data) values ('a0000000-0000-0000-0000-000000000001',
  '{"parentName":"Jana","babyName":"Mia","babyBirthDate":"2025-03-14","babyGender":"girl","gestationalAge":"full-term","feedingType":"breast","trackingPreferences":["sleep"]}');
insert into public.logs (user_id, type, data) values
  ('a0000000-0000-0000-0000-000000000001', 'feeding', '{"method":"breast"}'),
  ('a0000000-0000-0000-0000-000000000001', 'pumping', '{"volumeOz":"3"}'),
  ('a0000000-0000-0000-0000-000000000001', 'nap', '{"start":"2025-03-14 09:00","end":"2025-03-14 10:30"}');
insert into public.posts (user_id, title, excerpt) values ('a0000000-0000-0000-0000-000000000001', 'hi', 'there');
-- an old, over-long display name from before the 60-character rule
update public.profiles set name = repeat('J', 80) where id = 'a0000000-0000-0000-0000-000000000001';
