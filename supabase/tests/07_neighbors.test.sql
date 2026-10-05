-- Parents near you: visibility, consent, blocking, reporting, notifications (migration 0012).
begin;
select t.mkuser(t.u(1), 'Alex'), t.mkuser(t.u(2), 'Blake'), t.mkuser(t.u(3), 'Casey'), t.mkuser(t.u(4), 'Drew'),
       t.mkuser(t.u(5), 'Eli'), t.mkuser(t.u(6), 'Fay'), t.mkuser(t.u(7), 'Mod'), t.mkuser(t.u(8), 'Gus'),
       t.mkuser(t.u(9), 'Hana');
update public.profiles set is_moderator = true where id = t.u(7);
-- Gus is Alex's partner (same household)
update public.profiles set household_id = (select household_id from public.profiles where id = t.u(1)) where id = t.u(8);

create function t.place(uid uuid, c text, city text, area text, disc boolean) returns void language plpgsql as $$
begin
  perform t.login(uid);
  insert into public.neighbor_profiles (user_id, country, city, area, discoverable) values (uid, c, city, area, disc);
  perform t.owner();
end $$;
create function t.v(n int) returns uuid language sql immutable as $$ select ('b0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;
create function t.names(q text) returns text language plpgsql as $$
declare r text;
begin execute 'select coalesce(string_agg(name, '','' order by name), '''') from (' || q || ') x' into r; return r; end $$;
grant execute on function t.place(uuid, text, text, text, boolean), t.names(text), t.v(int) to authenticated;

select t.place(t.u(1), 'CA', 'Toronto', 'The Annex', true);
select t.place(t.u(2), 'CA', 'toronto', 'the  annex.', true);   -- spelled differently, same place
select t.place(t.u(3), 'CA', 'Toronto', 'Danforth', true);
select t.place(t.u(4), 'CA', 'Vancouver', null, true);
select t.place(t.u(5), 'FR', 'Paris', null, true);
select t.place(t.u(6), 'CA', 'Toronto', 'The Annex', false);
select t.place(t.u(8), 'CA', 'Toronto', 'The Annex', true);
select t.place(t.u(9), 'CA', 'Toronto', 'The Annex', true);

-- ---- the location itself is private ----
select t.login(t.u(2));
select t.eq((select count(*) from public.neighbor_profiles)::text, '1', 'people can read only their own location');
select t.fails($$ update public.neighbor_profiles set discovery_blocked = true $$, 'cannot edit the moderation flag');
select t.fails($$ insert into public.neighbor_profiles (user_id, country) values (t.u(4), 'FR') $$, 'cannot write another person''s location');
select t.fails($$ update public.neighbor_profiles set country = 'canada' $$, 'country must be a 2-letter code');
select t.fails($$ update public.neighbor_profiles set city = null $$, 'cannot stay discoverable without a city');
select t.fails($$ delete from public.neighbor_profiles $$, 'cannot delete directly');
select t.login(t.u(7));
select t.eq((select count(*) from public.neighbor_profiles)::text, '8', 'moderators can see locations (to review reports)');
select t.anon();
select t.fails($$ select * from public.nearby_parents('city') $$, 'signed-out visitors cannot browse');

-- ---- who shows up where ----
select t.login(t.u(1));
select t.eq(t.names($$ select * from public.nearby_parents('area') $$), 'Blake,Hana', 'neighbourhood: same area only (spelling/case/punctuation ignored); not the partner, not hidden people');
select t.eq(t.names($$ select * from public.nearby_parents('city') $$), 'Blake,Casey,Hana', 'city');
select t.eq(t.names($$ select * from public.nearby_parents('country') $$), 'Blake,Casey,Drew,Hana', 'country, but not another country');
select t.fails($$ select * from public.nearby_parents('planet') $$, 'unknown scope rejected');
select t.eq((select count(*) from public.nearby_parents('country', 2))::text, '2', 'page size respected');
select t.eq((select string_agg(distinct city || '/' || coalesce(area, ''), ',') from public.nearby_parents('area') where name = 'Blake'), 'toronto/the  annex.', 'others see the place as the person typed it');
select t.login(t.u(6));
select t.fails($$ select * from public.nearby_parents('city') $$, 'you only see others if you are visible yourself');
select t.login(t.u(4));
select t.fails($$ select * from public.nearby_parents('area') $$, 'neighbourhood scope needs a neighbourhood');

-- ---- asking to connect ----
select t.login(t.u(1));
select t.fails($$ select public.request_connection(t.u(1)) $$, 'not with yourself');
select t.fails($$ select public.request_connection(t.u(5)) $$, 'not across countries');
select t.fails($$ select public.request_connection(t.u(6)) $$, 'not with someone who is not discoverable');
select t.fails($$ select public.request_connection(t.u(8)) $$, 'not with your own household');
select t.fails($$ select public.request_connection(t.u(99)) $$, 'not with someone who does not exist');
select t.ok($$ select public.request_connection(t.u(2), 'Hi, we live a few streets apart!') $$, 'Alex asks Blake');
select t.fails($$ select public.request_connection(t.u(2)) $$, 'cannot ask twice');
select t.eq((select connection from public.nearby_parents('area') where name = 'Blake'), 'sent', 'Alex sees "sent"');
select t.login(t.u(2));
select t.eq((select connection from public.nearby_parents('area') where name = 'Alex'), 'received', 'Blake sees "received"');
select t.eq((select count(*) from public.my_connections() where direction = 'incoming' and status = 'pending' and intro like 'Hi,%')::text, '1', 'Blake has the request with the intro');
select t.login(t.u(3));
select t.eq((select count(*) from public.my_connections())::text, '0', 'Casey sees nothing of it');
select t.eq((select count(*) from public.connections)::text, '0', 'and cannot read the connection row');
select t.fails($$ insert into public.connections (requester, addressee, status) values (auth.uid(), t.u(9), 'accepted') $$, 'connections cannot be written directly');
select t.fails($$ update public.connections set status = 'accepted' $$, 'nor changed directly');

-- ---- no messages before consent ----
select t.owner();
select set_config('t.conn', (select id::text from public.connections limit 1), true);
select t.login(t.u(1));
select t.fails($$ insert into public.messages (connection_id, body) values (current_setting('t.conn')::uuid, 'hello?') $$, 'cannot message before the request is accepted');
select t.fails($$ select public.respond_connection(current_setting('t.conn')::uuid, true) $$, 'the asker cannot accept their own request');
select t.login(t.u(3));
select t.fails($$ select public.respond_connection(current_setting('t.conn')::uuid, true) $$, 'a stranger cannot accept it');
select t.login(t.u(2));
select t.ok($$ select public.respond_connection(current_setting('t.conn')::uuid, true) $$, 'Blake accepts');
select t.fails($$ select public.respond_connection(current_setting('t.conn')::uuid, true) $$, 'answering twice does nothing');

-- ---- chatting ----
select t.login(t.u(1));
select t.ok($$ insert into public.messages (connection_id, body) values (current_setting('t.conn')::uuid, 'Hi Blake!') $$, 'Alex messages Blake');
select t.fails($$ insert into public.messages (connection_id, sender, body) values (current_setting('t.conn')::uuid, t.u(2), 'spoofed') $$, 'cannot send in someone else''s name');
select t.fails($$ insert into public.messages (connection_id, body) values (current_setting('t.conn')::uuid, repeat('x', 1001)) $$, 'messages are limited to 1000 characters');
select t.fails($$ insert into public.messages (connection_id, body) values (current_setting('t.conn')::uuid, '   ') $$, 'no empty messages');
select t.login(t.u(2));
select t.eq((select count(*) from public.messages)::text, '1', 'Blake reads it');
select t.ok($$ insert into public.messages (connection_id, body) values (current_setting('t.conn')::uuid, 'Hi Alex, nice to meet you') $$, 'Blake replies');
select t.fails($$ update public.messages set body = 'edited' $$, 'messages cannot be edited');
select t.login(t.u(3));
select t.eq((select count(*) from public.messages)::text, '0', 'a stranger reads nothing');
select t.fails($$ insert into public.messages (connection_id, body) values (current_setting('t.conn')::uuid, 'butting in') $$, 'a stranger cannot join the chat');
select t.login(t.u(7));
select t.eq((select count(*) from public.messages)::text, '0', 'not even moderators can read private chats');
select t.login(t.u(1));
select t.ok($$ delete from public.messages where body = 'Hi Blake!' $$, 'you can delete your own message');
select t.eq((select count(*) from public.messages)::text, '1', 'only that one');
select t.ok($$ delete from public.messages $$, 'deleting the other person''s message runs...');
select t.eq((select count(*) from public.messages)::text, '1', '...but removes nothing');
-- speed limit
select t.login(t.u(2));
select t.ok($$ insert into public.messages (connection_id, body) select current_setting('t.conn')::uuid, 'n' || g from generate_series(1, 18) g $$, '19 messages in a minute is fine');
select t.fails($$ insert into public.messages (connection_id, body) select current_setting('t.conn')::uuid, 'n' || g from generate_series(1, 2) g $$, 'the 21st is refused');

-- ---- notifications: only "something happened", never the text ----
select t.owner();
delete from net.sent;
select t.login(t.u(2)); select public.register_push_token('ExponentPushToken[blake-phone]', 'ios');
select t.login(t.u(1)); select public.register_push_token('ExponentPushToken[alex-phone]', 'ios');
select t.login(t.u(3)); select public.register_push_token('ExponentPushToken[casey-phone]', 'ios');
select t.login(t.u(9)); select public.register_push_token('ExponentPushToken[hana-phone]', 'ios');
select t.login(t.u(1));
select public.request_connection(t.u(9), 'Hello Hana');
select t.owner();
select t.eq((select count(*) from net.sent s, jsonb_array_elements(s.body) m where m->>'to' = 'ExponentPushToken[hana-phone]' and m->>'body' = 'A parent near you would like to connect')::text, '1', 'a request notifies the other parent (without the intro text)');
select set_config('t.conn2', (select id::text from public.connections where addressee = t.u(9)), true);
delete from net.sent;
select t.login(t.u(9)); select public.respond_connection(current_setting('t.conn2')::uuid, true);
select t.owner();
select t.eq((select m->>'body' from net.sent s, jsonb_array_elements(s.body) m where m->>'to' = 'ExponentPushToken[alex-phone]'), 'Hana accepted your request', 'accepting notifies the asker');
delete from net.sent;
select t.login(t.u(1));
insert into public.messages (connection_id, body) values (current_setting('t.conn2')::uuid, 'SECRET-TEXT-1');
insert into public.messages (connection_id, body) values (current_setting('t.conn2')::uuid, 'SECRET-TEXT-2');
select t.owner();
select t.eq((select count(*) from net.sent)::text, '1', 'a burst of messages is one notification');
select t.eq((select m->>'body' from net.sent s, jsonb_array_elements(s.body) m limit 1), 'Alex sent you a message', 'it says who, not what');
select t.eq((select count(*) from net.sent where body::text like '%SECRET%')::text, '0', 'message text never leaves the database');
delete from net.sent;
select t.login(t.u(9));
update public.profiles set notify_messages = false where id = auth.uid();
select t.owner();
select t.login(t.u(1));
insert into public.messages (connection_id, body) values (current_setting('t.conn2')::uuid, 'again');
select t.owner();
select t.eq((select count(*) from net.sent)::text, '0', 'switched off means silent');

-- ---- declined stays declined ----
select t.login(t.u(4));
select t.ok($$ select public.request_connection(t.u(2)) $$, 'Drew asks Blake (same country)');
select t.owner();
select set_config('t.conn3', (select id::text from public.connections where requester = t.u(4)), true);
select t.login(t.u(2));
select t.ok($$ select public.respond_connection(current_setting('t.conn3')::uuid, false) $$, 'Blake declines');
select t.login(t.u(4));
select t.eq(t.names($$ select * from public.nearby_parents('country') $$), 'Alex,Casey,Gus,Hana', 'Drew no longer sees Blake');
select t.fails($$ select public.request_connection(t.u(2)) $$, 'and cannot ask again');
select t.fails($$ select public.remove_connection(current_setting('t.conn3')::uuid) $$, 'cannot erase the decline to ask again');
select t.login(t.u(2));
select t.eq((select count(*) from public.my_connections() where name = 'Drew')::text, '0', 'declined requests disappear from lists');

-- ---- blocking ends everything ----
select t.login(t.u(2));
insert into public.user_blocks (blocked_id) values (t.u(1));
select t.owner();
select t.eq((select count(*) from public.connections where id = current_setting('t.conn')::uuid)::text, '0', 'blocking removes the connection');
select t.eq((select count(*) from public.messages where connection_id = current_setting('t.conn')::uuid)::text, '0', 'and its messages');
select t.login(t.u(1));
select t.eq(t.names($$ select * from public.nearby_parents('area') $$), 'Hana', 'Alex no longer sees Blake');
select t.fails($$ select public.request_connection(t.u(2)) $$, 'cannot ask again');
select t.login(t.u(2));
select t.eq(t.names($$ select * from public.nearby_parents('area') $$), 'Gus,Hana', 'Blake no longer sees Alex');

-- ---- reports ----
select t.login(t.u(9));
select t.ok($$ select public.report_user(t.u(1), 'harassment', 'rude messages', (select id from public.messages where body = 'SECRET-TEXT-1')) $$, 'Hana reports Alex with one message');
select t.fails($$ select public.report_user(t.u(1), 'because', null) $$, 'reason must be one of the list');
select t.fails($$ select public.report_user(t.u(9), 'spam') $$, 'not yourself');
select t.eq((select count(*) from public.user_reports)::text, '1', 'reporters see their own reports');
select t.eq((select message_excerpt from public.user_reports), 'SECRET-TEXT-1', 'the reported message is copied');
select t.login(t.u(3));
select t.eq((select count(*) from public.user_reports)::text, '0', 'others cannot see them');
select t.login(t.u(7));
select t.eq((select count(*) from public.user_reports)::text, '1', 'moderators can');
select t.login(t.u(3)); select public.report_user(t.u(1), 'spam');
select t.login(t.u(4)); select public.report_user(t.u(1), 'unsafe');
select t.login(t.u(3));
select t.eq(t.names($$ select * from public.nearby_parents('city') $$), 'Blake,Gus,Hana', 'three different reporters take Alex out of the lists');
select t.login(t.u(9));
select t.eq((select count(*) from public.nearby_parents('city') where name = 'Alex')::text, '0', 'hidden for everyone');
select t.login(t.u(1));
select t.fails($$ select * from public.nearby_parents('city') $$, 'and Alex cannot browse either until reviewed');
select t.fails($$ select public.clear_discovery_block(t.u(1)) $$, 'only moderators clear the flag');
select t.login(t.u(7));
select t.ok($$ select public.clear_discovery_block(t.u(1)) $$, 'moderator clears it');
select t.eq((select count(*) from public.user_reports)::text, '0', 'and the reports are closed');
select t.login(t.u(3));
select t.eq(t.names($$ select * from public.nearby_parents('city') $$), 'Alex,Blake,Gus,Hana', 'Alex is back');

-- ---- suspended parents disappear ----
select t.login(t.u(7)); select public.suspend_user(t.u(1), true);
select t.login(t.u(3));
select t.eq(t.names($$ select * from public.nearby_parents('city') $$), 'Blake,Gus,Hana', 'suspended: hidden');
select t.login(t.u(1));
select t.fails($$ select * from public.nearby_parents('city') $$, 'suspended: cannot browse');
select t.fails($$ select public.request_connection(t.u(3)) $$, 'suspended: cannot ask');

-- ---- deleting an account takes its connections and messages along ----
select t.login(t.u(9));
select t.ok($$ select public.delete_my_account() $$, 'Hana deletes her account');
select t.owner();
select t.eq((select count(*) from public.connections where t.u(9) in (requester, addressee))::text, '0', 'her connections are gone');
select t.eq((select count(*) from public.neighbor_profiles where user_id = t.u(9))::text, '0', 'and her location');

-- ---- the speed limit on requests ----
select t.owner();
select t.mkuser(t.v(10 + g), 'P' || g) from generate_series(0, 5) g;
select t.place(t.v(10 + g), 'CA', 'Toronto', 'The Annex', true) from generate_series(0, 5) g;
select t.login(t.u(3));
select t.ok($$ select public.request_connection(t.v(10 + g)) from generate_series(0, 4) g $$, 'five requests an hour are fine');
select t.fails($$ select public.request_connection(t.v(15)) $$, 'the sixth is refused');
rollback;
