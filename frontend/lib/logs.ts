import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { isTransientError, tagSupabaseError } from './netError';
import { pendingLogRows } from './outbox';

export type LogType = 'nap' | 'diaper' | 'feeding' | 'pumping' | 'milestone' | 'mood' | 'growth';

export interface LogRow {
  id: string;
  type: LogType;
  logged_at: string;
  data: any;
  author?: string;
  baby_id: string | null;
  baby?: string;
  pending?: boolean; // saved on this phone, still waiting to be sent
}

const CACHE_MAX_ROWS = 400;

// Entries saved while offline that the server does not know about yet, shaped like fetched rows
function pendingAsRows(types: LogType[] | undefined, since: string | undefined): LogRow[] {
  return pendingLogRows()
    .filter(r => (!types || types.includes(r.type as LogType)) && (!since || r.logged_at >= since))
    .map(r => ({
      id: r.id,
      type: r.type as LogType,
      logged_at: r.logged_at,
      data: r.data,
      baby_id: r.baby_id,
      baby: r.baby_name,
      author: 'You',
      pending: true,
    }));
}

export async function fetchLogs(types?: LogType | LogType[], limit = 200, since?: string): Promise<LogRow[]> {
  const typeList = Array.isArray(types) ? types : types ? [types] : undefined;
  const { data: sess } = await supabase.auth.getSession(); // local read
  const cacheKey = sess.session && limit <= 600 ? `logsCache:v1:${sess.session.user.id}:${(typeList ?? ['all']).join(',')}:${limit}:${since?.slice(0, 10) ?? ''}` : null;

  const withPending = (rows: LogRow[]) => {
    const have = new Set(rows.map(r => r.id));
    const extra = pendingAsRows(typeList, since).filter(r => !have.has(r.id));
    return [...extra, ...rows].sort((a, b) => (a.logged_at < b.logged_at ? 1 : -1)).slice(0, limit);
  };

  let q = supabase
    .from('logs')
    .select('id,type,logged_at,data,baby_id,babies(name),profiles(name)')
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (typeList) q = typeList.length === 1 ? q.eq('type', typeList[0]) : q.in('type', typeList);
  if (since) q = q.gte('logged_at', since);

  const { data, error, status } = await q;
  if (error) {
    const err = tagSupabaseError(error, status);
    // no signal: show what we saw last time, plus anything saved on this phone since
    if (isTransientError(err) && cacheKey) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) return withPending(JSON.parse(cached) as LogRow[]);
      } catch {}
    }
    throw err;
  }
  const rows: LogRow[] = (data ?? []).map((r: any) => ({
    id: r.id,
    type: r.type,
    logged_at: r.logged_at,
    data: r.data,
    author: r.profiles?.name,
    baby_id: r.baby_id,
    baby: r.babies?.name,
  }));
  if (cacheKey) AsyncStorage.setItem(cacheKey, JSON.stringify(rows.slice(0, CACHE_MAX_ROWS))).catch(() => {});
  return withPending(rows);
}

export async function deleteLog(id: string) {
  const { error, status } = await supabase.from('logs').delete().eq('id', id);
  if (error) throw tagSupabaseError(error, status);
}

// Edits the free-text note on an entry (other fields stay as logged)
export async function updateLogNotes(id: string, data: any, notes: string) {
  const next = { ...data };
  if (notes.trim()) next.notes = notes.trim();
  else delete next.notes;
  const { error } = await supabase.from('logs').update({ data: next }).eq('id', id);
  if (error) throw error;
}

// Replaces an entry's data (and optionally its time) after the user edits it
export async function updateLog(id: string, data: any, loggedAt?: string) {
  const patch: Record<string, any> = { data };
  if (loggedAt) patch.logged_at = loggedAt;
  const { error } = await supabase.from('logs').update(patch).eq('id', id);
  if (error) throw error;
}
