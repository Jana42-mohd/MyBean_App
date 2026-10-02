import { addLog, deleteLog, LogType } from './logs';
import { cancelRemindersFor, scheduleAfterLog } from './reminders';

export type BabyRef = { id: string; name: string };

// Saves the log(s) and sets up any reminder. Returns the new row ids (for Undo).
export async function logEntry(type: LogType, data: any, babies: BabyRef[], loggedAt?: string): Promise<string[]> {
  const when = loggedAt ?? new Date().toISOString();
  const ids = await addLog(type, data, babies.map(b => b.id), when);
  scheduleAfterLog(type, babies, data, new Date(when)); // fire and forget
  return ids;
}

export async function undoEntry(type: LogType, ids: string[], babies: BabyRef[]) {
  await Promise.all(ids.map(deleteLog));
  if (type === 'feeding' || type === 'nap') await cancelRemindersFor(type, babies);
}
