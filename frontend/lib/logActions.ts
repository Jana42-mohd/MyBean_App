import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { LogType, deleteLog } from './logs';
import { QueuedLogRow, enqueue, insertLogRows, removePendingLogs } from './outbox';
import { isTransientError } from './netError';
import { cancelRemindersFor, scheduleAfterLog } from './reminders';
import { supabase } from './supabase';

export type BabyRef = { id: string; name: string };

export async function isOnline(): Promise<boolean> {
  try {
    const s = await NetInfo.fetch();
    return s.isConnected !== false && s.isInternetReachable !== false;
  } catch {
    return true; // cannot tell: try for real
  }
}

// Saves the log(s). With no signal they are kept on the phone and sent later (queued: true).
// Every row gets its id here, so sending twice can never create a duplicate.
export async function logEntryEx(type: LogType, data: any, babies: BabyRef[], loggedAt?: string): Promise<{ ids: string[]; queued: boolean }> {
  const when = loggedAt ?? new Date().toISOString();
  if (type !== 'pumping' && babies.length === 0) throw new Error('Add a baby first');
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) throw new Error('Not signed in');

  const targets: (BabyRef | null)[] = type === 'pumping' ? [null] : babies;
  const rows: QueuedLogRow[] = targets.map(b => ({ id: Crypto.randomUUID(), baby_id: b?.id ?? null, type, data, logged_at: when, baby_name: b?.name }));

  let queued = false;
  if (await isOnline()) {
    try {
      await insertLogRows(rows, uid);
    } catch (e) {
      if (!isTransientError(e)) throw e; // the server refused it: tell the person
      queued = true;
    }
  } else {
    queued = true;
  }
  if (queued) await enqueue({ kind: 'log', rows });

  scheduleAfterLog(type, babies, data, new Date(when)); // fire and forget
  return { ids: rows.map(r => r.id), queued };
}

// Same as logEntryEx, returning only the ids (for screens that do not care whether it was queued)
export async function logEntry(type: LogType, data: any, babies: BabyRef[], loggedAt?: string): Promise<string[]> {
  return (await logEntryEx(type, data, babies, loggedAt)).ids;
}

// Undo: an entry still waiting on this phone is simply taken out of the queue; a saved one is deleted on the server
export async function undoEntry(type: LogType, ids: string[], babies: BabyRef[]) {
  const removed = await removePendingLogs(ids);
  const saved = ids.filter(id => !removed.includes(id));
  await Promise.all(saved.map(deleteLog));
  if (type === 'feeding' || type === 'nap') await cancelRemindersFor(type, babies);
}
