-- 0018: comments and replies under community posts (like Reddit threads). Run AFTER 0001-0017.
--
--  * Anyone signed in can comment on a post they can see, and reply to a comment (threads up to 6 levels deep).
--  * Comments can be liked, deleted by their author (a comment that has replies stays as "[deleted]" so the thread keeps its
--    shape), and reported. Three different people reporting a comment hides it until a moderator looks (same as posts).
--  * Hidden, suspended and blocked people's comments are not shown (blocked: only to the person who blocked).
--  * Everything is read through post_comments_for(), which also supplies the author's name and photo.

-- who can see a post (the same rule as the posts table: hidden posts only to their author and moderators)
create function public.post_visible(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.posts x where x.id = p and (x.hidden = false or x.user_id = auth.uid() or public.is_moderator()))
$$;

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null default auth.uid(),   -- null once the author's account is gone
  body text not null check (char_length(btrim(body)) between 1 and 2000 or deleted),
  hidden boolean not null default false,
  deleted boolean not null default false,
  created_at timestamptz not null default now()
);
create index post_comments_post on public.post_comments (post_id, created_at);
create index post_comments_parent on public.post_comments (parent_id);
create index post_comments_user on public.post_comments (user_id);

create table public.comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  primary key (comment_id, user_id)
);

create table public.comment_reports (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  reason text not null check (reason in ('spam', 'harassment', 'medical misinformation', 'inappropriate', 'other')),
  details text check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- the comment can be liked / reported by the signed-in person: its post is visible, and it is not hidden or deleted;
-- someone's own comment cannot be reported (own_ok = true means liking one's own comment is fine)
create function public.comment_open(c uuid, own_ok boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.post_comments x
                  where x.id = c and not x.hidden and not x.deleted and public.post_visible(x.post_id)
                    and (own_ok or x.user_id is distinct from auth.uid()))
$$;

alter table public.post_comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.comment_reports enable row level security;

-- reading goes through post_comments_for(); the table itself is readable for the author's own rows and for moderators
create policy "comments read own or moderator" on public.post_comments for select to authenticated
  using (user_id = auth.uid() or public.is_moderator());
create policy "comments add" on public.post_comments for insert to authenticated
  with check (user_id = auth.uid() and hidden = false and deleted = false and not public.is_suspended() and public.post_visible(post_id));
create policy "comments delete moderator" on public.post_comments for delete to authenticated using (public.is_moderator());
create policy "comments restore moderator" on public.post_comments for update to authenticated
  using (public.is_moderator()) with check (public.is_moderator());
revoke update on public.post_comments from authenticated, anon;
grant update (hidden) on public.post_comments to authenticated;

create policy "comment likes own" on public.comment_likes for select to authenticated using (user_id = auth.uid());
create policy "comment likes add" on public.comment_likes for insert to authenticated
  with check (user_id = auth.uid() and public.comment_open(comment_id, true));
create policy "comment likes remove" on public.comment_likes for delete to authenticated using (user_id = auth.uid());

create policy "comment reports add" on public.comment_reports for insert to authenticated
  with check (user_id = auth.uid() and public.comment_open(comment_id, false));
create policy "comment reports read own or moderator" on public.comment_reports for select to authenticated using (user_id = auth.uid() or public.is_moderator());
create policy "comment reports delete moderator" on public.comment_reports for delete to authenticated using (public.is_moderator());

-- a reply belongs to a comment of the same post, threads stop at 6 levels, and 30 comments an hour is plenty
create function public.check_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare depth int := 0; cur uuid := new.parent_id; pp uuid;
begin
  if new.parent_id is not null then
    select post_id into pp from public.post_comments where id = new.parent_id;
    if pp is distinct from new.post_id then raise exception 'That reply belongs to a different post'; end if;
    while cur is not null and depth < 7 loop
      select parent_id into cur from public.post_comments where id = cur;
      depth := depth + 1;
    end loop;
    if depth >= 6 then raise exception 'This thread is too deep. Reply to an earlier comment instead.'; end if;
  end if;
  if (select count(*) from public.post_comments where user_id = new.user_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'You are commenting too fast. Please try again later.';
  end if;
  return new;
end $$;
create trigger post_comments_check before insert on public.post_comments for each row execute function public.check_comment();

-- three different people reporting a comment hide it until a moderator looks
create function public.auto_hide_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.comment_reports where comment_id = new.comment_id) >= 3 then
    update public.post_comments set hidden = true where id = new.comment_id;
  end if;
  return null;
end $$;
create trigger comment_reported after insert on public.comment_reports for each row execute function public.auto_hide_comment();

