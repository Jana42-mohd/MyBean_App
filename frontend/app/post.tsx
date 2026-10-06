import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionSheet } from '@/components/ActionSheet';
import { Avatar } from '@/components/Avatar';
import { LoadError, friendlyError } from '@/components/LoadError';
import { PostMedia } from '@/components/PostMedia';
import { ThemedView } from '@/components/themed-view';
import {
  COMMENT_MAX, COMMENT_REPORT_REASONS, CommentRow, CommentSort, FlatComment, addComment, buildThread, deleteComment, fetchComments, flattenThread,
  reportComment, setCommentLike,
} from '@/lib/comments';
import { PostFile, deletePostWithMedia, fetchPostMedia, mediaUrls } from '@/lib/postMediaStore';
import { supabase } from '@/lib/supabase';
import { Palette, useStyles, useTheme } from '@/lib/theme';
import { timeAgo } from '@/lib/time';

interface PostRow {
  id: string;
  user_id: string;
  title: string;
  excerpt: string;
  author: string;
  tags: string[];
  likes_count: number;
  saves_count: number;
  comments_count: number;
  created_at: string;
}

const SORTS: { key: CommentSort; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'new', label: 'Newest' },
  { key: 'old', label: 'Oldest' },
];

export default function PostScreen() {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [me, setMe] = useState('');
  const [post, setPost] = useState<PostRow | null>(null);
  const [gone, setGone] = useState(false);
  const [files, setFiles] = useState<PostFile[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [sort, setSort] = useState<CommentSort>('top');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState<{ kind: 'post' } | { kind: 'comment'; row: CommentRow } | null>(null);
  const [reporting, setReporting] = useState<{ kind: 'post' } | { kind: 'comment'; id: string } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError('');
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id ?? '';
      setMe(uid);
      const [feed, likes, saves, list] = await Promise.all([
        supabase.from('posts_feed').select('*').eq('id', id).maybeSingle(),
        supabase.from('post_likes').select('post_id').eq('post_id', id).eq('user_id', uid),
        supabase.from('post_saves').select('post_id').eq('post_id', id).eq('user_id', uid),
        fetchComments(id).catch(() => null),
      ]);
      if (feed.error) throw feed.error;
      if (!feed.data) { setGone(true); return; }
      setPost(feed.data as PostRow);
      setLiked((likes.data ?? []).length > 0);
      setSaved((saves.data ?? []).length > 0);
      if (list) setComments(list);
      fetchPostMedia([id]).then(async m => {
        setFiles(m[id] ?? []);
        setUrls(await mediaUrls((m[id] ?? []).map(f => f.path)));
      }).catch(() => {});
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const reloadComments = async () => {
    try {
      setComments(await fetchComments(id!));
      const { data } = await supabase.from('posts_feed').select('comments_count').eq('id', id!).maybeSingle();
      if (data) setPost(p => (p ? { ...p, comments_count: (data as any).comments_count } : p));
    } catch (e) {
      Alert.alert('Could not refresh', friendlyError(e));
    }
  };

  const thread = useMemo(() => buildThread(comments, sort), [comments, sort]);
  const flat = useMemo(() => flattenThread(thread, collapsed), [thread, collapsed]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await addComment(id!, replyTo?.id ?? null, text);
      setText('');
      setReplyTo(null);
      await reloadComments();
    } catch (e) {
      Alert.alert('Could not post your comment', friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  const toggleLike = async (c: CommentRow) => {
    const on = !c.liked;
    setComments(prev => prev.map(x => (x.id === c.id ? { ...x, liked: on, likes: x.likes + (on ? 1 : -1) } : x)));
    try {
      await setCommentLike(c.id, on);
    } catch (e) {
      setComments(prev => prev.map(x => (x.id === c.id ? { ...x, liked: !on, likes: x.likes + (on ? -1 : 1) } : x)));
      Alert.alert('Could not like this', friendlyError(e));
    }
  };

  const togglePostLike = async () => {
    if (!post) return;
    const on = !liked;
    setLiked(on);
    setPost({ ...post, likes_count: post.likes_count + (on ? 1 : -1) });
    const { error: err } = on
      ? await supabase.from('post_likes').insert({ post_id: post.id, user_id: me })
      : await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', me);
    if (err && err.code !== '23505') {
      setLiked(!on);
      setPost(p => (p ? { ...p, likes_count: p.likes_count + (on ? -1 : 1) } : p));
    }
  };

  const togglePostSave = async () => {
    if (!post) return;
    const on = !saved;
    setSaved(on);
    setPost({ ...post, saves_count: post.saves_count + (on ? 1 : -1) });
    const { error: err } = on
      ? await supabase.from('post_saves').insert({ post_id: post.id, user_id: me })
      : await supabase.from('post_saves').delete().eq('post_id', post.id).eq('user_id', me);
    if (err && err.code !== '23505') {
      setSaved(!on);
      setPost(p => (p ? { ...p, saves_count: p.saves_count + (on ? -1 : 1) } : p));
    }
  };

  const removeComment = (c: CommentRow) =>
    Alert.alert('Delete your comment?', 'If people replied to it, the replies stay under "[deleted]".', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteComment(c.id).then(reloadComments).catch(e => Alert.alert('Could not delete', friendlyError(e))) },
    ]);

  const removePost = () =>
    Alert.alert('Delete your post?', 'This permanently removes it, with its comments, likes and saves.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePostWithMedia(id!).then(() => router.back()).catch(e => Alert.alert('Could not delete', friendlyError(e))) },
    ]);

  const sendReport = async (reason: string) => {
    const target = reporting;
    setReporting(null);
    try {
      if (target?.kind === 'comment') await reportComment(target.id, reason);
      else {
        const { error: err } = await supabase.from('post_reports').insert({ post_id: id!, reason });
        if (err && err.code !== '23505') throw err;
      }
      Alert.alert('Thanks for letting us know', 'Our moderators will review it. If several people report it, it is hidden automatically.');
      if (target?.kind === 'post') router.back();
      else reloadComments();
    } catch (e) {
      Alert.alert('Could not send the report', friendlyError(e));
    }
  };

  const Header = (
    <View>
      <Pressable onPress={() => router.back()} hitSlop={10}><Text style={styles.back}>← Back</Text></Pressable>
      {error ? <LoadError message={error} onRetry={load} /> : null}
      {gone ? <LoadError message="This post is no longer available." /> : null}
      {post ? (
        <View style={styles.postCard}>
          <View style={styles.postTop}>
            <Text style={styles.postTitle}>{post.title}</Text>
            <Pressable onPress={() => setMenu({ kind: 'post' })} hitSlop={10} accessibilityLabel="More options"><MaterialCommunityIcons name="dots-horizontal" size={24} color={colors.muted} /></Pressable>
          </View>
          <Text style={styles.meta}>by {post.author} · {timeAgo(post.created_at)}</Text>
          <Text style={styles.excerpt}>{post.excerpt}</Text>
          <PostMedia items={files} urls={urls} />
          <View style={styles.tags}>
            {(post.tags ?? []).map(t => <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>)}
          </View>
          <View style={styles.actions}>
            <Pressable style={[styles.action, liked && styles.actionOn]} onPress={togglePostLike}><Text style={[styles.actionText, liked && styles.actionTextOn]}>{liked ? 'Liked' : 'Like'} ({post.likes_count})</Text></Pressable>
            <Pressable style={[styles.action, saved && styles.actionOn]} onPress={togglePostSave}><Text style={[styles.actionText, saved && styles.actionTextOn]}>{saved ? 'Saved' : 'Save'} ({post.saves_count})</Text></Pressable>
          </View>
        </View>
      ) : null}
      {post ? (
        <View style={styles.commentsHeader}>
          <Text style={styles.commentsTitle}>{post.comments_count} {post.comments_count === 1 ? 'comment' : 'comments'}</Text>
          <View style={styles.sorts}>
            {SORTS.map(s => (
              <Pressable key={s.key} onPress={() => setSort(s.key)} style={[styles.sort, sort === s.key && styles.sortOn]}>
                <Text style={[styles.sortText, sort === s.key && styles.sortTextOn]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderItem = ({ item }: { item: FlatComment }) => {
    const c = item.row;
    return (
      <View style={[styles.comment, { marginLeft: item.indent * 14 }, item.indent > 0 && styles.reply]}>
        <Pressable onPress={() => item.replies > 0 && setCollapsed(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} style={styles.cHead}>
          {c.deleted ? <View style={styles.ghost} /> : <Avatar name={c.author ?? '?'} url={c.avatar_url} size={24} />}
          <Text style={styles.cAuthor} numberOfLines={1}>{c.deleted ? 'deleted' : c.author}{c.mine ? ' (you)' : ''}</Text>
          <Text style={styles.cTime}>{timeAgo(c.created_at)}</Text>
          {item.collapsed ? <Text style={styles.cTime}>· {item.replies} hidden</Text> : null}
        </Pressable>
        {!item.collapsed ? (
          <>
            {c.hidden ? <Text style={styles.hiddenNote}>Hidden after reports. Only you and the moderators can see this.</Text> : null}
            <Text style={[styles.cBody, c.deleted && styles.cDeleted]}>{c.body}</Text>
            {!c.deleted ? (
              <View style={styles.cActions}>
                <Pressable onPress={() => toggleLike(c)} hitSlop={8} style={styles.cAction}>
                  <MaterialCommunityIcons name={c.liked ? 'heart' : 'heart-outline'} size={16} color={c.liked ? colors.accentText : colors.muted} />
                  <Text style={[styles.cActionText, c.liked && { color: colors.accentText }]}>{c.likes > 0 ? c.likes : 'Like'}</Text>
                </Pressable>
                <Pressable onPress={() => setReplyTo(c)} hitSlop={8} style={styles.cAction}><MaterialCommunityIcons name="reply-outline" size={16} color={colors.muted} /><Text style={styles.cActionText}>Reply</Text></Pressable>
                <Pressable onPress={() => setMenu({ kind: 'comment', row: c })} hitSlop={8}><MaterialCommunityIcons name="dots-horizontal" size={18} color={colors.muted} /></Pressable>
              </View>
            ) : null}
          </>
        ) : null}
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          data={post ? flat : []}
          keyExtractor={f => f.row.id}
          renderItem={renderItem}
          ListHeaderComponent={Header}
          ListEmptyComponent={post ? <Text style={styles.empty}>No comments yet. Start the conversation!</Text> : null}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        />
        {post ? (
          <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
            {replyTo ? (
              <View style={styles.replying}>
                <Text style={styles.replyingText} numberOfLines={1}>Replying to {replyTo.author}</Text>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={8}><MaterialCommunityIcons name="close" size={16} color={colors.muted} /></Pressable>
              </View>
            ) : null}
            <View style={styles.inputRow}>
              <TextInput style={styles.input} value={text} onChangeText={setText} placeholder={replyTo ? 'Write a reply' : 'Add a comment'} placeholderTextColor={colors.muted} multiline maxLength={COMMENT_MAX} />
              <Pressable style={[styles.send, (!text.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!text.trim() || sending}>
                <Text style={styles.sendText}>{sending ? '...' : 'Post'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ActionSheet
        visible={!!menu}
        onClose={() => setMenu(null)}
        items={
          menu?.kind === 'comment'
            ? menu.row.mine
              ? [{ label: 'Delete my comment', onPress: () => removeComment(menu.row), destructive: true }]
              : [{ label: 'Report this comment', onPress: () => setReporting({ kind: 'comment', id: menu.row.id }) }]
            : post?.user_id === me
              ? [{ label: 'Delete my post', onPress: removePost, destructive: true }]
              : [{ label: 'Report this post', onPress: () => setReporting({ kind: 'post' }) }]
        }
      />
      <ActionSheet
        visible={!!reporting}
        onClose={() => setReporting(null)}
        title={reporting?.kind === 'comment' ? 'Report this comment' : 'Report this post'}
        items={COMMENT_REPORT_REASONS.map(r => ({ label: r.charAt(0).toUpperCase() + r.slice(1), onPress: () => sendReport(r) }))}
      />
    </ThemedView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  back: { color: colors.muted, marginBottom: 12, fontSize: 14 },
  postCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 18 },
  postTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  postTitle: { color: colors.heading, fontSize: 20, fontWeight: '700', lineHeight: 27, flex: 1 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  excerpt: { color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: { backgroundColor: colors.accentWash, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: colors.accentText, fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  action: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  actionOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  actionTextOn: { color: colors.onAccent },
  commentsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' },
  commentsTitle: { color: colors.heading, fontSize: 17, fontWeight: '700' },
  sorts: { flexDirection: 'row', gap: 6 },
  sort: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  sortOn: { backgroundColor: colors.highlight, borderColor: colors.highlight },
  sortText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  sortTextOn: { color: colors.onAccent },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  comment: { paddingVertical: 10 },
  reply: { borderLeftWidth: 2, borderLeftColor: colors.line, paddingLeft: 10 },
  cHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghost: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.line },
  cAuthor: { color: colors.text, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  cTime: { color: colors.muted, fontSize: 12 },
  cBody: { color: colors.text, fontSize: 15, lineHeight: 21, marginTop: 4 },
  cDeleted: { color: colors.muted, fontStyle: 'italic' },
  hiddenNote: { color: colors.danger, fontSize: 12, marginTop: 4 },
  cActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 },
  cAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cActionText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  composer: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 12, paddingTop: 8 },
  replying: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 6 },
  replyingText: { color: colors.muted, fontSize: 12, flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, color: colors.text, backgroundColor: colors.bg },
  send: { backgroundColor: colors.accent, borderRadius: 18, paddingVertical: 11, paddingHorizontal: 16 },
  sendText: { color: colors.onAccent, fontWeight: '700' },
});
