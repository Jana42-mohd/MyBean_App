-- 0011: push notifications to the partner + private milestone photos. Run AFTER 0001-0010.
--
-- Push: phones register an Expo push token. When someone logs something, the database asks Expo to notify the
-- OTHER members of the household (pg_net sends the request, no extra server needed). Wellbeing entries never notify.
-- Photos: a private storage bucket; only members of the household named in the file path can read or add files.

-- pg_net lets the database call Expo's push service. Supabase has it; a plain PostgreSQL (our tests) does not, and then nothing is sent.
do $$ begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net is not available here: partner notifications will not be sent until it is enabled (Database -> Extensions)';
end $$;

-- ---------- push tokens ----------
alter table public.profiles add column notify_partner boolean not null default true;
grant update (notify_partner) on public.profiles to authenticated;

create table public.push_tokens (
  token text primary key check (char_length(token) between 10 and 300),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
-- people may see and remove their own tokens; adding goes through register_push_token (a phone can change hands)
create policy "tokens read own"   on public.push_tokens for select to authenticated using (user_id = auth.uid());
create policy "tokens delete own" on public.push_tokens for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.push_tokens from authenticated, anon;

-- A token belongs to a phone, not a person: if someone else logs in on that phone it moves to them
create function public.register_push_token(t text, p text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.push_tokens (token, user_id, platform) values (t, auth.uid(), p)
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform, updated_at = now();
  -- keep a person's list short: the newest 10 phones
  delete from public.push_tokens where user_id = auth.uid() and token in (
    select token from public.push_tokens where user_id = auth.uid() order by updated_at desc offset 10);
end $$;

create function public.unregister_push_token(t text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = t and user_id = auth.uid()
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;

-- ---------- tell the partner when something is logged ----------
create function public.notify_partners_of_logs() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record; msgs jsonb; what text;
begin
  -- one message per person, kind of entry and statement (logging for twins is one statement => one message)
  for r in
    select n.user_id as sender, n.household_id, n.type,
           coalesce(sp.name, 'Your partner') as sender_name,
           string_agg(distinct b.name, ' and ') filter (where b.name is not null) as babies
      from new_rows n
      join public.profiles sp on sp.id = n.user_id
      left join public.babies b on b.id = n.baby_id
     where n.type in ('nap', 'diaper', 'feeding', 'milestone', 'growth', 'mood')
       and n.logged_at > now() - interval '2 hours'   -- entries sent late from the offline queue do not ping
     group by n.user_id, n.household_id, n.type, sp.name
  loop
    what := case r.type when 'nap' then 'a nap' when 'diaper' then 'a diaper change' when 'feeding' then 'a feeding'
                        when 'milestone' then 'a milestone' when 'growth' then 'a measurement' else 'a mood' end;
    select jsonb_agg(jsonb_build_object(
             'to', k.token, 'sound', 'default', 'channelId', 'partner', 'title', 'My Little Bean',
             'body', left(r.sender_name, 40) || ' logged ' || what || coalesce(' for ' || left(r.babies, 80), ''),
             'data', jsonb_build_object('type', 'partner_log', 'logType', r.type)))
      into msgs
      from public.push_tokens k
      join public.profiles p on p.id = k.user_id
     where p.household_id = r.household_id and p.id <> r.sender and p.notify_partner;

    if msgs is not null and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
      begin
        execute 'select net.http_post(url := $1, body := $2, headers := $3)'
          using 'https://exp.host/--/api/v2/push/send', msgs,
                '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
      exception when others then
        raise warning 'partner notification failed: %', sqlerrm;  -- never stop a log from being saved
      end;
    end if;
  end loop;
  return null;
end $$;

revoke execute on function public.notify_partners_of_logs() from public, anon, authenticated;

create trigger logs_notify_partners after insert on public.logs
  referencing new table as new_rows for each statement execute function public.notify_partners_of_logs();

-- ---------- milestone photos ----------
-- Private bucket. Files live under <household id>/..., and only that household's members can see, add or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('milestone-photos', 'milestone-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "milestone photos read" on storage.objects for select to authenticated
  using (bucket_id = 'milestone-photos' and (storage.foldername(name))[1] = public.my_household()::text);
create policy "milestone photos add" on storage.objects for insert to authenticated
  with check (bucket_id = 'milestone-photos' and (storage.foldername(name))[1] = public.my_household()::text);
create policy "milestone photos remove" on storage.objects for delete to authenticated
  using (bucket_id = 'milestone-photos' and (storage.foldername(name))[1] = public.my_household()::text);

-- An entry may only point at a photo inside its own household's folder
alter table public.logs add constraint logs_photo_in_household
  check (data->>'photo' is null or data->>'photo' like household_id::text || '/%');
