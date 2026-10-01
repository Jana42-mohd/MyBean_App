import { supabase } from './supabase';

export type LogType = 'nap' | 'diaper' | 'feeding' | 'pumping' | 'milestone' | 'mood';

export interface LogRow {
  id: string;
  type: LogType;
  logged_at: string;
  data: any;
  author?: string;
}

export async function fetchLogs(types?: LogType | LogType[], limit = 200, since?: string): Promise<LogRow[]> {
  let q = supabase
    .from('logs')
    .select('id,type,logged_at,data,profiles(name)')
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
  }));
}

export async function addLog(type: LogType, data: any, loggedAt: string = new Date().toISOString()) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not signed in');
  // household_id is filled in by the database from the signed-in user
  const { error } = await supabase.from('logs').insert({ user_id: u.user.id, type, data, logged_at: loggedAt });
  if (error) throw error;
}
