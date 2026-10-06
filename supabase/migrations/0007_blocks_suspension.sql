-- 0007: community safety required by the App Store / Google Play for apps with user-generated content:
--   * members can block another member (their posts disappear from your feed)
--   * moderators can suspend a member (cannot post; their posts are hidden from everyone)
-- Run AFTER 0001-0006.

create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
create policy "blocks own" on public.user_blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

alter table public.profiles add column suspended boolean not null default false;  -- only changeable through suspend_user()

create function public.suspend_user(target uuid, suspend boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'Moderators only'; end if;
  if target = auth.uid() then raise exception 'You cannot suspend yourself'; end if;
  update public.profiles set suspended = suspend where id = target;
end $$;
revoke all on function public.suspend_user(uuid, boolean) from public, anon;
grant execute on function public.suspend_user(uuid, boolean) to authenticated;

create function public.is_suspended() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select suspended from public.profiles where id = auth.uid()), false)
$$;

-- Suspended members cannot post
drop policy "posts insert own" on public.posts;
create policy "posts insert own" on public.posts for insert to authenticated
  with check (user_id = auth.uid() and not public.is_suspended());

-- Feed: hide blocked authors (for the blocker) and suspended authors (for everyone)
drop view public.posts_feed;
create view public.posts_feed with (security_invoker = true) as
select p.id, p.user_id, p.title, p.excerpt, p.tags, p.created_at,
       coalesce(pr.name, 'Parent') as author,
       (select count(*) from public.post_likes l where l.post_id = p.id)::int as likes_count,
       (select count(*) from public.post_saves s where s.post_id = p.id)::int as saves_count
from public.posts p
left join public.profiles pr on pr.id = p.user_id
where p.hidden = false
  and coalesce(pr.suspended, false) = false
  and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.user_id);
grant select on public.posts_feed to authenticated;
