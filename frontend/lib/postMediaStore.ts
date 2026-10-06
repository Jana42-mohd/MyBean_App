import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { signedUrls } from './signedUrls';
import { supabase } from './supabase';

// Photos and videos in community posts (rules in supabase/migrations/0014_post_media.sql).
// Order of work: upload the files -> create the post -> attach the files. If any step fails, what was already done is undone.

export const BUCKET = 'post-media';
export const MAX_FILES = 4;

export type MediaKind = 'image' | 'video';
export interface LocalMedia {
  uri: string;      // on this phone (images are already shrunk and stripped of location data)
  kind: MediaKind;
  ext: string;      // jpg, png, webp, mp4 or mov
  mime: string;
  duration?: number; // seconds, videos
}
export interface PostFile {
  path: string;
  kind: MediaKind;
  position: number;
}

export async function removeFiles(paths: string[]) {
  if (!paths.length) return;
  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch {}
}

async function uploadOne(uid: string, m: LocalMedia): Promise<string> {
  const path = `${uid}/${Crypto.randomUUID()}.${m.ext}`;
  let body: any;
  if (m.kind === 'video' && Platform.OS !== 'web') {
    // streamed from disk by the phone's networking layer, so a big video never has to fit in app memory
    body = new FormData();
    body.append('file', { uri: m.uri, name: path.split('/')[1], type: m.mime } as any);
  } else {
    body = await (await fetch(m.uri)).arrayBuffer();
  }
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: m.mime, upsert: false });
  if (error) throw error;
  return path;
}

export interface NewPost {
  title: string;
  excerpt: string;
  tags: string[];
}

// Publishes a post with up to 4 photos/videos. `onProgress(done, total)` is called as files go up.
export async function createPostWithMedia(post: NewPost, media: LocalMedia[], onProgress?: (done: number, total: number) => void): Promise<void> {
  if (media.length > MAX_FILES) throw new Error(`A post can have at most ${MAX_FILES} photos or videos.`);
  if (media.filter(m => m.kind === 'video').length > 1) throw new Error('A post can have only one video.');
  if (media.length === 0) {
    const { error } = await supabase.from('posts').insert(post);
    if (error) throw error;
    return;
  }
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) throw new Error('Not signed in');

  const uploaded: PostFile[] = [];
  try {
    for (const [i, m] of media.entries()) {
      onProgress?.(i, media.length);
      uploaded.push({ path: await uploadOne(uid, m), kind: m.kind, position: i });
    }
    onProgress?.(media.length, media.length);
  } catch (e) {
    await removeFiles(uploaded.map(f => f.path));
    throw e;
  }

  const created = await supabase.from('posts').insert(post).select('id').single();
  if (created.error || !created.data) {
    await removeFiles(uploaded.map(f => f.path));
    throw created.error ?? new Error('Could not create the post');
  }
  const attached = await supabase.from('post_media').insert(uploaded.map(f => ({ post_id: created.data.id, path: f.path, kind: f.kind, position: f.position })));
  if (attached.error) {
    await supabase.from('posts').delete().eq('id', created.data.id);
    await removeFiles(uploaded.map(f => f.path));
    throw attached.error;
  }
}

// post id -> its files in order
export async function fetchPostMedia(postIds: string[]): Promise<Record<string, PostFile[]>> {
  if (!postIds.length) return {};
  const { data, error } = await supabase.from('post_media').select('post_id,path,kind,position').in('post_id', postIds).order('position');
  if (error) throw error;
  const out: Record<string, PostFile[]> = {};
  for (const r of (data ?? []) as any[]) (out[r.post_id] ??= []).push({ path: r.path, kind: r.kind, position: r.position });
  return out;
}

export const mediaUrls = (paths: string[]) => signedUrls(BUCKET, paths);

// Deletes a post and then its files (the database cannot delete files from storage)
export async function deletePostWithMedia(postId: string) {
  const files = (await fetchPostMedia([postId]))[postId] ?? [];
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
  await removeFiles(files.map(f => f.path));
}
