-- 0004: community moderation (delete own posts, report posts, auto-hide, moderator tools). Run AFTER 0001-0003.

alter table public.profiles add column is_moderator boolean not null default false;  -- only changeable from the SQL editor
alter table public.posts    add column hidden boolean not null default false;

create function public.is_moderator() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_moderator from public.profiles where id = auth.uid()), false)
$$;

create table public.post_reports (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','medical misinformation','inappropriate','other')),
  details text,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_reports enable row level security;
create policy "reports insert own" on public.post_reports for insert to authenticated with check (user_id = auth.uid());
create policy "reports read own or moderator" on public.post_reports for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy "reports delete moderator" on public.post_reports for delete to authenticated using (public.is_moderator());

-- Three different people reporting a post hides it automatically until a moderator reviews it
create function public.auto_hide_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.post_reports where post_id = new.post_id) >= 3 then
    update public.posts set hidden = true where id = new.post_id;
  end if;
  return new;
end $$;
create trigger post_reported after insert on public.post_reports
  for each row execute function public.auto_hide_reported();

-- Posts: hidden ones are visible only to their author and moderators; authors/moderators can delete; moderators can restore
drop policy "posts readable by signed-in" on public.posts;
drop policy "posts delete own" on public.posts;
create policy "posts read visible" on public.posts for select to authenticated
  using (hidden = false or user_id = auth.uid() or public.is_moderator());
create policy "posts delete own or moderator" on public.posts for delete to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy "posts moderator restore" on public.posts for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());
revoke update on public.posts from authenticated;
grant update (hidden) on public.posts to authenticated;

-- Feed never shows hidden posts
drop view public.posts_feed;
create view public.posts_feed with (security_invoker = true) as
select p.id, p.user_id, p.title, p.excerpt, p.tags, p.created_at,
       coalesce(pr.name, 'Parent') as author,
       (select count(*) from public.post_likes l where l.post_id = p.id)::int as likes_count,
       (select count(*) from public.post_saves s where s.post_id = p.id)::int as saves_count
from public.posts p
left join public.profiles pr on pr.id = p.user_id
where p.hidden = false;
grant select on public.posts_feed to authenticated;

-- To make yourself a moderator (run once, with your own email):
--   update public.profiles set is_moderator = true
--   where id = (select id from auth.users where email = 'you@example.com');