-- ---------- reading a thread ----------
create function public.post_comments_for(post uuid)
returns table (id uuid, parent_id uuid, user_id uuid, author text, avatar_url text, body text, created_at timestamptz,
               likes int, liked boolean, mine boolean, hidden boolean, deleted boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.parent_id, c.user_id,
         case when c.deleted then null else coalesce(p.name, 'Parent') end,
         case when c.deleted then null else p.avatar_url end,
         c.body, c.created_at,
         (select count(*)::int from public.comment_likes l where l.comment_id = c.id),
         exists (select 1 from public.comment_likes l where l.comment_id = c.id and l.user_id = auth.uid()),
         c.user_id = auth.uid(), c.hidden, c.deleted
    from public.post_comments c
    left join public.profiles p on p.id = c.user_id
   where c.post_id = post and public.post_visible(post)
     and (c.hidden = false or c.user_id = auth.uid() or public.is_moderator())
     and (c.deleted or c.user_id = auth.uid() or (not coalesce(p.suspended, false)
          and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = c.user_id)))
   order by c.created_at
$$;

-- deleting: a comment nobody replied to disappears; one with replies stays as "[deleted]" so the thread still makes sense
create function public.delete_comment(c uuid) returns void
language plpgsql security definer set search_path = public as $$
declare row public.post_comments;
begin
  select * into row from public.post_comments where id = c;
  if not found or (row.user_id is distinct from auth.uid() and not public.is_moderator()) then raise exception 'Not found'; end if;
  if exists (select 1 from public.post_comments where parent_id = c) then
    update public.post_comments set deleted = true, body = '[deleted]', user_id = null, hidden = false where id = c;
    delete from public.comment_reports where comment_id = c;
    delete from public.comment_likes where comment_id = c;
  else
    delete from public.post_comments where id = c;
  end if;
end $$;

-- when an account is deleted its comments go too (or stay as "[deleted]" where others replied)
create function public.clear_comments_of_deleted_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.post_comments where user_id = old.id order by created_at desc loop
    if exists (select 1 from public.post_comments where parent_id = r.id) then
      update public.post_comments set deleted = true, body = '[deleted]', user_id = null, hidden = false where id = r.id;
    else
      delete from public.post_comments where id = r.id;
    end if;
  end loop;
  return old;
end $$;
create trigger profiles_clear_comments before delete on public.profiles for each row execute function public.clear_comments_of_deleted_user();

-- ---------- the number on each post ----------
create function public.comment_count(p uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.post_comments c where c.post_id = p and not c.hidden and not c.deleted
$$;
create or replace view public.posts_feed with (security_invoker = true) as
select p.id, p.user_id, p.title, p.excerpt, p.tags, p.created_at,
       coalesce(pr.name, 'Parent') as author,
       (select count(*) from public.post_likes l where l.post_id = p.id)::int as likes_count,
       (select count(*) from public.post_saves s where s.post_id = p.id)::int as saves_count,
       public.comment_count(p.id) as comments_count
from public.posts p
left join public.profiles pr on pr.id = p.user_id
where p.hidden = false
  and coalesce(pr.suspended, false) = false
  and not exists (select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.user_id);
grant select on public.posts_feed to authenticated;

-- ---------- notifications: who commented, never what ----------
create function public.notify_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare post_owner uuid; parent_owner uuid; who text; burst boolean;
begin
  select user_id into post_owner from public.posts where id = new.post_id;
  select name into who from public.profiles where id = new.user_id;
  burst := exists (select 1 from public.post_comments where post_id = new.post_id and user_id = new.user_id and id <> new.id and created_at > now() - interval '1 minute');
  if burst then return null; end if;
  if new.parent_id is not null then
    select user_id into parent_owner from public.post_comments where id = new.parent_id;
    if parent_owner is not null and parent_owner is distinct from new.user_id then
      perform public.push_to(array[parent_owner], left(who, 40) || ' replied to your comment', jsonb_build_object('type', 'comment', 'post', new.post_id));
    end if;
  end if;
  if post_owner is not null and post_owner is distinct from new.user_id and post_owner is distinct from parent_owner then
    perform public.push_to(array[post_owner], left(who, 40) || ' commented on your post', jsonb_build_object('type', 'comment', 'post', new.post_id));
  end if;
  return null;
end $$;
create trigger post_comments_notify after insert on public.post_comments for each row execute function public.notify_comment();

-- ---------- who may call what ----------
revoke execute on function public.check_comment() from public, anon, authenticated;
revoke execute on function public.auto_hide_comment() from public, anon, authenticated;
revoke execute on function public.clear_comments_of_deleted_user() from public, anon, authenticated;
revoke execute on function public.notify_comment() from public, anon, authenticated;
revoke execute on function public.post_visible(uuid) from public, anon;
revoke execute on function public.comment_count(uuid) from public, anon;
revoke execute on function public.comment_open(uuid, boolean) from public, anon;
revoke execute on function public.post_comments_for(uuid) from public, anon;
revoke execute on function public.delete_comment(uuid) from public, anon;
