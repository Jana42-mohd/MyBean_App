-- MyBean initial schema. Run in Supabase Dashboard -> SQL Editor.

-- Profiles: public display info only (readable by signed-in users for community authors)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Parent',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Survey / baby info: private to the owner
create table public.surveys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Tracking logs (nap, diaper, feeding, pumping, milestone, mood)
create table public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  type text not null check (type in ('nap','diaper','feeding','pumping','milestone','mood')),
  data jsonb not null default '{}'::jsonb,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index logs_user_type_time on public.logs (user_id, type, logged_at desc);

-- Community
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 200),
  excerpt text not null check (char_length(excerpt) between 1 and 5000),
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  primary key (post_id, user_id)
);
create table public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  primary key (post_id, user_id)
);

-- Feed view: posts + author + counts + whether the current user liked/saved
create view public.posts_feed with (security_invoker = true) as
select p.id, p.user_id, p.title, p.excerpt, p.tags, p.created_at,
       coalesce(pr.name, 'Parent') as author,
       (select count(*) from public.post_likes l where l.post_id = p.id)::int as likes_count,
       (select count(*) from public.post_saves s where s.post_id = p.id)::int as saves_count
from public.posts p
left join public.profiles pr on pr.id = p.user_id;

-- Row level security
alter table public.profiles   enable row level security;
alter table public.surveys    enable row level security;
alter table public.logs       enable row level security;
alter table public.posts      enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;

create policy "profiles readable by signed-in" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "surveys own" on public.surveys for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "logs own"    on public.logs    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "posts readable by signed-in" on public.posts for select to authenticated using (true);
create policy "posts insert own" on public.posts for insert to authenticated with check (user_id = auth.uid());
create policy "posts delete own" on public.posts for delete to authenticated using (user_id = auth.uid());

create policy "likes readable" on public.post_likes for select to authenticated using (true);
create policy "likes insert own" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy "likes delete own" on public.post_likes for delete to authenticated using (user_id = auth.uid());
create policy "saves insert own" on public.post_saves for insert to authenticated with check (user_id = auth.uid());
create policy "saves delete own" on public.post_saves for delete to authenticated using (user_id = auth.uid());
-- Saves are readable so the feed can show counts
create policy "saves readable for counts" on public.post_saves for select to authenticated using (true);

-- Auto-create a profile when a user signs up (name comes from signUp options.data.name)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name',''), 'Parent'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profile photo storage (public read, each user writes only inside their own folder)
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
