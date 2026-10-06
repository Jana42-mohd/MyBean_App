-- 0015: unread counts for chats and groups, and cities picked from a list. Run AFTER 0001-0014.

-- =====================================================================================
-- A. Unread messages
-- Each person has a "read up to" time per conversation. Messages from other people after that time are unread.
-- =====================================================================================
create table public.chat_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  ref_id uuid not null,                       -- a connection id or a group id
  read_at timestamptz not null,
  primary key (user_id, ref_id)
);
alter table public.chat_reads enable row level security;   -- no policies: only the functions below touch it
revoke all on public.chat_reads from authenticated, anon;

-- what already exists counts as read, so nobody opens the app to a pile of "unread" history
insert into public.chat_reads (user_id, ref_id, read_at)
select u, c.id, now() from public.connections c, lateral (values (c.requester), (c.addressee)) v(u) where c.status = 'accepted';
insert into public.chat_reads (user_id, ref_id, read_at)
select m.user_id, m.group_id, now() from public.group_members m where m.status = 'member';

-- called by the chat screens with the time of the newest message they have SHOWN (so a message that arrives while
-- the screen is loading is not marked read by accident)
create function public.mark_chat_read(ref uuid, upto timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Not signed in'; end if;
  if not (exists (select 1 from public.connections c where c.id = ref and c.status = 'accepted' and me in (c.requester, c.addressee))
          or exists (select 1 from public.group_members g where g.group_id = ref and g.user_id = me and g.status = 'member')) then
    raise exception 'Not found';
  end if;
  insert into public.chat_reads (user_id, ref_id, read_at) values (me, ref, least(upto, now()))
  on conflict (user_id, ref_id) do update set read_at = greatest(public.chat_reads.read_at, excluded.read_at);
end $$;

-- unread messages in one connection / one group, as seen by the signed-in person
create function public.unread_in_connection(conn uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.messages m
   where m.connection_id = conn and m.sender <> auth.uid()
     and m.created_at > coalesce((select r.read_at from public.chat_reads r where r.user_id = auth.uid() and r.ref_id = conn), 'epoch'::timestamptz)
$$;
create function public.unread_in_group(g uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.group_messages m
   where m.group_id = g and m.sender <> auth.uid() and not public.user_is_suspended(m.sender)
     and m.created_at > coalesce((select r.read_at from public.chat_reads r where r.user_id = auth.uid() and r.ref_id = g),
                                 (select x.created_at from public.group_members x where x.group_id = g and x.user_id = auth.uid()))
$$;

-- =====================================================================================
-- B. Places picked from a list
-- (the two functions that list connections and people nearby are rebuilt once, here, for both changes)
-- =====================================================================================
alter table public.neighbor_profiles add column region text check (char_length(btrim(region)) between 1 and 60);

-- the text a place is matched on: lower case, accents removed, punctuation and extra spaces ignored ("Montréal" = "montreal")
create function public.fold_text(t text) returns text
language sql immutable parallel safe as $$
  select nullif(btrim(regexp_replace(
           translate(replace(replace(lower(t), 'ß', 'ss'), 'æ', 'ae'), 'àáâãäåāăąçćčďđèéêëēėęěìíîïīįıłñńňòóôõöøōőřśšşșťţțùúûüūůűųýÿźžż', 'aaaaaaaaacccddeeeeeeeeiiiiiiilnnnoooooooorsssstttuuuuuuuuyyzzz'),
           '[\s\-.,''’]+', ' ', 'g')), '')
$$;

alter table public.neighbor_profiles drop column city_key, drop column area_key;
alter table public.neighbor_profiles
  add column city_key text generated always as (public.fold_text(city)) stored,
  add column area_key text generated always as (public.fold_text(area)) stored,
  add column region_key text generated always as (public.fold_text(region)) stored;
grant insert (region) on public.neighbor_profiles to authenticated;
grant update (region) on public.neighbor_profiles to authenticated;

-- people nearby: same country and the same city; a city picked from the list also has to be in the same region
-- (Springfield, Illinois is not Springfield, Missouri), while a city typed by hand has no region and matches any
drop function public.nearby_parents(text, int, int);
create function public.nearby_parents(scope text, lim int default 30, off int default 0)
returns table (id uuid, name text, avatar_url text, city text, region text, area text, connection text, request_id uuid)
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if scope not in ('area', 'city', 'country') then raise exception 'Unknown scope'; end if;
  select np.country, np.city_key, np.area_key, np.region_key, np.discoverable, np.discovery_blocked, p.suspended, p.household_id
    into me from public.profiles p left join public.neighbor_profiles np on np.user_id = p.id where p.id = auth.uid();
  if me.suspended or coalesce(me.discovery_blocked, false) then raise exception 'This is not available for your account'; end if;
  if not coalesce(me.discoverable, false) then raise exception 'Turn on "Let nearby parents find me" first (you only see others when others can see you)'; end if;
  if scope = 'area' and me.area_key is null then raise exception 'Add your neighbourhood first'; end if;

  return query
  select p.id, p.name, p.avatar_url, np.city, np.region, np.area,
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
     and (scope = 'country'
          or (np.city_key = me.city_key and (np.region_key is null or me.region_key is null or np.region_key = me.region_key)))
     and (scope <> 'area' or np.area_key = me.area_key)
     and not public.blocked_between(auth.uid(), p.id)
     and (c.id is null or c.status <> 'declined')
   order by p.created_at desc, p.id
   limit least(greatest(lim, 1), 50) offset greatest(off, 0);
end $$;

drop function public.my_connections();
create function public.my_connections()
returns table (id uuid, other_id uuid, name text, avatar_url text, city text, region text, area text, status text, direction text,
               intro text, created_at timestamptz, last_message_at timestamptz, unread int)
language sql stable security definer set search_path = public as $$
  select c.id, o.id, o.name, o.avatar_url,
         case when c.status = 'accepted' then np.city end, case when c.status = 'accepted' then np.region end,
         case when c.status = 'accepted' then np.area end,
         c.status, case when c.requester = auth.uid() then 'outgoing' else 'incoming' end, c.intro, c.created_at,
         (select max(m.created_at) from public.messages m where m.connection_id = c.id),
         case when c.status = 'accepted' then public.unread_in_connection(c.id) else 0 end
    from public.connections c
    join public.profiles o on o.id = case when c.requester = auth.uid() then c.addressee else c.requester end
    left join public.neighbor_profiles np on np.user_id = o.id and np.discoverable
   where auth.uid() in (c.requester, c.addressee) and c.status <> 'declined'
     and not o.suspended and not public.blocked_between(c.requester, c.addressee)
   order by coalesce((select max(m.created_at) from public.messages m where m.connection_id = c.id), c.updated_at) desc
$$;

drop function public.my_groups();
create function public.my_groups()
returns table (id uuid, name text, status text, is_creator boolean, member_count int, invited_by_name text, last_message_at timestamptz, muted boolean, unread int)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, m.status, g.creator = auth.uid(),
         (select count(*)::int from public.group_members x where x.group_id = g.id and x.status = 'member'),
         case when m.status = 'invited' then (select p.name from public.profiles p where p.id = m.invited_by) end,
         case when m.status = 'member' then (select max(gm.created_at) from public.group_messages gm where gm.group_id = g.id) end,
         m.muted,
         case when m.status = 'member' then public.unread_in_group(g.id) else 0 end
    from public.group_members m join public.chat_groups g on g.id = m.group_id
   where m.user_id = auth.uid()
   order by m.status asc, coalesce((select max(gm.created_at) from public.group_messages gm where gm.group_id = g.id), g.created_at) desc
$$;

-- one cheap number for the badge on the Community tab: messages waiting + requests + group invitations
create function public.unread_total() returns int
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(public.unread_in_connection(c.id)) from public.connections c
               where c.status = 'accepted' and auth.uid() in (c.requester, c.addressee)
                 and not public.blocked_between(c.requester, c.addressee)), 0)::int
  + coalesce((select sum(public.unread_in_group(m.group_id)) from public.group_members m
               where m.user_id = auth.uid() and m.status = 'member'), 0)::int
  + (select count(*)::int from public.connections c
      where c.addressee = auth.uid() and c.status = 'pending' and not public.blocked_between(c.requester, c.addressee)
        and not public.user_is_suspended(c.requester))
  + (select count(*)::int from public.group_members m where m.user_id = auth.uid() and m.status = 'invited')
$$;

-- ---------- who may call what ----------
revoke execute on function public.fold_text(text) from public, anon;
revoke execute on function public.unread_in_connection(uuid) from public, anon, authenticated;
revoke execute on function public.unread_in_group(uuid) from public, anon, authenticated;
revoke execute on function public.mark_chat_read(uuid, timestamptz) from public, anon;
revoke execute on function public.unread_total() from public, anon;
revoke execute on function public.nearby_parents(text, int, int) from public, anon;
revoke execute on function public.my_connections() from public, anon;
revoke execute on function public.my_groups() from public, anon;
