import { friendlyError } from '@/components/LoadError';
import { isOnline, logEntryEx, undoEntry } from './logActions';
import { isTransientError } from './netError';
import { flush, getPendingCount } from './outbox';
import { ActiveSleep, claimSleep, queueSleepStop, restoreSleep } from './timer';
import { formatDuration } from './time';

// Stopping a shared sleep timer ("Woke up"). Used from the Right now card and from the Quick Log banner.
export interface SleepUi {
  toast: (message: string, undo?: () => Promise<void>) => void;
  changed: () => void;          // something was logged: reload Home
  reloadSleeps: () => Promise<void>;
}

export async function wakeUp(sl: ActiveSleep, ui: SleepUi) {
  try {
    // anything made offline goes first, so the timer exists on the server before we stop it
    if (getPendingCount() > 0 && (await isOnline())) await flush().catch(() => {});
    if (!(await isOnline())) {
      await queueSleepStop(sl.baby_id, sl.baby_name);
      ui.toast(`Woke up saved offline: ${sl.baby_name}'s nap will be logged when you're back online`);
      return;
    }

    // Claim the timer first: if the other parent already stopped it we get nothing back and must not log a second nap
    let startedAt: string | null;
    try {
      startedAt = await claimSleep(sl.baby_id);
    } catch (e) {
      if (!isTransientError(e)) throw e;
      await queueSleepStop(sl.baby_id, sl.baby_name); // connection died just now
      ui.toast(`Woke up saved offline: ${sl.baby_name}'s nap will be logged when you're back online`);
      return;
    }
    await ui.reloadSleeps();
    if (!startedAt) {
      ui.toast(`${sl.baby_name}'s sleep was already stopped`);
      return;
    }
    const start = new Date(startedAt);
    const end = new Date();
    const minutes = (end.getTime() - start.getTime()) / 60000;
    if (minutes < 1) {
      ui.toast('Sleep was under a minute, so it was not saved');
      return;
    }
    const baby = { id: sl.baby_id, name: sl.baby_name };
    try {
      // if the connection drops right now the nap is queued, not lost
      const { ids, queued } = await logEntryEx('nap', { start: start.toISOString(), end: end.toISOString() }, [baby], start.toISOString());
      ui.toast(`Logged ${formatDuration(minutes)} of sleep for ${sl.baby_name}${queued ? ' (saved offline, will sync)' : ''}`, () => undoEntry('nap', ids, [baby]));
      ui.changed();
    } catch (e) {
      await restoreSleep(sl.baby_id, startedAt).catch(() => {}); // the server refused the nap: keep the timer so nothing is lost
      await ui.reloadSleeps();
      ui.toast(`Could not save the nap: ${friendlyError(e)}`);
    }
  } catch (e) {
    ui.toast(`Could not stop the timer: ${friendlyError(e)}`);
  }
}
