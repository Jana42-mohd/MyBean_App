-- 0012: parents near you. Run AFTER 0001-0011.
--
-- Privacy model (read this before changing anything):
--  * Nobody is visible by default. A parent chooses a country, a city and (optionally) a neighbourhood by TYPING them.
--    There is no GPS and no precise location anywhere.
--  * Only people who switch "Let nearby parents find me" on appear in the lists, and only if they switch it on themselves.
--  * What others see: first name as entered on the profile, profile photo, city and neighbourhood. Never babies, logs,
--    wellbeing, email or household members.
--  * Talking needs consent: a request must be accepted before anyone can send a message.
--  * Blocking removes the connection and its messages, and hides both people from each other. Reports are reviewed by moderators.
-- Everything goes through functions so the rules live in one place; the tables themselves cannot be edited directly.

-- ---------- where a parent is (private table: never readable by other people) ----------
create table public.neighbor_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade default auth.uid(),
  country text check (country ~ '^[A-Z]{2}$'),
  city text check (char_length(btrim(city)) between 1 and 60),
  area text check (char_length(btrim(area)) between 1 and 60),
  discoverable boolean not null default false,
  discovery_blocked boolean not null default false,   -- set by moderators / reports, not by the person
  city_key text generated always as (nullif(btrim(regexp_replace(lower(city), '[\s\-.,''’]+', ' ', 'g')), '')) stored,
  area_key text generated always as (nullif(btrim(regexp_replace(lower(area), '[\s\-.,''’]+', ' ', 'g')), '')) stored,
  updated_at timestamptz not null default now(),
  constraint discoverable_needs_place check (not discoverable or (country is not null and city is not null))
);
alter table public.neighbor_profiles enable row level security;
create policy "neighbor profile own or moderator" on public.neighbor_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy "neighbor profile insert own" on public.neighbor_profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy "neighbor profile update own" on public.neighbor_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.neighbor_profiles from authenticated, anon;
grant insert (user_id, country, city, area, discoverable) on public.neighbor_profiles to authenticated;
grant update (country, city, area, discoverable) on public.neighbor_profiles to authenticated;

create function public.touch_neighbor_profile() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger neighbor_profiles_touch before update on public.neighbor_profiles
  for each row execute function public.touch_neighbor_profile();

alter table public.profiles add column notify_messages boolean not null default true;
grant update (notify_messages) on public.profiles to authenticated;

-- ---------- connections ----------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  addressee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  intro text check (char_length(intro) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester <> addressee)
);
-- one connection per pair of people, whoever asked first
create unique index connections_pair on public.connections (least(requester, addressee), greatest(requester, addressee));
create index connections_requester on public.connections (requester);
create index connections_addressee on public.connections (addressee);

alter table public.connections enable row level security;
create policy "connections mine" on public.connections for select to authenticated
  using (auth.uid() in (requester, addressee));
revoke insert, update, delete on public.connections from authenticated, anon;  -- only the functions below change them

-- ---------- messages ----------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  sender uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index messages_connection_time on public.messages (connection_id, created_at desc);

create function public.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks
                  where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

-- can this person read/write messages of this connection right now?
create function public.can_chat(conn uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.connections c
     where c.id = conn and c.status = 'accepted' and auth.uid() in (c.requester, c.addressee)
       and not public.blocked_between(c.requester, c.addressee)
  )
$$;

alter table public.messages enable row level security;
create policy "messages read in my accepted connections" on public.messages for select to authenticated
  using (public.can_chat(connection_id));
create policy "messages send" on public.messages for insert to authenticated
  with check (sender = auth.uid() and public.can_chat(connection_id) and not public.is_suspended());
create policy "messages delete own" on public.messages for delete to authenticated
  using (sender = auth.uid());
revoke update on public.messages from authenticated, anon;

-- 20 messages a minute is plenty for a human
create function public.limit_message_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.messages where sender = new.sender and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages too fast. Please wait a moment.';
  end if;
  return new;
end $$;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.limit_message_rate();

-- Blocking someone ends any connection with them (and deletes the messages with it)
create function public.drop_connection_on_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.connections
   where least(requester, addressee) = least(new.blocker_id, new.blocked_id)
     and greatest(requester, addressee) = greatest(new.blocker_id, new.blocked_id);
  return null;
end $$;
create trigger user_blocks_drop_connection after insert on public.user_blocks
  for each row execute function public.drop_connection_on_block();

-- ---------- reports about people ----------
create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  reported uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'unsafe', 'inappropriate', 'other')),
  details text check (char_length(details) <= 500),
  message_excerpt text,   -- a copy of the one message being reported, so moderators never read private chats
  created_at timestamptz not null default now(),
  check (reporter <> reported)
);
create index user_reports_reported on public.user_reports (reported);
alter table public.user_reports enable row level security;
create policy "user reports read own or moderator" on public.user_reports for select to authenticated
  using (reporter = auth.uid() or public.is_moderator());
create policy "user reports delete moderator" on public.user_reports for delete to authenticated
  using (public.is_moderator());
