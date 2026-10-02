import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { LoadError, friendlyError } from '@/components/LoadError';
import { supabase } from '@/lib/supabase';

interface ReportedPost {
  id: string;
  user_id: string;
  title: string;
  excerpt: string;
  hidden: boolean;
  post_reports: { reason: string; details: string | null }[];
}

// Moderators only (profiles.is_moderator = true). Row-level security enforces this on the server too.
export default function ModerationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [posts, setPosts] = useState<ReportedPost[]>([]);
  const [error, setError] = useState('');
  const [suspended, setSuspended] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase
      .from('posts')
      .select('id,user_id,title,excerpt,hidden,post_reports!inner(reason,details)')
      .order('created_at', { ascending: false });
    if (err) setError(friendlyError(err));
    else setPosts((data ?? []) as any);
    const { data: sus } = await supabase.from('profiles').select('id,name').eq('suspended', true);
    setSuspended((sus ?? []) as any);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const restore = async (id: string) => {
    // Clear the reports so the post doesn't get re-hidden by the next report straight away
    const r1 = await supabase.from('post_reports').delete().eq('post_id', id);
    const r2 = await supabase.from('posts').update({ hidden: false }).eq('id', id);
    if (r1.error || r2.error) Alert.alert('Error', friendlyError(r1.error || r2.error));
    load();
  };

  const setSuspension = (userId: string, on: boolean, name?: string) =>
    Alert.alert(on ? 'Suspend this member?' : `Restore ${name ?? 'this member'}?`, on ? 'They will not be able to post, and their posts are hidden from everyone.' : 'They will be able to post again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: on ? 'Suspend' : 'Restore',
        style: on ? 'destructive' : 'default',
        onPress: async () => {
          const { error: err } = await supabase.rpc('suspend_user', { target: userId, suspend: on });
          if (err) Alert.alert('Error', friendlyError(err));
          load();
        },
      },
    ]);

  const remove = (id: string) =>
    Alert.alert('Delete post?', 'This permanently removes the post.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: err } = await supabase.from('posts').delete().eq('id', id);
          if (err) Alert.alert('Error', friendlyError(err));
          load();
        },
      },
    ]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>← Back</Text></Pressable>
        <ThemedText style={styles.title}>Reported posts</ThemedText>
        {error ? <LoadError message={error} onRetry={load} /> : null}
        {posts.length === 0 && !error ? <Text style={styles.muted}>Nothing to review right now.</Text> : null}
        {posts.map(p => (
          <View key={p.id} style={styles.card}>
            <Text style={styles.status}>{p.hidden ? 'HIDDEN' : 'Visible'} · {p.post_reports.length} report(s)</Text>
            <Text style={styles.postTitle}>{p.title}</Text>
            <Text style={styles.body}>{p.excerpt}</Text>
            <Text style={styles.muted}>Reasons: {p.post_reports.map(r => r.reason).join(', ')}</Text>
            <View style={styles.row}>
              <Pressable onPress={() => restore(p.id)}><Text style={styles.action}>Keep (clear reports)</Text></Pressable>
              <Pressable onPress={() => setSuspension(p.user_id, true)}><Text style={[styles.action, { color: '#ff9db1' }]}>Suspend author</Text></Pressable>
              <Pressable onPress={() => remove(p.id)}><Text style={[styles.action, { color: '#ff9db1' }]}>Delete</Text></Pressable>
            </View>
          </View>
        ))}
        {suspended.length > 0 ? (
          <>
            <ThemedText style={[styles.title, { fontSize: 20, marginTop: 10 }]}>Suspended members</ThemedText>
            {suspended.map(m => (
              <View key={m.id} style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={styles.postTitle}>{m.name}</Text>
                <Pressable onPress={() => setSuspension(m.id, false, m.name)}><Text style={styles.action}>Restore</Text></Pressable>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09282eff' },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 40 },
  back: { color: '#A4CDD3', marginBottom: 12 },
  title: { fontSize: 24, color: '#FED8FE', fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: '#0f3a41ff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2F9BA8', marginBottom: 14 },
  status: { color: '#FDFECC', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  postTitle: { color: '#E8FBFF', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  body: { color: '#E8FBFF', fontSize: 14, lineHeight: 20 },
  muted: { color: '#A4CDD3', fontSize: 13, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  action: { color: '#FED8FE', fontWeight: '700' },
});
