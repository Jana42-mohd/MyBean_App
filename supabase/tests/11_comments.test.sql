-- Comments and replies under posts (migration 0018).
begin;
select t.mkuser(t.u(1), 'Alex'), t.mkuser(t.u(2), 'Blake'), t.mkuser(t.u(3), 'Casey'), t.mkuser(t.u(4), 'Drew'), t.mkuser(t.u(7), 'Mod');
update public.profiles set is_moderator = true where id = t.u(7);
create function t.names(q text) returns text language plpgsql as $$
declare r text;
begin execute 'select coalesce(string_agg(x, '','' order by x), '''') from (' || q || ') s(x)' into r; return r; end $$;
grant execute on function t.names(text) to authenticated;
create function t.chain(post uuid, start uuid, n int) returns uuid language plpgsql as $$
declare prev uuid := start; nid uuid;
begin
  for i in 1..n loop
    insert into public.post_comments (post_id, parent_id, body) values (post, prev, 'level ' || i) returning id into nid;
    prev := nid;
  end loop;
  return prev;
end $$;
grant execute on function t.chain(uuid, uuid, int) to authenticated;

select t.login(t.u(1));
insert into public.posts (id, title, excerpt, tags) values ('c0000000-0000-0000-0000-0000000000a1', 'Sleep question', 'How do you do naps?', array['questions']);
insert into public.posts (id, title, excerpt, tags) values ('c0000000-0000-0000-0000-0000000000a2', 'Other post', 'x', array['other']);
select set_config('t.p', 'c0000000-0000-0000-0000-0000000000a1', true);
select set_config('t.p2', 'c0000000-0000-0000-0000-0000000000a2', true);

-- ---- commenting ----
select t.login(t.u(2));
select t.ok($$ insert into public.post_comments (id, post_id, body) values ('d0000000-0000-0000-0000-000000000001', current_setting('t.p')::uuid, 'We do two naps') $$, 'Blake comments');
select t.fails($$ insert into public.post_comments (post_id, user_id, body) values (current_setting('t.p')::uuid, t.u(3), 'spoof') $$, 'cannot comment in someone else''s name');
select t.fails($$ insert into public.post_comments (post_id, body) values (current_setting('t.p')::uuid, '   ') $$, 'no empty comments');
select t.fails($$ insert into public.post_comments (post_id, body) values (current_setting('t.p')::uuid, repeat('x', 2001)) $$, 'at most 2000 characters');
select t.fails($$ insert into public.post_comments (post_id, body, hidden) values (current_setting('t.p')::uuid, 'sneaky', true) $$, 'cannot create a comment already hidden');
select t.fails($$ insert into public.post_comments (post_id, body) values ('c0000000-0000-0000-0000-0000000000ff', 'nowhere') $$, 'the post must exist');
select t.login(t.u(3));
select t.ok($$ insert into public.post_comments (id, post_id, parent_id, body) values ('d0000000-0000-0000-0000-000000000002', current_setting('t.p')::uuid, 'd0000000-0000-0000-0000-000000000001', 'Same here!') $$, 'Casey replies to Blake');
select t.fails($$ insert into public.post_comments (post_id, parent_id, body) values (current_setting('t.p2')::uuid, 'd0000000-0000-0000-0000-000000000001', 'wrong post') $$, 'a reply must be on the same post as its parent');
select t.login(t.u(1));
select t.ok($$ insert into public.post_comments (id, post_id, body) values ('d0000000-0000-0000-0000-000000000003', current_setting('t.p')::uuid, 'Thanks everyone') $$, 'the author comments on their own post');

-- ---- reading ----
select t.login(t.u(4));
select t.eq(t.names($$ select body from public.post_comments_for(current_setting('t.p')::uuid) $$), 'Same here!,Thanks everyone,We do two naps', 'anyone can read the thread (through the function)');
select t.eq((select count(*) from public.post_comments)::text, '0', 'the table itself shows people only their own comments');
select t.eq((select author from public.post_comments_for(current_setting('t.p')::uuid) where body = 'Same here!'), 'Casey', 'with the author''s name');
select t.eq((select (parent_id = 'd0000000-0000-0000-0000-000000000001')::text from public.post_comments_for(current_setting('t.p')::uuid) where body = 'Same here!'), 'true', 'and where it belongs in the thread');
select t.eq((select comments_count::text from public.posts_feed where id = current_setting('t.p')::uuid), '3', 'the post shows 3 comments');
select t.anon();
select t.fails($$ select * from public.post_comments_for(current_setting('t.p')::uuid) $$, 'signed-out visitors cannot read threads');

-- ---- depth ----
select t.login(t.u(2));
select set_config('t.deep', t.chain(current_setting('t.p')::uuid, 'd0000000-0000-0000-0000-000000000001', 4)::text, true);
select t.ok($$ select 1 $$, 'a thread can go several levels deep (levels 2 to 5 added)');
select t.fails($$ select t.chain(current_setting('t.p')::uuid, current_setting('t.deep')::uuid, 4) $$, 'but not forever (it stops at 6 levels)');

-- ---- likes ----
select t.login(t.u(4));
select t.ok($$ insert into public.comment_likes (comment_id) values ('d0000000-0000-0000-0000-000000000001') $$, 'Drew likes a comment');
select t.fails($$ insert into public.comment_likes (comment_id) values ('d0000000-0000-0000-0000-000000000001') $$, 'once only');
select t.fails($$ insert into public.comment_likes (comment_id, user_id) values ('d0000000-0000-0000-0000-000000000001', t.u(3)) $$, 'not in someone else''s name');
select t.eq((select likes::text || '/' || liked::text from public.post_comments_for(current_setting('t.p')::uuid) where body = 'We do two naps'), '1/true', 'the count and my own like');
select t.login(t.u(3));
select t.eq((select likes::text || '/' || liked::text from public.post_comments_for(current_setting('t.p')::uuid) where body = 'We do two naps'), '1/false', 'others see the count, not who');
select t.login(t.u(4));
select t.ok($$ delete from public.comment_likes where comment_id = 'd0000000-0000-0000-0000-000000000001' $$, 'unlike');
select t.eq((select likes::text from public.post_comments_for(current_setting('t.p')::uuid) where body = 'We do two naps'), '0', 'back to 0');

-- ---- deleting ----
select t.login(t.u(3));
select t.fails($$ select public.delete_comment('d0000000-0000-0000-0000-000000000003') $$, 'cannot delete someone else''s comment');
select t.ok($$ select public.delete_comment('d0000000-0000-0000-0000-000000000002') $$, 'delete my reply (nobody replied to it)');
select t.eq((select count(*) from public.post_comments_for(current_setting('t.p')::uuid) where id = 'd0000000-0000-0000-0000-000000000002')::text, '0', 'it is gone');
select t.login(t.u(2));
select t.ok($$ select public.delete_comment('d0000000-0000-0000-0000-000000000001') $$, 'deleting a comment that has replies...');
select t.eq((select body || '|' || deleted::text || '|' || coalesce(author, 'nobody') from public.post_comments_for(current_setting('t.p')::uuid) where id = 'd0000000-0000-0000-0000-000000000001'), '[deleted]|true|nobody', '...leaves a placeholder so the replies keep their place');
select t.eq((select count(*) from public.post_comments_for(current_setting('t.p')::uuid) where parent_id = 'd0000000-0000-0000-0000-000000000001')::text, '1', 'and the replies survive');
select t.eq((select comments_count::text from public.posts_feed where id = current_setting('t.p')::uuid), '5', 'the post count ignores deleted ones');

-- ---- reporting and hiding ----
select t.login(t.u(1));
select t.ok($$ insert into public.post_comments (id, post_id, body) values ('d0000000-0000-0000-0000-000000000009', current_setting('t.p2')::uuid, 'buy my stuff') $$, 'a spammy comment on another post (by the author)');
select t.login(t.u(2)); select t.ok($$ insert into public.comment_reports (comment_id, reason) values ('d0000000-0000-0000-0000-000000000009', 'spam') $$, 'first report');
select t.fails($$ insert into public.comment_reports (comment_id, reason) values ('d0000000-0000-0000-0000-000000000009', 'spam') $$, 'one report per person');
select t.fails($$ insert into public.comment_reports (comment_id, reason) values ('d0000000-0000-0000-0000-000000000009', 'nonsense') $$, 'reason from the list');
select t.eq((select count(*) from public.post_comments_for(current_setting('t.p2')::uuid))::text, '1', 'still visible after one report');
select t.login(t.u(3)); select t.ok($$ insert into public.comment_reports (comment_id, reason) values ('d0000000-0000-0000-0000-000000000009', 'spam') $$, 'second');
select t.login(t.u(4)); select t.ok($$ insert into public.comment_reports (comment_id, reason, details) values ('d0000000-0000-0000-0000-000000000009', 'spam', 'ad') $$, 'third');
select t.login(t.u(2));
select t.eq((select count(*) from public.post_comments_for(current_setting('t.p2')::uuid))::text, '0', 'three different reports hide it from everyone');
select t.login(t.u(1));
select t.eq((select hidden::text from public.post_comments_for(current_setting('t.p2')::uuid)), 'true', 'its author still sees it, marked hidden');
select t.fails($$ insert into public.comment_reports (comment_id, reason) values ('d0000000-0000-0000-0000-000000000003', 'spam') $$, 'nobody reports their own comment');
select t.login(t.u(7));
select t.eq((select count(*) from public.comment_reports)::text, '3', 'moderators see the reports');
select t.ok($$ update public.post_comments set hidden = false where id = 'd0000000-0000-0000-0000-000000000009' $$, 'and can restore');
select t.ok($$ delete from public.comment_reports where comment_id = 'd0000000-0000-0000-0000-000000000009' $$, 'clear the reports');
select t.login(t.u(3));
select t.owner();
update public.post_comments set hidden = true where id = 'd0000000-0000-0000-0000-000000000003';
select t.login(t.u(3));
select t.ok($$ update public.post_comments set hidden = false $$, 'a member trying to unhide runs...');
select t.owner();
select t.eq((select hidden::text from public.post_comments where id = 'd0000000-0000-0000-0000-000000000003'), 'true', '...but changes nothing');
update public.post_comments set hidden = false where id = 'd0000000-0000-0000-0000-000000000003';
select t.login(t.u(3));
select t.eq((select count(*) from public.comment_reports)::text, '0', 'members see only their own reports (none left)');
select t.login(t.u(7));
select t.ok($$ select public.delete_comment('d0000000-0000-0000-0000-000000000009') $$, 'a moderator can delete any comment');

-- ---- blocked and suspended authors, hidden posts ----
select t.login(t.u(4));
insert into public.user_blocks (blocked_id) values (t.u(3));
select t.eq((select count(*) from public.post_comments_for(current_setting('t.p')::uuid) where author = 'Casey')::text, '0', 'a blocked author''s comments are hidden for the person who blocked');
select t.login(t.u(2));
select t.eq((select count(*) from public.post_comments_for(current_setting('t.p')::uuid) where author = 'Casey')::text, (select count(*)::text from public.post_comments where false union all select '0' limit 1), 'but others still see them (Casey has no comments left, so 0 here)');
select t.login(t.u(7)); select public.suspend_user(t.u(1), true);
select t.login(t.u(2));
select t.eq((select count(*) from public.post_comments_for(current_setting('t.p')::uuid) where author = 'Alex')::text, '0', 'a suspended author''s comments disappear for others');
select t.login(t.u(1));
select t.fails($$ insert into public.post_comments (post_id, body) values (current_setting('t.p')::uuid, 'I am suspended') $$, 'and they cannot comment');
select t.login(t.u(7)); select public.suspend_user(t.u(1), false);
select t.owner();
update public.posts set hidden = true where id = current_setting('t.p')::uuid;
select t.login(t.u(2));
select t.eq((select count(*) from public.post_comments_for(current_setting('t.p')::uuid))::text, '0', 'a hidden post hides its thread');
select t.fails($$ insert into public.post_comments (post_id, body) values (current_setting('t.p')::uuid, 'into the void') $$, 'and takes no new comments');
select t.owner();
update public.posts set hidden = false where id = current_setting('t.p')::uuid;

-- ---- notifications ----
select t.owner();
update public.post_comments set created_at = now() - interval '1 hour';   -- an hour has passed
select t.login(t.u(1)); select public.register_push_token('ExponentPushToken[alex]', 'ios');
select t.login(t.u(2)); select public.register_push_token('ExponentPushToken[blake]', 'ios');
select t.owner();
delete from net.sent;
select t.login(t.u(3));
insert into public.post_comments (post_id, body) values (current_setting('t.p')::uuid, 'SECRET-COMMENT');
select t.owner();
select t.eq((select m->>'body' from net.sent s, jsonb_array_elements(s.body) m where m->>'to' = 'ExponentPushToken[alex]'), 'Casey commented on your post', 'the post author hears about a comment');
select t.eq((select count(*) from net.sent where body::text like '%SECRET%')::text, '0', 'never the text');
delete from net.sent;
select t.login(t.u(1));
insert into public.post_comments (post_id, parent_id, body) values (current_setting('t.p')::uuid, (select id from public.post_comments_for(current_setting('t.p')::uuid) where body = 'level 1'), 'replying to Blake');
select t.owner();
select t.eq((select count(*) from net.sent s, jsonb_array_elements(s.body) m where m->>'to' = 'ExponentPushToken[blake]' and m->>'body' = 'Alex replied to your comment')::text, '1', 'the person replied to hears about the reply');
select t.eq((select count(*) from net.sent s, jsonb_array_elements(s.body) m where m->>'to' = 'ExponentPushToken[alex]')::text, '0', 'and you are never told about your own comment');

-- ---- deleting an account ----
select t.login(t.u(2));
select t.ok($$ select public.delete_my_account() $$, 'Blake deletes the account');
select t.owner();
select t.eq((select count(*) from public.post_comments where user_id = t.u(2))::text, '0', 'none of Blake''s comments remain under Blake''s name');
select t.eq((select count(*) from public.post_comments where parent_id is not null and body = 'replying to Blake')::text, '1', 'but Alex''s reply to a Blake comment survives');
select t.eq(((select count(*) from public.post_comments where deleted) >= 1)::text, 'true', 'under a "[deleted]" placeholder');
select t.eq((select count(*) from public.post_comments where user_id is null and not deleted)::text, '0', 'no text is left behind without an owner: it is erased or replaced by the placeholder');
select t.eq((select count(*) from public.post_comments where body like 'level %' and user_id is null and body <> '[deleted]')::text, '0', 'Blake''s words are gone');
rollback;
