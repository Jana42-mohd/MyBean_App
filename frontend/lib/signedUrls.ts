import { supabase } from './supabase';

// Private files are shown through links that stop working after an hour. Links are kept for reuse until shortly before that.
const TTL_SECONDS = 3600;
const cache = new Map<string, { url: string; expires: number }>();

export async function signedUrls(bucket: string, paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const need: string[] = [];
  for (const p of new Set(paths)) {
    const hit = cache.get(`${bucket}/${p}`);
    if (hit && hit.expires > now + 60_000) out[p] = hit.url;
    else need.push(p);
  }
  if (need.length) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(need, TTL_SECONDS);
    if (error) return out; // offline or refused: the screen shows a placeholder
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) {
        cache.set(`${bucket}/${row.path}`, { url: row.signedUrl, expires: now + TTL_SECONDS * 1000 });
        out[row.path] = row.signedUrl;
      }
    }
  }
  return out;
}

export function forgetSignedUrls() {
  cache.clear();
}
