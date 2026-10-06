-- Photos and videos in community posts (migration 0014).
begin;
select t.mkuser(t.u(1), 'Alex'), t.mkuser(t.u(2), 'Blake'), t.mkuser(t.u(3), 'Casey'), t.mkuser(t.u(7), 'Mod');
update public.profiles set is_moderator = true where id = t.u(7);

select t.login(t.u(1));
insert into public.posts (id, title, excerpt, tags) values ('c0000000-0000-0000-0000-000000000001', 'First smile', 'Look!', array['sleep']);
select t.owner();
select t.eq((select public::text from storage.buckets where id = 'post-media'), 'false', 'the bucket is private');
select t.eq((select file_size_limit::text from storage.buckets where id = 'post-media'), '52428800', 'files are limited to 50 MB');
select t.login(t.u(1));

-- ---- the files themselves ----
select t.ok($$ insert into storage.objects (bucket_id, name) values ('post-media', t.u(1) || '/a.jpg') $$, 'upload into your own folder');
select t.fails($$ insert into storage.objects (bucket_id, name) values ('post-media', t.u(2) || '/b.jpg') $$, 'not into someone else''s folder');
select t.fails($$ insert into storage.objects (bucket_id, name) values ('post-media', 'loose.jpg') $$, 'not outside a folder');
select t.login(t.u(2));
select t.eq((select count(*) from storage.objects where bucket_id = 'post-media')::text, '0', 'before it is attached to a post, nobody else can read it');

-- ---- attaching to a post ----
select t.login(t.u(1));
select t.ok($$ insert into public.post_media (post_id, path, kind) values ('c0000000-0000-0000-0000-000000000001', t.u(1) || '/a.jpg', 'image') $$, 'attach an image to my post');
select t.login(t.u(2));
select t.eq((select count(*) from public.post_media)::text, '1', 'others can see which files a visible post has');
select t.eq((select count(*) from storage.objects where bucket_id = 'post-media')::text, '1', 'and read the file');
select t.fails($$ insert into public.post_media (post_id, path, kind) values ('c0000000-0000-0000-0000-000000000001', t.u(2) || '/x.jpg', 'image') $$, 'cannot add files to someone else''s post');
select t.fails($$ update public.post_media set position = 2 $$, 'attachments cannot be edited');
select t.login(t.u(3));
select t.ok($$ delete from public.post_media $$, 'a stranger delete runs...');
select t.ok($$ delete from storage.objects where bucket_id = 'post-media' $$, '...for files as well...');
select t.owner();
select t.eq((select count(*) from public.post_media)::text, '1', '...but removes no attachment');
select t.eq((select count(*) from storage.objects where bucket_id = 'post-media')::text, '1', '...and no file');

-- ---- rules about what can be attached ----
select t.login(t.u(1));
select t.fails($$ insert into public.post_media (post_id, path, kind) values ('c0000000-0000-0000-0000-000000000001', t.u(1) || '/clip.mp4', 'image') $$, 'a video file cannot pass as an image');
select t.fails($$ insert into public.post_media (post_id, path, kind) values ('c0000000-0000-0000-0000-000000000001', t.u(1) || '/pic.jpg', 'video') $$, 'nor an image as a video');
select t.fails($$ insert into public.post_media (post_id, path, kind) values ('c0000000-0000-0000-0000-000000000001', t.u(1) || '/virus.exe', 'image') $$, 'other file types are refused');
select t.fails($$ insert into public.post_media (post_id, path, kind) values ('c0000000-0000-0000-0000-000000000001', t.u(2) || '/a.jpg', 'image') $$, 'the path must be in my own folder');
select t.fails($$ insert into public.post_media (post_id, path, kind) values ('c0000000-0000-0000-0000-000000000001', t.u(1) || '/a.jpg', 'image') $$, 'the same file cannot be attached twice');
select t.ok($$ insert into public.post_media (post_id, path, kind, position) values ('c0000000-0000-0000-0000-000000000001', t.u(1) || '/v.mp4', 'video', 1) $$, 'one video is fine');
select t.fails($$ insert into public.post_media (post_id, path, kind, position) values ('c0000000-0000-0000-0000-000000000001', t.u(1) || '/v2.mov', 'video', 2) $$, 'a second video is refused');
select t.ok($$ insert into public.post_media (post_id, path, kind, position) values ('c0000000-0000-0000-0000-000000000001', t.u(1) || '/b.png', 'image', 2), ('c0000000-0000-0000-0000-000000000001', t.u(1) || '/c.webp', 'image', 3) $$, 'up to 4 files');
select t.fails($$ insert into public.post_media (post_id, path, kind) values ('c0000000-0000-0000-0000-000000000001', t.u(1) || '/d.jpg', 'image') $$, 'the 5th is refused');

-- ---- a hidden post takes its files with it ----
select t.owner();
insert into storage.objects (bucket_id, name) values ('post-media', t.u(1) || '/v.mp4');
update public.posts set hidden = true where id = 'c0000000-0000-0000-0000-000000000001';
select t.login(t.u(2));
select t.eq((select count(*) from public.post_media)::text, '0', 'hidden post: others no longer see its attachments');
select t.eq((select count(*) from storage.objects where bucket_id = 'post-media')::text, '0', 'and cannot read the files');
select t.login(t.u(1));
select t.eq((select count(*) from public.post_media)::text, '4', 'the author still can');
select t.login(t.u(7));
select t.eq((select count(*) from public.post_media)::text, '4', 'and so can moderators');
select t.eq((select count(*) from storage.objects where bucket_id = 'post-media')::text, '2', 'with the files (the two that exist)');
select t.ok($$ delete from storage.objects where bucket_id = 'post-media' and name = t.u(1) || '/v.mp4' $$, 'moderators can remove files');
select t.owner();
update public.posts set hidden = false where id = 'c0000000-0000-0000-0000-000000000001';

-- ---- suspended people cannot add files ----
select t.login(t.u(7)); select public.suspend_user(t.u(1), true);
select t.login(t.u(1));
select t.fails($$ insert into storage.objects (bucket_id, name) values ('post-media', t.u(1) || '/z.jpg') $$, 'suspended: no uploads');

-- ---- deleting a post deletes its attachments; the author can remove the files ----
select t.login(t.u(7)); select public.suspend_user(t.u(1), false);
select t.login(t.u(1));
select t.ok($$ delete from public.posts where id = 'c0000000-0000-0000-0000-000000000001' $$, 'author deletes the post');
select t.eq((select count(*) from public.post_media)::text, '0', 'its attachments go with it');
select t.ok($$ delete from storage.objects where bucket_id = 'post-media' and name = t.u(1) || '/a.jpg' $$, 'author removes the file');
select t.owner();
select t.eq((select count(*) from storage.objects where bucket_id = 'post-media')::text, '0', 'it is gone');

select t.anon();
select t.eq((select count(*) from public.post_media)::text, '0', 'signed-out visitors see nothing');
rollback;
