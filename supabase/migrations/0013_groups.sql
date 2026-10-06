-- 0013: small group chats between parents who are already connected. Run AFTER 0001-0012.
--
-- Rules (the database enforces all of them):
--  * Up to 8 people per group (members plus pending invitations). You may start 5 groups.
--  * You can only invite people you are already connected with (an accepted one-to-one connection), and they must accept.
--  * Nobody joins by searching or by link. Nobody can be added if they have blocked, or been blocked by, someone in the group.
--  * Anyone can leave or mute. Only the creator can remove people or delete the group. If the creator leaves, the longest-standing member takes over.
--  * Blocking someone removes you from every group you share with them.
--  * Reports work like in one-to-one chats: a copy of the single reported message goes to moderators, who cannot read group chats.

create table public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  creator uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);
create index chat_groups_creator on public.chat_groups (creator);

create table public.group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'member')),
  invited_by uuid references public.profiles(id) on delete set null,
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user on public.group_members (user_id);

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  sender uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index group_messages_group_time on public.group_messages (group_id, created_at desc);

-- ---------- helpers ----------
create function public.is_group_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = g and user_id = auth.uid() and status = 'member')
$$;

create function public.user_is_suspended(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select suspended from public.profiles where id = u), false)
$$;

-- accepted one-to-one connection, nobody blocked, the other person not suspended
create function public.is_connected(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.connections c
     where c.status = 'accepted'
       and least(c.requester, c.addressee) = least(a, b) and greatest(c.requester, c.addressee) = greatest(a, b)
  ) and not public.blocked_between(a, b) and not public.user_is_suspended(b)
$$;

-- ---------- access rules ----------
alter table public.chat_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

create policy "groups mine" on public.chat_groups for select to authenticated
  using (exists (select 1 from public.group_members m where m.group_id = id and m.user_id = auth.uid()));
create policy "group members visible to members" on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id));
create policy "group messages read" on public.group_messages for select to authenticated
  using (public.is_group_member(group_id) and not public.user_is_suspended(sender));
create policy "group messages send" on public.group_messages for insert to authenticated
  with check (sender = auth.uid() and public.is_group_member(group_id) and not public.is_suspended());
create policy "group messages delete own" on public.group_messages for delete to authenticated
  using (sender = auth.uid());

revoke insert, update, delete on public.chat_groups from authenticated, anon;
revoke insert, update, delete on public.group_members from authenticated, anon;
revoke update on public.group_messages from authenticated, anon;

create function public.limit_group_message_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.group_messages where sender = new.sender and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'You are sending messages too fast. Please wait a moment.';
  end if;
  return new;
end $$;
create trigger group_messages_rate_limit before insert on public.group_messages
  for each row execute function public.limit_group_message_rate();

-- ---------- leaving, removal and ownership ----------
-- one place that removes a person (leaves, removed, blocked, or account deleted)
create function public.drop_group_member(g uuid, u uuid) returns void
language plpgsql security definer set search_path = public as $$
declare heir uuid;
begin
  delete from public.group_members where group_id = g and user_id = u;
  if (select creator from public.chat_groups where id = g) = u then
    select user_id into heir from public.group_members where group_id = g and status = 'member' order by created_at, user_id limit 1;
    if heir is null then
      delete from public.chat_groups where id = g;          -- nobody left to run it
    else
      update public.chat_groups set creator = heir where id = g;
    end if;
  end if;
  -- a group of one is not a group: remove it once a single member is left and nobody is invited
  if exists (select 1 from public.chat_groups where id = g)
     and (select count(*) from public.group_members where group_id = g) <= 1
     and not exists (select 1 from public.group_members where group_id = g and status = 'invited') then
    delete from public.chat_groups where id = g;
  end if;
end $$;

-- blocking someone removes you from every group you share with them
create function public.leave_groups_on_block() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select a.group_id from public.group_members a join public.group_members b on b.group_id = a.group_id
            where a.user_id = new.blocker_id and b.user_id = new.blocked_id loop
    perform public.drop_group_member(r.group_id, new.blocker_id);
  end loop;
  return null;
end $$;
create trigger user_blocks_leave_groups after insert on public.user_blocks
  for each row execute function public.leave_groups_on_block();

-- deleting an account must not delete a group other people are in: step out of each one first (hands over ownership)
create function public.hand_over_groups() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select group_id from public.group_members where user_id = old.id loop
    perform public.drop_group_member(r.group_id, old.id);
  end loop;
  return old;
