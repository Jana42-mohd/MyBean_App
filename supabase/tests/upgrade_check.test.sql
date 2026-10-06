-- After upgrading: the old data is intact and now belongs to a household and a baby.
begin;
select t.eq((select count(*) from public.babies)::text, '1', 'the survey''s baby became a baby record');
select t.eq((select name || ' ' || birth_date::text || ' ' || gender || ' ' || feeding_type from public.babies), 'Mia 2025-03-14 girl breast', 'baby details carried over');
select t.eq((select count(*) from public.logs)::text, '3', 'no logs lost');
select t.eq((select count(*) from public.logs where baby_id is null)::text, '0', 'every log got a baby (including pumping)');
select t.eq((select count(*) from public.logs l join public.babies b on b.id = l.baby_id and b.household_id = l.household_id)::text, '3', 'logs belong to the baby''s household');
select t.eq((select count(*) from public.profiles where household_id is not null)::text, '1', 'the user has a household');
select t.eq((select char_length(name)::text from public.profiles), '60', 'old over-long names were shortened to fit the new rule');
select t.eq((select count(*) from public.posts_feed)::text, '1', 'the post is still in the feed');
select t.login('a0000000-0000-0000-0000-000000000001');
select t.eq((select count(*) from public.logs)::text, '3', 'the user still sees their logs under the new rules');
select t.eq((select count(*) from public.babies)::text, '1', 'and their baby');
select t.eq((select count(*) from public.posts)::text, '1', 'and their post');
rollback;
