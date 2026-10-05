import * as Crypto from 'expo-crypto';
import { isOnline } from './logActions';
import { isTransientError, tagSupabaseError } from './netError';
import { enqueue, pendingSleepOps, removePendingSleepStart } from './outbox';
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
  if (error) throw tagSupabaseError(error);
  return (data ?? []).map((r: any) => ({
    baby_id: r.baby_id,
    baby_name: r.babies?.name ?? 'Baby',
    started_at: r.started_at,
    started_by: r.started_by,
    started_by_name: r.profiles?.name ?? 'Someone',
  }));
}

// Babies that are already asleep are skipped, so two parents tapping at once cannot create two timers.
// With no signal the start is kept on the phone and sent later (queued: true).
export async function startSleeps(babies: { id: string; name: string }[]): Promise<{ queued: boolean }> {
  const queueIt = async () => {
    await enqueue({ kind: 'sleep_start', baby_ids: babies.map(b => b.id), names: babies.map(b => b.name), started_at: new Date().toISOString() });
    return { queued: true };
  };
  if (!(await isOnline())) return queueIt();
  const { error, status } = await supabase
    .from('active_sleeps')
    .upsert(babies.map(b => ({ baby_id: b.id })), { onConflict: 'baby_id', ignoreDuplicates: true });
  if (error) {
    const err = tagSupabaseError(error, status);
    if (isTransientError(err)) return queueIt();
    throw err;
  }
  return { queued: false };
}

// Atomically takes the timer: returns its start time, or null if the other parent already stopped it.
// Whoever gets a result is the only one who saves the nap, so it can never be logged twice.
export async function claimSleep(babyId: string): Promise<string | null> {
  const { data, error, status } = await supabase.from('active_sleeps').delete().eq('baby_id', babyId).select('started_at');
  if (error) throw tagSupabaseError(error, status);
  return data && data.length ? (data[0].started_at as string) : null;
}

// Stop while offline: remembered on the phone and finished (timer taken, nap saved) when the connection returns
export async function queueSleepStop(babyId: string, babyName: string) {
  await enqueue({ kind: 'sleep_stop', baby_id: babyId, baby_name: babyName, ended_at: new Date().toISOString(), log_id: Crypto.randomUUID() });
}

// Puts a timer back if saving the nap failed after claiming it
export async function restoreSleep(babyId: string, startedAt: string) {
  await supabase.from('active_sleeps').insert({ baby_id: babyId, started_at: startedAt });
}

export async function discardSleep(babyId: string) {
  if (await removePendingSleepStart(babyId)) return; // it was never sent: just forget it
  const { error, status } = await supabase.from('active_sleeps').delete().eq('baby_id', babyId);
  if (error) throw tagSupabaseError(error, status);
}

// What the timers look like right now: the server's list, plus starts/stops still waiting on this phone
export function withPendingSleeps(server: ActiveSleep[], me: string | null): ActiveSleep[] {
  let list = [...server];
  for (const op of pendingSleepOps()) {
    if (op.kind === 'sleep_start') {
      op.baby_ids.forEach((id, i) => {
        if (!list.some(s => s.baby_id === id)) {
          list.push({ baby_id: id, baby_name: op.names[i] ?? 'Baby', started_at: op.started_at, started_by: me ?? '', started_by_name: 'You' });
        }
      });
    } else {
      list = list.filter(s => s.baby_id !== op.baby_id);
    }
  }
  return list;
}

// 0:07:42 / 1:02:09
export function formatElapsed(startedAt: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
