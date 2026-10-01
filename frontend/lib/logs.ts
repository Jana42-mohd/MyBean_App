import { supabase } from './supabase';

export type LogType = 'nap' | 'diaper' | 'feeding' | 'pumping' | 'milestone' | 'mood';

export interface LogRow {
  id: string;
  type: LogType;
  logged_at: string;
  data: any;
}

export async function fetchLogs(type?: LogType, limit = 200): Promise<LogRow[]> {
  let q = supabase.from('logs').select('id,type,logged_at,data').order('logged_at', { ascending: false }).limit(limit);
  if (type) q = q.eq('type', type);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as LogRow[];
}

export async function addLog(type: LogType, data: any, loggedAt: string = new Date().toISOString()) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not signed in');
  const { error } = await supabase.from('logs').insert({ user_id: u.user.id, type, data, logged_at: loggedAt });
  if (error) throw error;
}
