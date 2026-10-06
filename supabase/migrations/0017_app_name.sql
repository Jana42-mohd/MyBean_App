-- 0017: the app is called "My Bean". The title of push notifications is set inside two database functions, so they are
-- replaced here with the new name (nothing else changes). Run AFTER 0001-0016.

create or replace function public.notify_partners_of_logs() returns trigger
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
             'to', k.token, 'sound', 'default', 'channelId', 'partner', 'title', 'My Bean',
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

create or replace function public.push_to(users uuid[], body text, data jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare msgs jsonb;
begin
  select jsonb_agg(jsonb_build_object('to', k.token, 'sound', 'default', 'channelId', 'connections', 'title', 'My Bean', 'body', body, 'data', data))
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
