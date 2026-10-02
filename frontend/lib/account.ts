import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';
import { supabase } from './supabase';

// Remove everything this app stored on THIS phone for the signed-in person (reminders, sleep timer).
// Run on log out and after deleting an account so the next person on the phone starts clean.
export async function clearLocalData() {
  try {
    if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}
  await AsyncStorage.multiRemove(['reminderSettings', 'reminderIds', 'activeSleep']).catch(() => {});
}

export async function signOutEverywhereOnDevice() {
  await clearLocalData();
  await supabase.auth.signOut();
}

// Permanently deletes the account and its personal data (see supabase/migrations/0006_delete_account.sql
// for exactly what is kept for a remaining partner). The profile photo file is removed first because
// the database cannot delete files from storage.
export async function deleteAccount() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not signed in');

  const { data: files } = await supabase.storage.from('avatars').list(u.user.id);
  if (files?.length) {
    await supabase.storage.from('avatars').remove(files.map(f => `${u.user!.id}/${f.name}`));
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;

  await clearLocalData();
  await supabase.auth.signOut({ scope: 'local' }); // the account is gone, so only clear this phone's session
}

async function all(table: string, build: (q: any) => any = q => q) {
  const { data, error } = await build(supabase.from(table).select('*'));
  if (error) throw error;
  return data ?? [];
}

// Everything the person can see about themselves and their household, as a JSON file.
export async function exportMyData(): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not signed in');
  const me = u.user;

  const [profile, survey, wellbeing, posts, likes, saves, household, babies, logs] = await Promise.all([
    all('profiles', q => q.eq('id', me.id)),
    all('surveys', q => q.eq('user_id', me.id)),
    all('wellbeing_entries', q => q.order('created_at')),
    all('posts', q => q.eq('user_id', me.id)),
    all('post_likes', q => q.eq('user_id', me.id)),
    all('post_saves', q => q.eq('user_id', me.id)),
    all('households'),
    all('babies', q => q.order('created_at')),
    all('logs', q => q.order('logged_at')),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    app: 'My Little Bean',
    account: { id: me.id, email: me.email, created_at: me.created_at },
    profile: profile[0] ?? null,
    survey: survey[0]?.data ?? null,
    wellbeing_entries: wellbeing,
    community: { posts, liked_post_ids: likes.map((l: any) => l.post_id), saved_post_ids: saves.map((s: any) => s.post_id) },
    household: household[0] ? { invite_code: household[0].invite_code, created_at: household[0].created_at } : null,
    babies,
    logs,
  };
  const text = JSON.stringify(payload, null, 2);

  try {
    const file = new File(Paths.cache, `my-little-bean-data-${new Date().toISOString().slice(0, 10)}.json`);
    file.create({ overwrite: true });
    file.write(text);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your My Little Bean data' });
      return;
    }
  } catch (e) {
    console.warn('File export failed, falling back to text share:', e);
  }
  await Share.share({ message: text });
}
