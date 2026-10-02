import AsyncStorage from '@react-native-async-storage/async-storage';

// A sleep timer that is running right now. Saved on this phone so it survives closing the app.
export interface ActiveSleep {
  babies: { id: string; name: string }[];
  startedAt: string; // ISO
}

const KEY = 'activeSleep';

export async function getActiveSleep(): Promise<ActiveSleep | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveSleep) : null;
  } catch {
    return null;
  }
}

export async function startSleep(babies: { id: string; name: string }[]): Promise<ActiveSleep> {
  const active = { babies, startedAt: new Date().toISOString() };
  await AsyncStorage.setItem(KEY, JSON.stringify(active));
  return active;
}

export async function clearSleep() {
  await AsyncStorage.removeItem(KEY);
}

// 0:07:42 / 1:02:09
export function formatElapsed(startedAt: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
