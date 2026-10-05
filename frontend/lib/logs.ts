import { supabase } from './supabase';

export type LogType = 'nap' | 'diaper' | 'feeding' | 'pumping' | 'milestone' | 'mood' | 'growth';

export interface LogRow {
  id: string;
  type: LogType;
  logged_at: string;
  data: any;
  author?: string;
  baby_id: string | null;
  baby?: string;
}

export async function fetchLogs(types?: LogType | LogType[], limit = 200, since?: string): Promise<LogRow[]> {
  let q = supabase
    .from('logs')
    .select('id,type,logged_at,data,baby_id,babies(name),profiles(name)')
    .order('logged_at', { ascending: false })
    .limit(limit);
  if (Array.isArray(types)) q = q.in('type', types);
  else if (types) q = q.eq('type', types);
  if (since) q = q.gte('logged_at', since);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    type: r.type,
    logged_at: r.logged_at,
    data: r.data,
    author: r.profiles?.name,
    baby_id: r.baby_id,
    baby: r.babies?.name,
  }));
}

// Logs one entry for each baby in babyIds (e.g. feeding twins together = one row per twin).
// Pumping isn't tied to a baby: pass an empty list.
export async function addLog(type: LogType, data: any, babyIds: string[], loggedAt: string = new Date().toISOString()): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not signed in');
  if (babyIds.length === 0 && type !== 'pumping') throw new Error('Add a baby first');
  // household_id is filled in by the database from the signed-in user
  const targets: (string | null)[] = type === 'pumping' ? [null] : babyIds;
  const rows = targets.map(baby_id => ({ user_id: u.user!.id, baby_id, type, data, logged_at: loggedAt }));
  const { data: inserted, error } = await supabase.from('logs').insert(rows).select('id');
  if (error) throw error;
  return (inserted ?? []).map((r: any) => r.id as string);
}

export async function deleteLog(id: string) {
  const { error } = await supabase.from('logs').delete().eq('id', id);
  if (error) throw error;
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