end $$;
create trigger profiles_hand_over_groups before delete on public.profiles
  for each row execute function public.hand_over_groups();

-- ---------- functions the app calls ----------
create function public.create_group(group_name text, invitees uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); gid uuid; u uuid; ids uuid[];
begin
  if me is null then raise exception 'Not signed in'; end if;
  if public.is_suspended() then raise exception 'This is not available for your account'; end if;
  if char_length(btrim(coalesce(group_name, ''))) not between 1 and 40 then raise exception 'Give the group a name (up to 40 characters)'; end if;
  select coalesce(array_agg(distinct x), '{}') into ids from unnest(coalesce(invitees, '{}')) x where x <> me;
  if cardinality(ids) = 0 then raise exception 'Choose at least one parent to invite'; end if;
  if cardinality(ids) > 7 then raise exception 'A group can have at most 8 people'; end if;
  if (select count(*) from public.chat_groups where creator = me) >= 5 then raise exception 'You already have 5 groups. Delete one to start another.'; end if;

  foreach u in array ids loop
    if not public.is_connected(me, u) then raise exception 'You can only invite parents you are connected with'; end if;
  end loop;
  -- nobody invited may have blocked (or been blocked by) somebody else invited
  if exists (select 1 from unnest(ids) a, unnest(ids) b where a < b and public.blocked_between(a, b)) then
    raise exception 'Some of these parents cannot be in a group together';
  end if;

  insert into public.chat_groups (name, creator) values (btrim(group_name), me) returning id into gid;
  insert into public.group_members (group_id, user_id, status) values (gid, me, 'member');
  insert into public.group_members (group_id, user_id, status, invited_by) select gid, x, 'invited', me from unnest(ids) x;
  return gid;
end $$;

