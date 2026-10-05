import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { timeAgo } from './time';

// Local reminders: scheduled on THIS phone (no server). They fire even if the app is closed.

export interface ReminderSettings {
  feeding: boolean;
  feedingHours: number; // remind this long after a feeding
  nap: boolean;
  napHours: number; // remind this long after a nap ends
  wellbeing: boolean; // weekly check-in for the parent
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  feeding: false,
  feedingHours: 3,
  nap: false,
  napHours: 2,
  wellbeing: false,
};

const SETTINGS_KEY = 'reminderSettings';
const IDS_KEY = 'reminderIds'; // { "feed:<babyId>": notificationId, ... }
const supported = Platform.OS !== 'web';

type Baby = { id: string; name: string };

export async function getReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_REMINDERS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

// Call once at app start: how notifications look while the app is open, and the Android channel
export async function setupNotifications() {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async n => {
      // a partner's push while the app is open is already shown on Home by live sync
      const partner = n.request.content.data?.type === 'partner_log';
      return { shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: !partner, shouldShowList: !partner };
    },
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync('partner', {
      name: 'Partner activity',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function readIds(): Promise<Record<string, string>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(IDS_KEY)) ?? '{}');
  } catch {
    return {};
  }
}

async function cancelKeys(keys: string[]) {
  const ids = await readIds();
  const done = new Set<string>();
  for (const k of keys) {
    const id = ids[k];
    if (id && !done.has(id)) {
      done.add(id);
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
    delete ids[k];
  }
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
}

async function scheduleFor(kind: 'feed' | 'nap', babies: Baby[], seconds: number, title: string, body: string) {
  const keys = babies.map(b => `${kind}:${b.id}`);
  await cancelKeys(keys); // a newer log replaces the older reminder
  if (seconds < 30) return;
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { screen: 'home' } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.round(seconds),
      channelId: 'reminders',
    },
  });
  const ids = await readIds();
  keys.forEach(k => (ids[k] = id));
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
}

const names = (babies: Baby[]) =>
  babies.length <= 1 ? babies[0]?.name ?? 'Baby' : babies.slice(0, -1).map(b => b.name).join(', ') + ' & ' + babies[babies.length - 1].name;

// Called after a log is saved. Never throws: reminders must not break logging.
export async function scheduleAfterLog(type: string, babies: Baby[], data: any, loggedAt: Date) {
  if (!supported || babies.length === 0) return;
  try {
    const s = await getReminderSettings();
    if (type === 'feeding' && s.feeding) {
      const hours = parseFloat(data?.nextInHours) > 0 ? parseFloat(data.nextInHours) : s.feedingHours;
      const secs = hours * 3600 - (Date.now() - loggedAt.getTime()) / 1000;
      await scheduleFor('feed', babies, secs, 'Feeding time?', `${names(babies)} was last fed ${timeAgo(loggedAt, new Date(loggedAt.getTime() + hours * 3600000))}.`);
    }
    if (type === 'nap' && s.nap) {
      const end = data?.end ? new Date(data.end) : loggedAt;
      const secs = s.napHours * 3600 - (Date.now() - end.getTime()) / 1000;
      await scheduleFor('nap', babies, secs, 'Nap time soon?', `${names(babies)}'s last nap ended ${s.napHours} hours ago.`);
    }
  } catch (e) {
    console.warn('Could not schedule reminder:', e);
  }
}

export async function cancelRemindersFor(type: 'feeding' | 'nap', babies: Baby[]) {
  if (!supported) return;
  try {
    await cancelKeys(babies.map(b => `${type === 'feeding' ? 'feed' : 'nap'}:${b.id}`));
  } catch {}
}

// Weekly check-in for the parent: Sundays at 7pm
export async function setWellbeingReminder(on: boolean) {
  if (!supported) return;
  const ids = await readIds();
  if (ids.wellbeing) await Notifications.cancelScheduledNotificationAsync(ids.wellbeing).catch(() => {});
  delete ids.wellbeing;
  if (on) {
    ids.wellbeing = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Checking in on you',
        body: "How are you feeling this week? Take a minute for a check-in. You matter too.",
        data: { screen: 'wellbeing' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 19, minute: 0, channelId: 'reminders' },
    });
  }
  await AsyncStorage.setItem(IDS_KEY, JSON.stringify(ids));
}

// Saves settings; asks for permission the first time something is switched on.
// Returns false (and leaves everything off) if the phone refuses notifications.
export async function saveReminderSettings(next: ReminderSettings, prev: ReminderSettings): Promise<boolean> {
  const turningOn = (next.feeding && !prev.feeding) || (next.nap && !prev.nap) || (next.wellbeing && !prev.wellbeing);
  if (turningOn && !(await ensurePermission())) return false;
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  if (next.wellbeing !== prev.wellbeing) await setWellbeingReminder(next.wellbeing);
  if (!next.feeding && prev.feeding) await clearKind('feed');
  if (!next.nap && prev.nap) await clearKind('nap');
  return true;
}

async function clearKind(kind: 'feed' | 'nap') {
  const ids = await readIds();
  await cancelKeys(Object.keys(ids).filter(k => k.startsWith(kind + ':')));
}
