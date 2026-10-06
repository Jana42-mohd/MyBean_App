-- 0010: security hardening. Run AFTER 0001-0009.
--  * throttle invite-code guessing, and make new invite codes longer
--  * cap the size of free-form JSON and text so one account cannot fill the database
--  * rate-limit posting
--  * profiles are no longer readable by every signed-in user (no enumerating the user base)
--  * avatar uploads: images only, 5 MB max
--  * trigger functions cannot be called directly

-- ---------- invite codes ----------
alter table public.households alter column invite_code
  set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));  -- existing 8-character codes keep working

create table public.join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
create index join_attempts_user_time on public.join_attempts (user_id, at desc);
alter table public.join_attempts enable row level security;  -- no policies: only join_household() touches it

create or replace function public.join_household(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare target uuid; old uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  delete from public.join_attempts where at < now() - interval '1 day';
  if (select count(*) from public.join_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many attempts. Please try again later.';
  end if;

  select id into target from public.households where invite_code = upper(trim(code));
  if target is null then
    -- Record the miss and return NULL (rather than raising): an exception would roll the record back,
    -- and the throttle would never see the failed guesses. The app turns NULL into "Invalid invite code".
    insert into public.join_attempts (user_id) values (auth.uid());
    return null;
  end if;

  select household_id into old from public.profiles where id = auth.uid();
  if old = target then return target; end if;
  if (select count(*) from public.profiles where household_id = target) >= 4 then
    raise exception 'That household is full';
  end if;
  if not exists (select 1 from public.profiles where household_id = old and id <> auth.uid()) then
    update public.babies set household_id = target where household_id = old;
    update public.logs   set household_id = target where household_id = old;
  end if;
  update public.profiles set household_id = target where id = auth.uid();
  if not exists (select 1 from public.profiles where household_id = old) then
    delete from public.households where id = old;
  end if;
  return target;
end $$;

-- ---------- size limits ----------
update public.profiles set name = left(name, 60) where char_length(name) > 60;
alter table public.profiles add constraint profiles_name_len check (char_length(name) between 1 and 60);
alter table public.logs add constraint logs_data_size check (pg_column_size(data) <= 8192);
alter table public.surveys add constraint surveys_data_size check (pg_column_size(data) <= 8192);
alter table public.wellbeing_entries add constraint wellbeing_data_size check (pg_column_size(data) <= 16384);
alter table public.posts add constraint posts_tags_count check (cardinality(tags) <= 10);
alter table public.post_reports add constraint reports_details_len check (details is null or char_length(details) <= 500);

-- names typed at sign-up are untrusted: cut them to the same limit
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare h uuid;
begin
  insert into public.households default values returning id into h;
  insert into public.profiles (id, name, household_id)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), 'Parent'), 60), h);
  return new;
end $$;

-- ---------- posting rate limit: 10 posts per hour ----------
create function public.limit_post_rate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.posts where user_id = new.user_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You are posting too fast. Please try again later.';
  end if;
  return new;
end $$;
create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.limit_post_rate();

-- ---------- profiles are visible only to people who need them ----------
--  yourself, your household, authors of posts you can see, and moderators
drop policy "profiles readable by signed-in" on public.profiles;
create policy "profiles visible where needed" on public.profiles for select to authenticated
using (
  id = auth.uid()
  or household_id = public.my_household()
  or public.is_moderator()
  or exists (select 1 from public.posts p where p.user_id = profiles.id)
);

-- ---------- avatar uploads ----------
update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'avatars';

-- ---------- trigger functions are not callable from the API ----------
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.auto_hide_reported() from public, anon, authenticated;
revoke execute on function public.limit_post_rate() from public, anon, authenticated;
