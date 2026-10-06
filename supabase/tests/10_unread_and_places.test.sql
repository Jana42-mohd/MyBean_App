-- Unread counts and cities picked from a list (migration 0015).
begin;
select t.mkuser(t.u(1), 'Alex'), t.mkuser(t.u(2), 'Blake'), t.mkuser(t.u(3), 'Casey'), t.mkuser(t.u(4), 'Drew'), t.mkuser(t.u(7), 'Mod');
create function t.v(n int) returns uuid language sql immutable as $$ select ('b0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.place(uid uuid, c text, city text, region text, area text default null) returns void language plpgsql as $$
begin
  perform t.login(uid);
  insert into public.neighbor_profiles (user_id, country, city, region, area, discoverable) values (uid, c, city, region, area, true);
  perform t.owner();
end $$;
create function t.connect(a uuid, b uuid) returns void language plpgsql as $$
declare c uuid;
begin perform t.login(a); c := public.request_connection(b); perform t.login(b); perform public.respond_connection(c, true); perform t.owner(); end $$;
create function t.names(q text) returns text language plpgsql as $$
declare r text;
begin execute 'select coalesce(string_agg(name, '','' order by name), '''') from (' || q || ') x' into r; return r; end $$;
grant execute on function t.v(int), t.place(uuid, text, text, text, text), t.connect(uuid, uuid), t.names(text) to authenticated;
update public.profiles set is_moderator = true where id = t.u(7);

-- ======== places ========
select t.eq(public.fold_text('Montréal'), 'montreal', 'accents are ignored');
select t.eq(public.fold_text('São Paulo'), 'sao paulo', 'São Paulo');
select t.eq(public.fold_text('Zürich'), 'zurich', 'Zürich');
select t.eq(public.fold_text('  St. John''s  '), 'st john s', 'punctuation and spaces');
select t.eq(public.fold_text('Straße'), 'strasse', 'ß');
select t.eq((public.fold_text(' . ') is null)::text, 'true', 'nothing left is nothing');

select t.mkuser(t.v(g), 'P' || g) from generate_series(1, 5) g;
select t.place(t.u(1), 'CA', 'Toronto', 'Ontario');
select t.place(t.u(2), 'CA', 'toronto', 'ONTARIO');          -- same place, written differently
select t.place(t.u(3), 'CA', 'Toronto', null);               -- typed by hand: no region
select t.place(t.v(1), 'US', 'Springfield', 'Illinois');
select t.place(t.v(2), 'US', 'Springfield', 'Missouri');
select t.place(t.v(3), 'US', 'Springfield', null);
select t.place(t.v(4), 'CA', 'Montréal', 'Quebec');
select t.place(t.v(5), 'CA', 'Montreal', null);

select t.login(t.u(1));
select t.eq(t.names($$ select * from public.nearby_parents('city') $$), 'Blake,Casey', 'Toronto, Ontario sees Toronto in any spelling, and a hand-typed Toronto');
select t.eq((select region from public.nearby_parents('city') where name = 'Blake'), 'ONTARIO', 'the region is shown as chosen');
select t.login(t.v(1));
select t.eq(t.names($$ select * from public.nearby_parents('city') $$), 'P3', 'Springfield, Illinois does not see Springfield, Missouri (only the hand-typed one)');
select t.login(t.v(2));
select t.eq(t.names($$ select * from public.nearby_parents('city') $$), 'P3', 'and the other way round');
select t.login(t.v(3));
select t.eq(t.names($$ select * from public.nearby_parents('city') $$), 'P1,P2', 'a hand-typed Springfield sees both');
select t.login(t.v(4));
select t.eq(t.names($$ select * from public.nearby_parents('city') $$), 'P5', 'Montréal sees Montreal');
select t.login(t.u(1));
select t.fails($$ update public.neighbor_profiles set region = repeat('x', 61) $$, 'regions are limited to 60 characters');
select t.ok($$ update public.neighbor_profiles set region = 'Ontario, Canada' $$, 'a region can be changed by its owner');
select t.owner();
select t.eq((select city_key || '|' || region_key from public.neighbor_profiles where user_id = t.u(2)), 'toronto|ontario', 'the matching text is stored folded');

-- ======== saving the place (migration 0016) ========
select t.owner();
select t.mkuser(t.v(20), 'Fay');
select t.login(t.v(20));
select t.fails($$ insert into public.neighbor_profiles (user_id, country, city) values (auth.uid(), 'CA', 'Toronto')
                  on conflict (user_id) do update set user_id = excluded.user_id, country = excluded.country $$,
               'an upsert from the app cannot work: user_id is not updatable (this is why saving now uses save_place)');
select t.ok($$ select public.save_place('CA', ' Ottawa ', 'Ontario', '', false) $$, 'save_place creates the row');
select t.eq((select city || '|' || region || '|' || coalesce(area, 'none') || '|' || discoverable::text from public.neighbor_profiles), 'Ottawa|Ontario|none|false', 'trimmed, empty area is none');
select t.ok($$ select public.save_place('CA', 'Ottawa', 'Ontario', 'Centretown', true) $$, 'and updates it');
select t.eq((select area || '|' || discoverable::text from public.neighbor_profiles), 'Centretown|true', 'updated');
select t.ok($$ select public.save_place('CA', '', 'Ontario', '', false) $$, 'a place without a city can be saved while hidden');
select t.eq((select (region is null)::text from public.neighbor_profiles), 'true', 'and then has no region either');
select t.fails($$ select public.save_place('CA', '', null, null, true) $$, 'visible needs a city');
select t.fails($$ select public.save_place('Canada', 'Ottawa', null, null, false) $$, 'the country must be a 2-letter code');
select t.owner();
select t.eq((select count(*) from public.neighbor_profiles where user_id = t.v(20))::text, '1', 'one row per person');
select t.login(t.u(2));
select t.eq((select city from public.neighbor_profiles), 'toronto', 'saving for Fay never touched anyone else''s place');
select t.anon();
select t.fails($$ select public.save_place('CA', 'Ottawa', null, null, false) $$, 'signed-out visitors cannot save');

-- ======== unread: one-to-one chats ========
select t.connect(t.u(1), t.u(2));
select t.connect(t.u(3), t.u(1));
select t.owner();
select set_config('t.c', (select id::text from public.connections where requester = t.u(1) and addressee = t.u(2)), true);
select t.login(t.u(2));
insert into public.messages (connection_id, body) values (current_setting('t.c')::uuid, 'one'), (current_setting('t.c')::uuid, 'two'), (current_setting('t.c')::uuid, 'three');
select t.owner();
update public.messages set created_at = now() - interval '3 minutes' where body = 'one';
update public.messages set created_at = now() - interval '2 minutes' where body = 'two';
update public.messages set created_at = now() - interval '1 minute' where body = 'three';

select t.login(t.u(1));
select t.eq((select unread::text from public.my_connections() where name = 'Blake'), '3', 'Alex has 3 unread from Blake');
select t.eq(public.unread_total()::text, '3', 'the tab badge counts them');
select t.login(t.u(2));
select t.eq((select unread::text from public.my_connections() where name = 'Alex'), '0', 'Blake''s own messages are never unread for Blake');

select t.login(t.u(1));
select public.mark_chat_read(current_setting('t.c')::uuid, (select created_at from public.messages where body = 'two'));
select t.eq((select unread::text from public.my_connections() where name = 'Blake'), '1', 'reading up to the second leaves the third unread');
select public.mark_chat_read(current_setting('t.c')::uuid, now() - interval '1 day');
select t.eq((select unread::text from public.my_connections() where name = 'Blake'), '1', 'reading never goes backwards');
select public.mark_chat_read(current_setting('t.c')::uuid, now() + interval '1 day');
select t.eq((select unread::text from public.my_connections() where name = 'Blake'), '0', 'and a future time is clamped to now');
select t.login(t.u(2));
insert into public.messages (connection_id, body) values (current_setting('t.c')::uuid, 'four');
select t.owner();
update public.messages set created_at = now() + interval '5 seconds' where body = 'four';
select t.login(t.u(1));
select t.eq((select unread::text from public.my_connections() where name = 'Blake'), '1', 'a new message after reading is unread again');

select t.login(t.u(4));
select t.fails($$ select public.mark_chat_read(current_setting('t.c')::uuid, now()) $$, 'a stranger cannot mark someone else''s chat');
select t.fails($$ select * from public.chat_reads $$, 'the read table cannot be queried directly');
select t.anon();
select t.fails($$ select public.unread_total() $$, 'signed-out visitors cannot ask');

-- requests and group invitations count too
select t.owner();
select t.place(t.u(4), 'CA', 'Toronto', 'Ontario');
select t.login(t.u(4)); select public.request_connection(t.u(1));
select t.login(t.u(1));
select t.eq(public.unread_total()::text, '2', '1 unread message + 1 request for Alex');

-- ======== unread: groups ========
select t.connect(t.u(2), t.u(3));
select t.login(t.u(2));
select set_config('t.g', public.create_group('Playgroup', array[t.u(1), t.u(3)])::text, true);
insert into public.group_messages (group_id, body) values (current_setting('t.g')::uuid, 'before you joined');
select t.owner();
update public.group_messages set created_at = now() - interval '2 days';
select t.login(t.u(1));
select t.eq((select unread::text from public.my_groups()), '0', 'an invitation is not unread messages');
select t.eq(public.unread_total()::text, '3', 'but it counts toward the badge (1 message, 1 request, 1 invitation)');
select public.respond_group_invite(current_setting('t.g')::uuid, true);
select t.eq((select unread::text from public.my_groups()), '0', 'history from before you joined is not unread');
select t.owner();
update public.group_members set created_at = now() - interval '1 day' where user_id = t.u(1);
select t.login(t.u(2));
insert into public.group_messages (group_id, body) values (current_setting('t.g')::uuid, 'welcome'), (current_setting('t.g')::uuid, 'hi all');
select t.login(t.u(1));
insert into public.group_messages (group_id, body) values (current_setting('t.g')::uuid, 'my own');
select t.owner();
update public.group_messages set created_at = now() - interval '1 hour' where body in ('welcome', 'hi all', 'my own');
select t.login(t.u(1));
select t.eq((select unread::text from public.my_groups()), '2', 'two unread from others, my own message does not count');
select public.mark_chat_read(current_setting('t.g')::uuid, now());
select t.eq((select unread::text from public.my_groups()), '0', 'marked read');
select t.login(t.u(3));
select t.fails($$ select public.mark_chat_read(current_setting('t.g')::uuid, now()) $$, 'an invitee who has not joined cannot mark it');

-- a suspended person''s messages are not counted
select t.login(t.u(7)); select public.suspend_user(t.u(2), true);
select t.owner();
update public.group_messages set created_at = now() + interval '30 seconds' where body = 'hi all';
select t.login(t.u(1));
select t.eq((select unread::text from public.my_groups()), '0', 'messages from a suspended parent do not count');
rollback;