revoke insert, update on public.user_reports from authenticated, anon;

-- Three different people reporting someone takes them out of the lists until a moderator looks
create function public.auto_block_discovery() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(distinct reporter) from public.user_reports where reported = new.reported) >= 3 then
    update public.neighbor_profiles set discovery_blocked = true where user_id = new.reported;
  end if;
  return null;
end $$;
create trigger user_reports_auto_block after insert on public.user_reports
  for each row execute function public.auto_block_discovery();

-- ---------- functions the app calls ----------
-- (a) who is near me
create function public.nearby_parents(scope text, lim int default 30, off int default 0)
returns table (id uuid, name text, avatar_url text, city text, area text, connection text, request_id uuid)
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if scope not in ('area', 'city', 'country') then raise exception 'Unknown scope'; end if;
  select np.country, np.city_key, np.area_key, np.discoverable, np.discovery_blocked, p.suspended, p.household_id
    into me from public.profiles p left join public.neighbor_profiles np on np.user_id = p.id where p.id = auth.uid();
  if me.suspended or coalesce(me.discovery_blocked, false) then raise exception 'This is not available for your account'; end if;
  if not coalesce(me.discoverable, false) then raise exception 'Turn on "Let nearby parents find me" first (you only see others when others can see you)'; end if;
  if scope = 'area' and me.area_key is null then raise exception 'Add your neighbourhood first'; end if;

  return query
  select p.id, p.name, p.avatar_url, np.city, np.area,
         case when c.id is null then 'none' when c.status = 'accepted' then 'connected'
              when c.requester = auth.uid() then 'sent' else 'received' end,
         c.id
    from public.neighbor_profiles np
    join public.profiles p on p.id = np.user_id
    left join public.connections c
      on least(c.requester, c.addressee) = least(auth.uid(), p.id) and greatest(c.requester, c.addressee) = greatest(auth.uid(), p.id)
   where np.discoverable and not np.discovery_blocked and not p.suspended
     and p.id <> auth.uid()
     and p.household_id is distinct from me.household_id
     and np.country = me.country
     and (scope = 'country' or np.city_key = me.city_key)
     and (scope <> 'area' or np.area_key = me.area_key)
     and not public.blocked_between(auth.uid(), p.id)
     and (c.id is null or c.status <> 'declined')
   order by p.created_at desc, p.id
   limit least(greatest(lim, 1), 50) offset greatest(off, 0);
end $$;

