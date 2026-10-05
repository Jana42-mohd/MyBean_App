import { supabase } from './supabase';

// Shared sleep timers: one row per sleeping baby, visible to (and stoppable by) every parent in the household.
export interface ActiveSleep {
  baby_id: string;
  baby_name: string;
  started_at: string; // ISO
  started_by: string;
  started_by_name: string;
}

export async function getActiveSleeps(): Promise<ActiveSleep[]> {
  const { data, error } = await supabase
    .from('active_sleeps')
    .select('baby_id,started_at,started_by,babies(name),profiles(name)')
    .order('started_at');
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    baby_id: r.baby_id,
    baby_name: r.babies?.name ?? 'Baby',
    started_at: r.started_at,
    started_by: r.started_by,
    started_by_name: r.profiles?.name ?? 'Someone',
  }));
}

// Babies that are already asleep are skipped, so two parents tapping at once cannot create two timers
export async function startSleeps(babyIds: string[]) {
  const { error } = await supabase
    .from('active_sleeps')
    .upsert(babyIds.map(baby_id => ({ baby_id })), { onConflict: 'baby_id', ignoreDuplicates: true });
  if (error) throw error;
}

// Atomically takes the timer: returns its start time, or null if the other parent already stopped it.
// Whoever gets a result is the only one who saves the nap, so it can never be logged twice.
export async function claimSleep(babyId: string): Promise<string | null> {
  const { data, error } = await supabase.from('active_sleeps').delete().eq('baby_id', babyId).select('started_at');
  if (error) throw error;
  return data && data.length ? (data[0].started_at as string) : null;
}

// Puts a timer back if saving the nap failed after claiming it
export async function restoreSleep(babyId: string, startedAt: string) {
  await supabase.from('active_sleeps').insert({ baby_id: babyId, started_at: startedAt });
}

export async function discardSleep(babyId: string) {
  const { error } = await supabase.from('active_sleeps').delete().eq('baby_id', babyId);
  if (error) throw error;
}

// 0:07:42 / 1:02:09
export function formatElapsed(startedAt: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
