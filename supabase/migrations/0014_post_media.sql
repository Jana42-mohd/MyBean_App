-- 0014: photos and videos in community posts. Run AFTER 0001-0013.
--
--  * Files live in a PRIVATE bucket ('post-media') under <author id>/<random>.<ext>. The app shows them through links that expire.
--  * A file can be read by the author, by moderators, and by anyone who can see a post that uses it. When a post is hidden
--    (three reports) or deleted, its files stop being readable by everyone else.
--  * A post has at most 4 files, at most one of them a video. Videos are limited to 25 MB in the app; images are shrunk first.

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  path text not null unique,
  kind text not null check (kind in ('image', 'video')),
  position smallint not null default 0 check (position between 0 and 3),
  created_at timestamptz not null default now(),
  -- the file extension must match what it claims to be
  check ((kind = 'image' and path ~* '\.(jpe?g|png|webp)$') or (kind = 'video' and path ~* '\.(mp4|mov)$'))
);
create index post_media_post on public.post_media (post_id, position);

alter table public.post_media enable row level security;
-- reading a post's media follows who can read the post itself (row-level security on posts applies inside this check)
create policy "post media follows post" on public.post_media for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "post media add to own post" on public.post_media for insert to authenticated
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid())
    and (storage.foldername(path))[1] = auth.uid()::text
    and not public.is_suspended()
  );
create policy "post media delete own or moderator" on public.post_media for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()) or public.is_moderator());
revoke update on public.post_media from authenticated, anon;

create function public.limit_post_media() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.post_media where post_id = new.post_id) >= 4 then
    raise exception 'A post can have at most 4 photos or videos';
  end if;
  if new.kind = 'video' and exists (select 1 from public.post_media where post_id = new.post_id and kind = 'video') then
    raise exception 'A post can have only one video';
  end if;
  return new;
end $$;
create trigger post_media_limit before insert on public.post_media
  for each row execute function public.limit_post_media();
revoke execute on function public.limit_post_media() from public, anon, authenticated;

-- ---------- the files ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-media', 'post-media', false, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = 52428800,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];

create policy "post media files add own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text and not public.is_suspended());
create policy "post media files read" on storage.objects for select to authenticated
  using (
    bucket_id = 'post-media'
    and ((storage.foldername(name))[1] = auth.uid()::text
         or public.is_moderator()
         or exists (select 1 from public.post_media m where m.path = name))   -- only files of posts this person can see
  );
create policy "post media files remove own or moderator" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_moderator()));
