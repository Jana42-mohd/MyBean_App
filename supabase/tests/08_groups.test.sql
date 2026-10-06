-- Small group chats (migration 0013).
begin;
select t.mkuser(t.u(1), 'Alex'), t.mkuser(t.u(2), 'Blake'), t.mkuser(t.u(3), 'Casey'), t.mkuser(t.u(4), 'Drew'),
       t.mkuser(t.u(5), 'Eli'), t.mkuser(t.u(7), 'Mod');
update public.profiles set is_moderator = true where id = t.u(7);

-- everybody is discoverable in the same place, Alex is connected to 2,3,4; Blake to 3; (5 to nobody)
create function t.v(n int) returns uuid language sql immutable as $$ select ('b0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.place(uid uuid) returns void language plpgsql as $$
begin perform t.login(uid); insert into public.neighbor_profiles (user_id, country, city, area, discoverable) values (uid, 'CA', 'Toronto', 'Annex', true); perform t.owner(); end $$;
create function t.connect(a uuid, b uuid) returns void language plpgsql as $$
declare c uuid;
begin
  perform t.login(a); c := public.request_connection(b);
  perform t.login(b); perform public.respond_connection(c, true);
  perform t.owner();
end $$;
create function t.names(q text) returns text language plpgsql as $$
declare r text;
begin execute 'select coalesce(string_agg(name, '','' order by name), '''') from (' || q || ') x' into r; return r; end $$;
grant execute on function t.v(int), t.place(uuid), t.connect(uuid, uuid), t.names(text) to authenticated;
select t.place(t.u(n)) from generate_series(1, 5) n;
select t.connect(t.u(1), t.u(2)), t.connect(t.u(1), t.u(3)), t.connect(t.u(1), t.u(4)), t.connect(t.u(2), t.u(3));

-- ---- creating ----
select t.login(t.u(1));
select t.fails($$ select public.create_group('', array[t.u(2)]) $$, 'a group needs a name');
select t.fails($$ select public.create_group(repeat('x', 41), array[t.u(2)]) $$, 'name at most 40 characters');
select t.fails($$ select public.create_group('Solo', array[]::uuid[]) $$, 'needs someone to invite');
select t.fails($$ select public.create_group('Strangers', array[t.u(5)]) $$, 'can only invite connected parents');
select t.fails($$ select public.create_group('Mixed', array[t.u(2), t.u(5)]) $$, 'one stranger in the list refuses the whole group');
select t.fails($$ select public.create_group('Me', array[t.u(1)]) $$, 'inviting only yourself is not a group');
select set_config('t.g', public.create_group('Annex playgroup', array[t.u(2), t.u(3)])::text, true);
select t.eq((select count(*) from public.my_groups())::text, '1', 'creator sees the group');
select t.eq((select status from public.my_groups()), 'member', 'as a member');
select t.eq((select member_count::text from public.my_groups()), '1', 'only the creator is a member so far');
select t.fails($$ insert into public.chat_groups (name) values ('direct') $$, 'groups cannot be inserted directly');
select t.fails($$ insert into public.group_members (group_id, user_id, status) values (current_setting('t.g')::uuid, t.u(5), 'member') $$, 'nor members');

-- ---- invitations ----
select t.login(t.u(2));
select t.eq((select status from public.my_groups()), 'invited', 'Blake is invited, not yet in');
select t.eq((select invited_by_name from public.my_groups()), 'Alex', 'and sees who invited');
select t.eq((select count(*) from public.group_messages)::text, '0', 'invited people read nothing');
select t.fails($$ insert into public.group_messages (group_id, body) values (current_setting('t.g')::uuid, 'hi') $$, 'and cannot write');
select t.eq((select count(*) from public.group_people(current_setting('t.g')::uuid))::text, '0', 'invitees do not see who else is in');
select t.ok($$ select public.respond_group_invite(current_setting('t.g')::uuid, true) $$, 'Blake accepts');
select t.fails($$ select public.respond_group_invite(current_setting('t.g')::uuid, true) $$, 'accepting twice');
select t.login(t.u(4));
select t.fails($$ select public.respond_group_invite(current_setting('t.g')::uuid, true) $$, 'someone not invited cannot accept');
select t.eq((select count(*) from public.my_groups())::text, '0', 'and sees nothing');
select t.login(t.u(3));
select t.ok($$ select public.respond_group_invite(current_setting('t.g')::uuid, true) $$, 'Casey accepts');
select t.eq(t.names($$ select * from public.group_people(current_setting('t.g')::uuid) $$), 'Alex,Blake,Casey', 'members see each other');

-- inviting more
select t.login(t.u(2));
select t.fails($$ select public.invite_to_group(current_setting('t.g')::uuid, t.u(4)) $$, 'Blake is not connected to Drew, so cannot invite him');
select t.login(t.u(1));
select t.fails($$ select public.invite_to_group(current_setting('t.g')::uuid, t.u(2)) $$, 'already in');
select t.fails($$ select public.invite_to_group(current_setting('t.g')::uuid, t.u(5)) $$, 'not connected');
select t.ok($$ select public.invite_to_group(current_setting('t.g')::uuid, t.u(4)) $$, 'Alex invites Drew');
select t.login(t.u(5));
select t.fails($$ select public.invite_to_group(current_setting('t.g')::uuid, t.u(1)) $$, 'outsiders cannot invite');

-- ---- chatting ----
select t.login(t.u(1));
select t.ok($$ insert into public.group_messages (group_id, body) values (current_setting('t.g')::uuid, 'Welcome!') $$, 'Alex writes');
select t.fails($$ insert into public.group_messages (group_id, sender, body) values (current_setting('t.g')::uuid, t.u(2), 'spoof') $$, 'no spoofing');
select t.fails($$ insert into public.group_messages (group_id, body) values (current_setting('t.g')::uuid, repeat('x', 1001)) $$, 'length limit');
select t.login(t.u(3));
select t.eq((select count(*) from public.group_messages)::text, '1', 'Casey reads it');
select t.ok($$ insert into public.group_messages (group_id, body) values (current_setting('t.g')::uuid, 'Thanks!') $$, 'Casey replies');
select t.fails($$ update public.group_messages set body = 'edited' $$, 'no editing');
select t.login(t.u(5));
select t.eq((select count(*) from public.group_messages)::text, '0', 'outsiders read nothing');
select t.fails($$ insert into public.group_messages (group_id, body) values (current_setting('t.g')::uuid, 'hi') $$, 'and cannot write');
select t.login(t.u(7));
select t.eq((select count(*) from public.group_messages)::text, '0', 'moderators cannot read group chats');
select t.login(t.u(4));
select t.eq((select count(*) from public.group_messages)::text, '0', 'invited Drew cannot read yet');
select t.login(t.u(3));
select t.ok($$ delete from public.group_messages where body = 'Welcome!' $$, 'deleting someone else''s message runs...');
select t.eq((select count(*) from public.group_messages)::text, '2', '...but removes nothing');
select t.login(t.u(2));
select t.ok($$ insert into public.group_messages (group_id, body) select current_setting('t.g')::uuid, 'n' || g from generate_series(1, 19) g $$, '19 in a minute is fine');
select t.fails($$ insert into public.group_messages (group_id, body) select current_setting('t.g')::uuid, 'n' || g from generate_series(1, 2) g $$, 'the 21st in a minute is refused');

-- ---- size limit: 8 people including invitations ----
select t.owner();
select t.mkuser(t.v(g), 'P' || g) from generate_series(1, 6) g;
select t.place(t.v(g)) from generate_series(1, 6) g;
select t.connect(t.v(g), t.u(1)) from generate_series(1, 6) g;
select t.login(t.u(1));
-- members/invited so far: Alex, Blake, Casey, Drew = 4; add 4 more reaches 8
select t.ok($$ select public.invite_to_group(current_setting('t.g')::uuid, t.v(g)) from generate_series(1, 4) g $$, 'up to 8 people');
select t.fails($$ select public.invite_to_group(current_setting('t.g')::uuid, t.v(5)) $$, 'the 9th is refused');
select t.ok($$ select public.remove_from_group(current_setting('t.g')::uuid, t.v(4)) $$, 'removing an invitee frees a seat');
select t.ok($$ select public.invite_to_group(current_setting('t.g')::uuid, t.v(5)) $$, 'so another can be invited');
select t.fails($$ select public.create_group('Too big', array(select t.v(g) from generate_series(1, 8) g)) $$, 'a new group cannot start with more than 7 invitees');

-- ---- who can remove, delete, leave ----
select t.login(t.u(2));
select t.fails($$ select public.remove_from_group(current_setting('t.g')::uuid, t.u(3)) $$, 'only the creator removes people');
select t.fails($$ select public.delete_group(current_setting('t.g')::uuid) $$, 'only the creator deletes the group');
select t.ok($$ select public.mute_group(current_setting('t.g')::uuid, true) $$, 'anyone can mute');
select t.eq((select muted::text from public.my_groups()), 'true', 'muted');

-- ---- notifications: who and where, never the text; muted people are skipped ----
select t.owner();
update public.group_messages set created_at = now() - interval '1 hour';   -- an hour has passed
select t.login(t.u(1)); select public.register_push_token('ExponentPushToken[alex]', 'ios');
select t.login(t.u(2)); select public.register_push_token('ExponentPushToken[blake]', 'ios');
select t.login(t.u(3)); select public.register_push_token('ExponentPushToken[casey]', 'ios');
select t.owner();
delete from net.sent;
select t.login(t.u(1));
insert into public.group_messages (group_id, body) values (current_setting('t.g')::uuid, 'SECRET-GROUP-TEXT');
insert into public.group_messages (group_id, body) values (current_setting('t.g')::uuid, 'second');
select t.owner();
select t.eq((select count(*) from net.sent)::text, '1', 'a burst is one notification');
select t.eq((select count(*) from net.sent s, jsonb_array_elements(s.body) m)::text, '1', 'only Casey (Blake muted, Alex wrote it)');
select t.eq((select m->>'to' from net.sent s, jsonb_array_elements(s.body) m), 'ExponentPushToken[casey]', 'it goes to Casey');
select t.eq((select m->>'body' from net.sent s, jsonb_array_elements(s.body) m), 'Alex wrote in Annex playgroup', 'it says who and where');
select t.eq((select count(*) from net.sent where body::text like '%SECRET%')::text, '0', 'never the text');

-- ---- reports ----
select t.login(t.u(3));
select t.ok($$ select public.report_group_message((select id from public.group_messages where body = 'SECRET-GROUP-TEXT'), 'harassment', 'rude') $$, 'Casey reports a message');
select t.fails($$ select public.report_group_message((select id from public.group_messages where body = 'Thanks!'), 'spam') $$, 'not your own message');
select t.login(t.u(5));
select t.fails($$ select public.report_group_message((select id from public.group_messages where body = 'SECRET-GROUP-TEXT' limit 1), 'spam') $$, 'outsiders cannot report (they cannot see it)');
select t.login(t.u(7));
select t.eq((select message_excerpt from public.user_reports where reported = t.u(1)), 'SECRET-GROUP-TEXT', 'moderators get only the reported message');

-- ---- blocking removes you from shared groups ----
select t.login(t.u(3));
insert into public.user_blocks (blocked_id) values (t.u(2));
select t.eq((select count(*) from public.my_groups())::text, '0', 'Casey blocked Blake, so Casey left the group');
select t.login(t.u(1));
select t.eq(t.names($$ select * from public.group_people(current_setting('t.g')::uuid) where status = 'member' $$), 'Alex,Blake', 'the others stay');
select t.fails($$ select public.invite_to_group(current_setting('t.g')::uuid, t.u(3)) $$, 'and Casey cannot be invited back while the block stands');

-- ---- leaving and handing over ----
select t.login(t.u(1));
select t.ok($$ select public.leave_group(current_setting('t.g')::uuid) $$, 'creator leaves');
select t.owner();
select t.eq((select creator::text from public.chat_groups where id = current_setting('t.g')::uuid), t.u(2)::text, 'the longest-standing member takes over');
select t.login(t.u(1));
select t.fails($$ select public.leave_group(current_setting('t.g')::uuid) $$, 'cannot leave twice');
select t.login(t.u(2));
select t.ok($$ select public.remove_from_group(current_setting('t.g')::uuid, t.v(1)) $$, 'new owner can remove an invitee');

-- ---- deleting an account keeps the group for the others ----
select t.owner();
select set_config('t.g2', (select public.create_group('Second', array[t.u(3), t.u(4)])::text from (select t.login(t.u(1))) x), true);
select t.login(t.u(3)); select public.respond_group_invite(current_setting('t.g2')::uuid, true);
select t.login(t.u(4)); select public.respond_group_invite(current_setting('t.g2')::uuid, true);
select t.login(t.u(1));
select t.ok($$ select public.delete_my_account() $$, 'the creator deletes the account');
select t.owner();
select t.eq((select count(*) from public.chat_groups where id = current_setting('t.g2')::uuid)::text, '1', 'the group survives');
select t.ok($$ select 1 from public.chat_groups where id = current_setting('t.g2')::uuid and creator in (t.u(3), t.u(4)) $$, 'with a new owner');
select t.eq((select count(*) from public.group_members where group_id = current_setting('t.g2')::uuid)::text, '2', 'and the other two');

-- ---- a group of one disappears ----
select t.login(t.u(3));
select public.leave_group(current_setting('t.g2')::uuid);
select t.owner();
select t.eq((select count(*) from public.chat_groups where id = current_setting('t.g2')::uuid)::text, '0', 'when one person is left, the group is gone');

-- ---- limits on groups per person ----
select t.connect(t.u(2), t.u(5));
select t.login(t.u(2));
select t.ok($$ select public.create_group('G' || g, array[t.u(5)]) from generate_series(1, 4) g $$, 'up to 5 groups (one already)');
select t.fails($$ select public.create_group('G5', array[t.u(5)]) $$, 'the sixth is refused');
select t.anon();
select t.fails($$ select * from public.my_groups() $$, 'signed-out visitors cannot use groups');
rollback;
