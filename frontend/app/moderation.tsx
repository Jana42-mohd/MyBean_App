import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { LoadError, friendlyError } from '@/components/LoadError';
import { supabase } from '@/lib/supabase';
import { PostMedia } from '@/components/PostMedia';
import { PostFile, deletePostWithMedia, fetchPostMedia, mediaUrls } from '@/lib/postMediaStore';
import { Palette, useStyles, useTheme } from '@/lib/theme';

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
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [posts, setPosts] = useState<ReportedPost[]>([]);
  const [error, setError] = useState('');
  const [mediaOf, setMediaOf] = useState<Record<string, PostFile[]>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [commentReports, setCommentReports] = useState<{ id: string; body: string; hidden: boolean; user_id: string | null; author: string; reasons: string[]; count: number }[]>([]);
  const [reports, setReports] = useState<{ id: string; reported: string; reason: string; details: string | null; message_excerpt: string | null; name: string }[]>([]);
  const [suspended, setSuspended] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase
      .from('posts')
      .select('id,user_id,title,excerpt,hidden,post_reports!inner(reason,details)')
      .order('created_at', { ascending: false });
    if (err) setError(friendlyError(err));
    else {
      setPosts((data ?? []) as any);
      fetchPostMedia(((data ?? []) as any[]).map(p => p.id))
        .then(async m => { setMediaOf(m); setUrls(await mediaUrls(Object.values(m).flat().map(f => f.path))); })
        .catch(() => {});
    }
    const { data: cr } = await supabase
      .from('comment_reports')
      .select('comment_id,reason,post_comments!inner(id,body,hidden,user_id)');
    const grouped = new Map<string, any>();
    for (const r of (cr ?? []) as any[]) {
      const g = grouped.get(r.comment_id) ?? { id: r.comment_id, body: r.post_comments.body, hidden: r.post_comments.hidden, user_id: r.post_comments.user_id, reasons: [], count: 0 };
      g.reasons.push(r.reason);
      g.count++;
      grouped.set(r.comment_id, g);
    }
    const authorIds = [...new Set([...grouped.values()].map(g => g.user_id).filter(Boolean))];
    const { data: authors } = authorIds.length ? await supabase.from('profiles').select('id,name').in('id', authorIds) : { data: [] as any[] };
    setCommentReports([...grouped.values()].map(g => ({ ...g, author: (authors ?? []).find((a: any) => a.id === g.user_id)?.name ?? 'Parent' })));
    const { data: ur } = await supabase
      .from('user_reports')
      .select('id,reported,reason,details,message_excerpt,created_at,who:profiles!user_reports_reported_fkey(name)')
      .order('created_at', { ascending: false });
    setReports(((ur ?? []) as any[]).map(r => ({ ...r, name: r.who?.name ?? 'Parent' })));
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

  const clearReports = (userId: string, name: string) =>
    Alert.alert(`Clear reports about ${name}?`, 'They go back in the "Parents near you" lists (if they chose to be visible) and the reports are closed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        onPress: async () => {
          const { error: err } = await supabase.rpc('clear_discovery_block', { target: userId });
          if (err) Alert.alert('Error', friendlyError(err));
          load();
        },
      },
    ]);

  const keepComment = async (id: string) => {
    // Clear the reports so the comment is not hidden again by the next single report, then show it
    const r1 = await supabase.from('comment_reports').delete().eq('comment_id', id);
    const r2 = await supabase.from('post_comments').update({ hidden: false }).eq('id', id);
    if (r1.error || r2.error) Alert.alert('Error', friendlyError(r1.error || r2.error));
    load();
  };

  const removeComment = (id: string) =>
    Alert.alert('Delete comment?', 'This removes the comment (replies stay under "[deleted]").', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: err } = await supabase.rpc('delete_comment', { c: id });
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
          try {
            await deletePostWithMedia(id);
          } catch (err) {
            Alert.alert('Error', friendlyError(err));
          }
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
            <PostMedia items={mediaOf[p.id] ?? []} urls={urls} />
            <Text style={styles.muted}>Reasons: {p.post_reports.map(r => r.reason).join(', ')}</Text>
            <View style={styles.row}>
              <Pressable onPress={() => restore(p.id)}><Text style={styles.action}>Keep (clear reports)</Text></Pressable>
              <Pressable onPress={() => setSuspension(p.user_id, true)}><Text style={[styles.action, { color: colors.danger }]}>Suspend author</Text></Pressable>
              <Pressable onPress={() => remove(p.id)}><Text style={[styles.action, { color: colors.danger }]}>Delete</Text></Pressable>
            </View>
          </View>
        ))}
        {commentReports.length > 0 ? (
          <>
            <ThemedText style={[styles.title, { fontSize: 20, marginTop: 10 }]}>Reported comments</ThemedText>
            {commentReports.map(c => (
              <View key={c.id} style={styles.card}>
                <Text style={styles.status}>{c.hidden ? 'HIDDEN' : 'Visible'} · {c.count} report(s)</Text>
                <Text style={styles.postTitle}>{c.author}</Text>
                <Text style={styles.body}>{c.body}</Text>
                <Text style={styles.muted}>Reasons: {c.reasons.join(', ')}</Text>
                <View style={styles.row}>
                  <Pressable onPress={() => keepComment(c.id)}><Text style={styles.action}>Keep (clear reports)</Text></Pressable>
                  {c.user_id ? <Pressable onPress={() => setSuspension(c.user_id!, true)}><Text style={[styles.action, { color: colors.danger }]}>Suspend author</Text></Pressable> : null}
                  <Pressable onPress={() => removeComment(c.id)}><Text style={[styles.action, { color: colors.danger }]}>Delete</Text></Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}
        {reports.length > 0 ? (
          <>
            <ThemedText style={[styles.title, { fontSize: 20, marginTop: 10 }]}>Reported parents</ThemedText>
            {reports.map(r => (
              <View key={r.id} style={styles.card}>
                <Text style={styles.status}>{r.reason.toUpperCase()}</Text>
                <Text style={styles.postTitle}>{r.name}</Text>
                {r.details ? <Text style={styles.body}>{r.details}</Text> : null}
                {r.message_excerpt ? <Text style={[styles.body, { fontStyle: 'italic', marginTop: 6 }]}>Message: "{r.message_excerpt}"</Text> : null}
                <View style={styles.row}>
                  <Pressable onPress={() => clearReports(r.reported, r.name)}><Text style={styles.action}>Clear reports</Text></Pressable>
                  <Pressable onPress={() => setSuspension(r.reported, true)}><Text style={[styles.action, { color: colors.danger }]}>Suspend</Text></Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}
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

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 40 },
  back: { color: colors.muted, marginBottom: 12 },
  title: { fontSize: 24, color: colors.heading, fontWeight: '700', marginBottom: 16 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 14 },
  status: { color: colors.link, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  postTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.muted, fontSize: 13, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  action: { color: colors.accentText, fontWeight: '700' },
});
