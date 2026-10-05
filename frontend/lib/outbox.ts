import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { emitResync } from './liveSync';
import { isTransientError, permanentReason, tagSupabaseError } from './netError';

// The outbox: things done while offline are written here first and sent when the connection is back.
//  * every log row has an id created on the phone, so a retry can never create a duplicate
//  * entries are sent in the order they were made
//  * "no signal" keeps the entry for later; "the server refused it" reports it once and drops it
//  * stored on the phone per account; another person logging in on the same phone never sends it

export interface QueuedLogRow {
  id: string;
  baby_id: string | null;
  type: string;
  data: any;
  logged_at: string;
  baby_name?: string; // for showing the pending entry; never sent to the server
}

export type Op =
  | { kind: 'log'; rows: QueuedLogRow[] }
  | { kind: 'sleep_start'; baby_ids: string[]; names: string[]; started_at: string }
  | { kind: 'sleep_stop'; baby_id: string; baby_name: string; ended_at: string; log_id: string };

export interface Entry {
  opId: string;
  userId: string;
  createdAt: string;
  op: Op;
}

const KEY = 'outbox:v1';
let entries: Entry[] = [];
let userId: string | null = null;
let flushing: Promise<number> | null = null;
let seq = 0;

const changeListeners = new Set<() => void>();
const failListeners = new Set<(message: string) => void>();
const notify = () => changeListeners.forEach(l => l());

export const subscribeOutbox = (l: () => void) => {
  changeListeners.add(l);
  return () => { changeListeners.delete(l); };
};
export const onOutboxFailure = (l: (message: string) => void) => {
  failListeners.add(l);
  return () => { failListeners.delete(l); };
};

const mine = () => entries.filter(e => e.userId === userId);
export const getPendingCount = () => mine().length;

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Could not save the outbox:', e);
  }
}

// Call when someone signs in (userId) or out (null). Entries stay on the phone until sent.
export async function initOutbox(forUser: string | null) {
  userId = forUser;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    entries = raw ? JSON.parse(raw) : [];
  } catch {
    entries = [];
  }
  notify();
}

export function newOpId() {
  return `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function enqueue(op: Op) {
  if (!userId) throw new Error('Not signed in');
  entries.push({ opId: newOpId(), userId, createdAt: new Date().toISOString(), op });
  await persist();
  notify();
  flush().catch(() => {}); // sends right away when there is a connection after all
}

// Removes still-unsent log rows (used by Undo). Returns the ids that were removed.
export async function removePendingLogs(ids: string[]): Promise<string[]> {
  const gone: string[] = [];
  for (const e of mine()) {
    if (e.op.kind !== 'log') continue;
    const keep = e.op.rows.filter(r => {
      const hit = ids.includes(r.id);
      if (hit) gone.push(r.id);
      return !hit;
    });
    if (keep.length !== e.op.rows.length) e.op.rows = keep;
  }
  entries = entries.filter(e => !(e.op.kind === 'log' && e.op.rows.length === 0));
  if (gone.length) {
    await persist();
    notify();
  }
  return gone;
}

// ---- views of what is waiting, so screens can show it ----
export function pendingLogRows(): QueuedLogRow[] {
  return mine().flatMap(e => (e.op.kind === 'log' ? e.op.rows : []));
}
export function pendingSleepOps() {
  return mine().flatMap(e => (e.op.kind === 'sleep_start' || e.op.kind === 'sleep_stop' ? [e.op] : []));
}

// Removes a sleep timer start that was never sent (used when someone discards it while offline)
export async function removePendingSleepStart(babyId: string): Promise<boolean> {
  let removed = false;
  entries = entries.filter(e => {
    if (e.userId !== userId || e.op.kind !== 'sleep_start') return true;
    const op = e.op;
    if (!op.baby_ids.includes(babyId)) return true;
    removed = true;
    const keep = op.baby_ids.map((id, i) => ({ id, name: op.names[i] })).filter(b => b.id !== babyId);
    if (keep.length === 0) return false;
    op.baby_ids = keep.map(b => b.id);
    op.names = keep.map(b => b.name);
    return true;
  });
  if (removed) {
    await persist();
    notify();
  }
  return removed;
}

// ---- sending ----
export async function insertLogRows(rows: QueuedLogRow[], uid: string) {
  const payload = rows.map(({ baby_name: _name, ...r }) => ({ ...r, user_id: uid }));
  const { error, status } = await supabase.from('logs').upsert(payload, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw tagSupabaseError(error, status);
}

async function execute(entry: Entry) {
  const op = entry.op;
  if (op.kind === 'log') {
    await insertLogRows(op.rows, entry.userId);
  } else if (op.kind === 'sleep_start') {
    const { error, status } = await supabase
      .from('active_sleeps')
      .upsert(op.baby_ids.map(baby_id => ({ baby_id, started_at: op.started_at })), { onConflict: 'baby_id', ignoreDuplicates: true });
    if (error) throw tagSupabaseError(error, status);
  } else {
    // Take the timer; if the partner already stopped it there is nothing to save (and no second nap)
    const { data, error, status } = await supabase.from('active_sleeps').delete().eq('baby_id', op.baby_id).select('started_at');
    if (error) throw tagSupabaseError(error, status);
    if (!data || data.length === 0) return;
    const startedAt = data[0].started_at as string;
    if ((new Date(op.ended_at).getTime() - new Date(startedAt).getTime()) / 60000 < 1) return;
    // The timer is gone from the server now, so turn this entry into the nap itself BEFORE saving it:
    // if saving fails for lack of signal, the nap is still safely queued and retried
    entry.op = {
      kind: 'log',
      rows: [{ id: op.log_id, baby_id: op.baby_id, type: 'nap', data: { start: startedAt, end: op.ended_at }, logged_at: startedAt, baby_name: op.baby_name }],
    };
    await persist();
    notify();
    await insertLogRows(entry.op.rows, entry.userId);
  }
}

// Sends everything waiting for the signed-in person, in order. Returns how many entries were sent.
export function flush(): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    try {
      for (const entry of [...mine()]) {
        try {
          await execute(entry);
          entries = entries.filter(e => e.opId !== entry.opId);
          sent++;
        } catch (e) {
          if (isTransientError(e)) break; // still no connection: keep the rest, try again later
          entries = entries.filter(e2 => e2.opId !== entry.opId);
          failListeners.forEach(l => l(`One saved-offline entry could not be sent because ${permanentReason(e)}.`));
        }
      }
    } finally {
      await persist();
      notify();
      flushing = null;
    }
    if (sent) emitResync(); // screens reload
    return sent;
  })();
  return flushing;
}

// for tests / account deletion
export async function clearOutbox(forUser?: string) {
  entries = forUser ? entries.filter(e => e.userId !== forUser) : [];
  await persist();
  notify();
}