create function public.invite_to_group(g uuid, target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if not public.is_group_member(g) then raise exception 'You are not in this group'; end if;
  if public.is_suspended() then raise exception 'This is not available for your account'; end if;
  if not public.is_connected(me, target) then raise exception 'You can only invite parents you are connected with'; end if;
  if exists (select 1 from public.group_members where group_id = g and user_id = target) then raise exception 'Already in this group or invited'; end if;
  if (select count(*) from public.group_members where group_id = g) >= 8 then raise exception 'A group can have at most 8 people'; end if;
  if exists (select 1 from public.group_members m where m.group_id = g and public.blocked_between(m.user_id, target)) then
    raise exception 'This parent cannot be added to this group';
  end if;
  insert into public.group_members (group_id, user_id, status, invited_by) values (g, target, 'invited', me);
end $$;

create function public.respond_group_invite(g uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if accept then
    update public.group_members set status = 'member', created_at = now()
     where group_id = g and user_id = auth.uid() and status = 'invited';
  else
    delete from public.group_members where group_id = g and user_id = auth.uid() and status = 'invited';
    -- a declined invitation can leave a group with one person
    if exists (select 1 from public.chat_groups where id = g) and (select count(*) from public.group_members where group_id = g) <= 1
       and not exists (select 1 from public.group_members where group_id = g and status = 'invited') then
      delete from public.chat_groups where id = g;
    end if;
  end if;
  if not found and accept then raise exception 'This invitation is no longer available'; end if;
end $$;

create function public.leave_group(g uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.group_members where group_id = g and user_id = auth.uid()) then raise exception 'You are not in this group'; end if;
  perform public.drop_group_member(g, auth.uid());
end $$;

create function public.remove_from_group(g uuid, target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select creator from public.chat_groups where id = g) is distinct from auth.uid() then raise exception 'Only the person who started the group can remove people'; end if;
  if target = auth.uid() then raise exception 'Use Leave to leave the group'; end if;
  perform public.drop_group_member(g, target);
end $$;

create function public.delete_group(g uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.chat_groups where id = g and creator = auth.uid();
  if not found then raise exception 'Only the person who started the group can delete it'; end if;
end $$;

create function public.mute_group(g uuid, mute boolean) returns void
language sql security definer set search_path = public as $$
  update public.group_members set muted = mute where group_id = g and user_id = auth.uid()
$$;

create function public.my_groups()
returns table (id uuid, name text, status text, is_creator boolean, member_count int, invited_by_name text, last_message_at timestamptz, muted boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, m.status, g.creator = auth.uid(),
         (select count(*)::int from public.group_members x where x.group_id = g.id and x.status = 'member'),
         case when m.status = 'invited' then (select p.name from public.profiles p where p.id = m.invited_by) end,
         case when m.status = 'member' then (select max(gm.created_at) from public.group_messages gm where gm.group_id = g.id) end,
         m.muted
    from public.group_members m join public.chat_groups g on g.id = m.group_id
   where m.user_id = auth.uid()
   order by m.status asc, coalesce((select max(gm.created_at) from public.group_messages gm where gm.group_id = g.id), g.created_at) desc
$$;

-- who is in a group I belong to (names are visible only to members)
create function public.group_people(g uuid)
returns table (user_id uuid, name text, avatar_url text, status text, is_creator boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.avatar_url, m.status, c.creator = p.id
    from public.group_members m
    join public.profiles p on p.id = m.user_id
    join public.chat_groups c on c.id = m.group_id
   where m.group_id = g and public.is_group_member(g)
   order by m.status desc, m.created_at
$$;

create function public.report_group_message(msg uuid, reason text, details text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m record;
begin
  if me is null then raise exception 'Not signed in'; end if;
  select gm.sender, left(gm.body, 300) as excerpt into m from public.group_messages gm
   where gm.id = msg and exists (select 1 from public.group_members x where x.group_id = gm.group_id and x.user_id = me and x.status = 'member');
  if not found then raise exception 'Message not found'; end if;
  if m.sender = me then raise exception 'You cannot report yourself'; end if;
  if (select count(*) from public.user_reports where reporter = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You have sent many reports today. Thank you, we will look at them.';
  end if;
  insert into public.user_reports (reporter, reported, reason, details, message_excerpt)
  values (me, m.sender, reason, left(details, 500), m.excerpt);
end $$;

-- ---------- notifications (who and where, never the text) ----------
create function public.notify_group_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare gname text; sname text; recipients uuid[];
begin
  -- a burst of messages from one person in one group is one notification
  if exists (select 1 from public.group_messages where group_id = new.group_id and sender = new.sender
               and id <> new.id and created_at > now() - interval '1 minute') then
    return null;
  end if;
  select name into gname from public.chat_groups where id = new.group_id;
  select name into sname from public.profiles where id = new.sender;
  select coalesce(array_agg(user_id), '{}') into recipients from public.group_members
   where group_id = new.group_id and status = 'member' and not muted and user_id <> new.sender;
  perform public.push_to(recipients, left(sname, 40) || ' wrote in ' || left(gname, 40),
                         jsonb_build_object('type', 'group_message', 'group', new.group_id));
  return null;
end $$;
create trigger group_messages_notify after insert on public.group_messages
  for each row execute function public.notify_group_message();

create function public.notify_group_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'invited' then
    perform public.push_to(array[new.user_id],
      left((select name from public.profiles where id = new.invited_by), 40) || ' invited you to a group',
      jsonb_build_object('type', 'group_invite'));
  end if;
  return null;
end $$;
create trigger group_members_notify after insert on public.group_members
  for each row execute function public.notify_group_invite();

-- ---------- who may call what ----------
revoke execute on function public.limit_group_message_rate() from public, anon, authenticated;
revoke execute on function public.drop_group_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.leave_groups_on_block() from public, anon, authenticated;
revoke execute on function public.hand_over_groups() from public, anon, authenticated;
revoke execute on function public.notify_group_message() from public, anon, authenticated;
revoke execute on function public.notify_group_invite() from public, anon, authenticated;
revoke execute on function public.user_is_suspended(uuid) from public, anon;  -- used by a read policy, so signed-in people need it
revoke execute on function public.is_connected(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_group_member(uuid) from public, anon;
revoke execute on function public.create_group(text, uuid[]) from public, anon;
revoke execute on function public.invite_to_group(uuid, uuid) from public, anon;
revoke execute on function public.respond_group_invite(uuid, boolean) from public, anon;
revoke execute on function public.leave_group(uuid) from public, anon;
revoke execute on function public.remove_from_group(uuid, uuid) from public, anon;
revoke execute on function public.delete_group(uuid) from public, anon;
revoke execute on function public.mute_group(uuid, boolean) from public, anon;
revoke execute on function public.my_groups() from public, anon;
revoke execute on function public.group_people(uuid) from public, anon;
revoke execute on function public.report_group_message(uuid, text, text) from public, anon;
