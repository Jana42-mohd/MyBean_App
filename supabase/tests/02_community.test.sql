-- Community: posts, reports, auto-hide, moderators, blocking, suspension.
begin;
select t.mkuser(t.u(1), 'Alex'), t.mkuser(t.u(2), 'Blake'), t.mkuser(t.u(3), 'Casey'), t.mkuser(t.u(4), 'Dana'), t.mkuser(t.u(5), 'Mod');
update public.profiles set is_moderator = true where id = t.u(5);

select t.login(t.u(2));
insert into public.posts (title, excerpt, tags) values ('Blake post', 'hello', '{sleep}');
select t.login(t.u(3));
insert into public.posts (title, excerpt) values ('Casey post', 'hi');

-- everyone signed in sees both; anonymous sees nothing
select t.eq((select count(*) from public.posts_feed)::text, '2', 'feed shows both posts');
select t.anon();
select t.eq((select count(*) from public.posts)::text, '0', 'signed-out visitors see no posts');
select t.login(t.u(1));

-- you can only change your own things
select t.eq((select count(*) from public.posts)::text, '2', 'deleting someone else''s post removes nothing');
select t.fails($$ update public.posts set title = 'hacked' $$, 'posts cannot be edited by members');
select t.fails($$ update public.profiles set is_moderator = true where id = auth.uid() $$, 'cannot make yourself a moderator');
select t.fails($$ update public.profiles set suspended = false where id = auth.uid() $$, 'cannot change your suspension');
select t.fails($$ select public.suspend_user(t.u(2), true) $$, 'only moderators can suspend');

-- reports: one per person per post, three people hide a post
select t.owner();
select set_config('t.post', (select id::text from public.posts where title = 'Blake post'), true);
select t.login(t.u(1));
select t.ok($$ insert into public.post_reports (post_id, reason) values (current_setting('t.post')::uuid, 'spam') $$, 'report accepted');
select t.fails($$ insert into public.post_reports (post_id, reason) values (current_setting('t.post')::uuid, 'spam') $$, 'cannot report the same post twice');
select t.fails($$ insert into public.post_reports (post_id, reason) values (current_setting('t.post')::uuid, 'bogus') $$, 'unknown report reason rejected');
select t.fails($$ insert into public.post_reports (post_id, reason, details) values (current_setting('t.post')::uuid, 'other', repeat('x', 501)) $$, 'report details are limited to 500 characters');
select t.login(t.u(3));
select t.ok($$ insert into public.post_reports (post_id, reason) values (current_setting('t.post')::uuid, 'harassment') $$, 'second report');
select t.eq((select count(*) from public.posts_feed)::text, '2', 'two reports do not hide it');
select t.login(t.u(4));
select t.ok($$ insert into public.post_reports (post_id, reason) values (current_setting('t.post')::uuid, 'other') $$, 'third report');
select t.eq((select count(*) from public.posts_feed)::text, '1', 'three reports hide the post from the feed');
select t.eq((select count(*) from public.posts)::text, '1', 'hidden posts are not readable by other members');
select t.eq((select count(*) from public.post_reports)::text, '1', 'members only see their own reports');
select t.login(t.u(2));
select t.eq((select count(*) from public.posts where title = 'Blake post')::text, '1', 'the author can still see their hidden post');

-- moderators see everything and can restore
select t.login(t.u(5));
select t.eq((select count(*) from public.posts)::text, '2', 'moderator sees hidden posts');
select t.eq((select count(*) from public.post_reports)::text, '3', 'moderator sees all reports');
select t.ok($$ delete from public.post_reports where post_id = current_setting('t.post')::uuid $$, 'moderator clears reports');
select t.ok($$ update public.posts set hidden = false where id = current_setting('t.post')::uuid $$, 'moderator restores the post');
select t.eq((select count(*) from public.posts_feed)::text, '2', 'restored post is back in the feed');
select t.fails($$ update public.posts set title = 'edited' $$, 'even moderators cannot rewrite posts');

-- blocking hides a member's posts only for the blocker
select t.login(t.u(3));
select t.ok($$ insert into public.user_blocks (blocked_id) values (t.u(2)) $$, 'block a member');
select t.eq((select count(*) from public.posts_feed)::text, '1', 'blocker no longer sees the blocked member''s posts');
select t.fails($$ insert into public.user_blocks (blocked_id) values (auth.uid()) $$, 'cannot block yourself');
select t.fails($$ insert into public.user_blocks (blocker_id, blocked_id) values (t.u(1), t.u(2)) $$, 'cannot block on someone else''s behalf');
select t.login(t.u(1));
select t.eq((select count(*) from public.posts_feed)::text, '2', 'other members are unaffected');
select t.eq((select count(*) from public.user_blocks)::text, '0', 'block lists are private');
select t.login(t.u(3));
select t.ok($$ delete from public.user_blocks where blocked_id = t.u(2) $$, 'unblock');
select t.eq((select count(*) from public.posts_feed)::text, '2', 'unblocked: posts are back');

-- suspension
select t.login(t.u(5));
select t.fails($$ select public.suspend_user(t.u(5), true) $$, 'moderators cannot suspend themselves');
select t.ok($$ select public.suspend_user(t.u(2), true) $$, 'moderator suspends a member');
select t.login(t.u(1));
select t.eq((select count(*) from public.posts_feed)::text, '1', 'suspended member''s posts vanish for everyone');
select t.login(t.u(2));
select t.fails($$ insert into public.posts (title, excerpt) values ('still here', 'x') $$, 'suspended members cannot post');
select t.login(t.u(5));
select t.ok($$ select public.suspend_user(t.u(2), false) $$, 'restore');
select t.login(t.u(2));
select t.ok($$ insert into public.posts (title, excerpt) values ('back again', 'x') $$, 'restored member can post');

-- authors delete their own posts
select t.ok($$ delete from public.posts where title = 'back again' $$, 'author deletes own post');
select t.eq((select count(*) from public.posts where title = 'back again')::text, '0', 'it is gone');
rollback;