-- (b) ask to connect
create function public.request_connection(target uuid, intro text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mine record; theirs record; existing public.connections; new_id uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if target = me then raise exception 'You cannot connect with yourself'; end if;
  if public.is_suspended() then raise exception 'This is not available for your account'; end if;

  select * into mine from public.neighbor_profiles where user_id = me;
  if not found or not mine.discoverable or mine.discovery_blocked then raise exception 'Turn on "Let nearby parents find me" first'; end if;
  select np.*, p.suspended, p.household_id into theirs from public.neighbor_profiles np join public.profiles p on p.id = np.user_id where np.user_id = target;
  if not found or not theirs.discoverable or theirs.discovery_blocked or theirs.suspended or theirs.country <> mine.country
     or public.blocked_between(me, target)
     or theirs.household_id is not distinct from (select household_id from public.profiles where id = me) then
    raise exception 'This parent is not available';
  end if;

  select * into existing from public.connections
   where least(requester, addressee) = least(me, target) and greatest(requester, addressee) = greatest(me, target);
  if found then
    if existing.status = 'pending' and existing.addressee = me then  -- they already asked me: that is a yes
      update public.connections set status = 'accepted', updated_at = now() where id = existing.id;
      return existing.id;
    end if;
    raise exception 'You already have a request or connection with this parent';
  end if;

  if (select count(*) from public.connections where requester = me and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You have sent several requests already. Please try again later.';
  end if;
  if (select count(*) from public.connections where requester = me and status = 'pending') >= 30 then
    raise exception 'You have many requests waiting. Wait for some answers first.';
  end if;

  insert into public.connections (requester, addressee, intro)
  values (me, target, nullif(left(btrim(coalesce(intro, '')), 200), '')) returning id into new_id;
  return new_id;
end $$;

-- (c) answer a request
create function public.respond_connection(conn uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.connections
     set status = case when accept then 'accepted' else 'declined' end, updated_at = now()
   where id = conn and addressee = auth.uid() and status = 'pending'
     and not public.blocked_between(requester, addressee);
  if not found then raise exception 'This request is no longer available'; end if;
end $$;

-- (d) cancel a request you sent, or disconnect. A declined request stays so the same person cannot keep asking.
create function public.remove_connection(conn uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.connections;
begin
  select * into c from public.connections where id = conn and auth.uid() in (requester, addressee);
  if not found then raise exception 'Not found'; end if;
  if c.status = 'declined' and c.requester = auth.uid() then raise exception 'This request was declined'; end if;
  delete from public.connections where id = conn;
end $$;

-- (e) my requests and connections (never shows blocked or suspended people)
create function public.my_connections()
returns table (id uuid, other_id uuid, name text, avatar_url text, city text, area text, status text, direction text, intro text, created_at timestamptz, last_message_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, o.id, o.name, o.avatar_url,
         case when c.status = 'accepted' then np.city end, case when c.status = 'accepted' then np.area end,
         c.status, case when c.requester = auth.uid() then 'outgoing' else 'incoming' end, c.intro, c.created_at,
         (select max(m.created_at) from public.messages m where m.connection_id = c.id)
    from public.connections c
    join public.profiles o on o.id = case when c.requester = auth.uid() then c.addressee else c.requester end
    left join public.neighbor_profiles np on np.user_id = o.id and np.discoverable
   where auth.uid() in (c.requester, c.addressee) and c.status <> 'declined'
     and not o.suspended and not public.blocked_between(c.requester, c.addressee)
   order by coalesce((select max(m.created_at) from public.messages m where m.connection_id = c.id), c.updated_at) desc
$$;

-- (f) report a person (optionally one message from your chat with them)
create function public.report_user(target uuid, reason text, details text default null, message uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); excerpt text;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if target = me then raise exception 'You cannot report yourself'; end if;
  if (select count(*) from public.user_reports where reporter = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You have sent many reports today. Thank you, we will look at them.';
  end if;
  if message is not null then
    select left(m.body, 300) into excerpt from public.messages m
      join public.connections c on c.id = m.connection_id
     where m.id = message and m.sender = target and me in (c.requester, c.addressee);
  end if;
  insert into public.user_reports (reporter, reported, reason, details, message_excerpt)
  values (me, target, reason, left(details, 500), excerpt);
end $$;

-- (g) moderators: let a parent back into the lists after review
create function public.clear_discovery_block(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'Moderators only'; end if;
  update public.neighbor_profiles set discovery_blocked = false where user_id = target;
  delete from public.user_reports where reported = target;
end $$;

-- ---------- notifications (no message text is ever sent, only that something happened) ----------
create function public.push_to(users uuid[], body text, data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare msgs jsonb;
begin
  select jsonb_agg(jsonb_build_object('to', k.token, 'sound', 'default', 'channelId', 'connections', 'title', 'My Little Bean', 'body', body, 'data', data))
    into msgs
    from public.push_tokens k join public.profiles p on p.id = k.user_id
   where k.user_id = any(users) and p.notify_messages and not p.suspended;
  if msgs is not null and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
    begin
      execute 'select net.http_post(url := $1, body := $2, headers := $3)'
        using 'https://exp.host/--/api/v2/push/send', msgs,
              '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
    exception when others then
      raise warning 'notification failed: %', sqlerrm;
    end;
  end if;
end $$;

create function public.notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.connections; other uuid;
begin
  select * into c from public.connections where id = new.connection_id;
  other := case when c.requester = new.sender then c.addressee else c.requester end;
  -- a burst of messages is one notification
  if not exists (select 1 from public.messages where connection_id = new.connection_id and sender = new.sender
                    and id <> new.id and created_at > now() - interval '1 minute') then
    perform public.push_to(array[other], left((select name from public.profiles where id = new.sender), 40) || ' sent you a message',
                           jsonb_build_object('type', 'message', 'connection', new.connection_id));
  end if;
  return null;
end $$;
create trigger messages_notify after insert on public.messages for each row execute function public.notify_message();

create function public.notify_connection() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.push_to(array[new.addressee], 'A parent near you would like to connect', jsonb_build_object('type', 'connection_request'));
  elsif new.status = 'accepted' and old.status = 'pending' then
    perform public.push_to(array[new.requester], left((select name from public.profiles where id = new.addressee), 40) || ' accepted your request',
                           jsonb_build_object('type', 'connection_accepted', 'connection', new.id));
  end if;
  return null;
end $$;
create trigger connections_notify after insert or update of status on public.connections
  for each row execute function public.notify_connection();

-- ---------- who may call what ----------
revoke execute on function public.touch_neighbor_profile() from public, anon, authenticated;
revoke execute on function public.limit_message_rate() from public, anon, authenticated;
revoke execute on function public.drop_connection_on_block() from public, anon, authenticated;
revoke execute on function public.auto_block_discovery() from public, anon, authenticated;
revoke execute on function public.push_to(uuid[], text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_message() from public, anon, authenticated;
revoke execute on function public.notify_connection() from public, anon, authenticated;
revoke execute on function public.blocked_between(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_chat(uuid) from public, anon;
revoke execute on function public.nearby_parents(text, int, int) from public, anon;
revoke execute on function public.request_connection(uuid, text) from public, anon;
revoke execute on function public.respond_connection(uuid, boolean) from public, anon;
revoke execute on function public.remove_connection(uuid) from public, anon;
revoke execute on function public.my_connections() from public, anon;
revoke execute on function public.report_user(uuid, text, text, uuid) from public, anon;
revoke execute on function public.clear_discovery_block(uuid) from public, anon;
