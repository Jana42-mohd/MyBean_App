// Decides whether a failed request is worth retrying later (no signal, timeout, server hiccup)
// or will never succeed (the server understood and refused it).

export function tagSupabaseError(error: any, status?: number) {
  return Object.assign(new Error(error?.message ?? 'Request failed'), {
    code: error?.code || undefined,
    details: error?.details,
    status,
    fromSupabase: true,
  });
}

export function isTransientError(e: any): boolean {
  if (!e) return false;
  const msg = String(e.message ?? e);
  if (/network request failed|failed to fetch|fetch failed|network error|timed? ?out|timeout|aborted|abort|offline|econn|enotfound|load failed|internet/i.test(msg)) return true;
  if (e.name === 'AbortError' || e.name === 'TypeError') return true;
  if (typeof e.status === 'number' && (e.status === 0 || e.status === 408 || e.status === 429 || e.status >= 500)) return true;
  if (typeof e.code === 'string' && /^PGRST30[0-3]$/.test(e.code)) return true; // expired login token: refreshes on its own
  // an error from the backend client with no database code and no HTTP status never reached the database
  if (e.fromSupabase && !e.code && !e.status) return true;
  return false;
}

// What to tell the person when an entry could not be saved for good
export function permanentReason(e: any): string {
  if (e?.code === '23503') return 'the baby it belonged to was removed';
  if (e?.code === '42501' || /row-level security/i.test(String(e?.message))) return 'your account no longer has access to it';
  return String(e?.message ?? 'the server refused it');
}
