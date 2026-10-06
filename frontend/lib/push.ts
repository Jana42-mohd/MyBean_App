import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ensurePermission } from './reminders';
import { supabase } from './supabase';

// Notifications from your partner ("Blake logged a feeding for Mia"). The database sends them when an entry is saved
// (supabase/migrations/0011); this file only gives the server this phone's address (an Expo push token) and the on/off switch.
// Reminders (reminders.ts) are separate: those are scheduled on the phone itself.

const TOKEN_KEY = 'pushToken';
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

async function readToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
  const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return res.data || null;
}

async function register(): Promise<boolean> {
  try {
    const token = await readToken();
    if (!token) return false;
    const { error } = await supabase.rpc('register_push_token', { t: token, p: Platform.OS });
    if (error) throw error;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch (e) {
    // Expo Go on Android, a missing EAS project id, or no signal: partner notifications just stay off
    console.warn('Could not register for partner notifications:', e);
    return false;
  }
}

// Called after sign-in: refreshes this phone's address if the person already allowed notifications (never asks)
export async function syncPushToken(): Promise<void> {
  if (!supported) return;
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: me }, perm] = await Promise.all([
      supabase.from('profiles').select('notify_partner').eq('id', u.user.id).maybeSingle(),
      Notifications.getPermissionsAsync(),
    ]);
    if (me?.notify_partner === false || !perm.granted) return;
    await register();
  } catch {}
}

export async function getPartnerNotifications(): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return true;
  const { data } = await supabase.from('profiles').select('notify_partner').eq('id', u.user.id).maybeSingle();
  return data?.notify_partner !== false;
}

// The Settings switch. Turning on asks the phone for permission; returns false if that is refused
// (the preference is then left off). Turning off only changes the preference, the server stops sending right away.
export async function setPartnerNotifications(on: boolean): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not signed in');
  if (on && supported) {
    if (!(await ensurePermission())) return false;
  }
  const { error } = await supabase.from('profiles').update({ notify_partner: on }).eq('id', u.user.id);
  if (error) throw error;
  if (on && supported) await register();
  return true;
}

// Log out: this phone stops receiving this person's notifications (call BEFORE signing out)
export async function forgetPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) await supabase.rpc('unregister_push_token', { t: token });
  } catch {}
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}
