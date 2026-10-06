import { StyleSheet, ScrollView, Text, View, Pressable, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { incomingRequestCount } from '@/lib/neighbors';
import { myGroups } from '@/lib/groups';
import { supabase } from '@/lib/supabase';
import { LoadError, friendlyError } from '@/components/LoadError';
import { Image } from 'expo-image';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { PostMedia } from '@/components/PostMedia';
import { MAX_VIDEO_SECONDS, pickPostMedia } from '@/lib/postMedia';
import { LocalMedia, MAX_FILES, PostFile, createPostWithMedia, deletePostWithMedia, fetchPostMedia, mediaUrls } from '@/lib/postMediaStore';
import { Palette, useStyles, useTheme } from '@/lib/theme';

interface Post {
  id: string;
  user_id?: string;
  title: string;
  excerpt: string;
  author: string;
  tags: string[];
  likes_count: number;
  saves_count: number;
  created_at: string;
  local?: boolean;
}

const topicTags = ['Sleep', 'Feeding', 'Breastfeeding', 'Milestones', 'Health', 'Development', 'Mental Health'];

export default function CommunityScreen() {
  const colors = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [myId, setMyId] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reporting, setReporting] = useState<Post | null>(null);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [postsLoading, setPostsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userLikes, setUserLikes] = useState<string[]>([]);
  const [userSaves, setUserSaves] = useState<string[]>([]);
  const [interactionLoading, setInteractionLoading] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'all' | 'liked' | 'saved'>('all');
  const router = useRouter();
  const [requests, setRequests] = useState(0);
  const [media, setMedia] = useState<LocalMedia[]>([]);          // chosen for the post being written
  const [mediaOf, setMediaOf] = useState<Record<string, PostFile[]>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState('');

  const loadPosts = useCallback(async () => {
    try {
      setPostsLoading(true);
      setLoadError('');
      const { data: u } = await supabase.auth.getUser();
      const [feed, likes, saves] = await Promise.all([
        supabase.from('posts_feed').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('post_likes').select('post_id').eq('user_id', u.user?.id ?? ''),
        supabase.from('post_saves').select('post_id').eq('user_id', u.user?.id ?? ''),
      ]);
      if (feed.error) throw feed.error;
      const list = (feed.data ?? []) as Post[];
      setPosts(list);
      // photos and videos load after the text so the feed appears right away
      fetchPostMedia(list.map(p => p.id))
        .then(async m => {
          setMediaOf(m);
          setUrls(await mediaUrls(Object.values(m).flat().map(f => f.path)));
        })
        .catch(() => {});
      setUserLikes((likes.data ?? []).map((r: any) => r.post_id));
      setUserSaves((saves.data ?? []).map((r: any) => r.post_id));
    } catch (error) {
      console.error('Error loading posts:', error);
      setLoadError(friendlyError(error));
    } finally {
      setPostsLoading(false);
    }
  }, []);

  // Load (and refresh) whenever the Community tab is opened
  useFocusEffect(
    useCallback(() => {
      Promise.all([incomingRequestCount(), myGroups()]).then(([n, g]) => setRequests(n + g.filter(x => x.status === 'invited').length)).catch(() => setRequests(0));
      (async () => {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          setMyId(u.user.id);
          const { data: prof } = await supabase.from('profiles').select('name').eq('id', u.user.id).maybeSingle();
          setUserName(prof?.name || 'Anonymous');
        }
        await loadPosts();
      })();
    }, [loadPosts])
  );

  const handleCreatePost = async () => {
    if (!title.trim() || !excerpt.trim()) {
      Alert.alert('Missing Fields', 'Please enter both a title and description');
      return;
    }
    if (selectedTags.length === 0) {
      Alert.alert('Select Tags', 'Please select at least one topic tag');
      return;
    }
    try {
      setLoading(true);
      setProgress('');
      await createPostWithMedia(
        { title: title.trim(), excerpt: excerpt.trim(), tags: selectedTags.map(t => t.toLowerCase()) },
        media,
        (done, total) => setProgress(done < total ? `Uploading ${done + 1} of ${total}...` : 'Publishing...'),
      );
      setMedia([]);
      setTitle('');
      setExcerpt('');
      setSelectedTags([]);
      setIsModalVisible(false);
      await loadPosts();
      Alert.alert('Success', 'Your post has been published!');
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Could not publish', media.length ? `${friendlyError(error)}\n\nYour photos and videos were not posted. Check your connection and try again.` : 'Failed to create post. Please try again.');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const addMedia = async (source: 'library' | 'camera') => {
    try {
      const more = await pickPostMedia(source, media);
      if (more.length) setMedia(prev => [...prev, ...more]);
    } catch (e) {
      Alert.alert('Could not add that', friendlyError(e));
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      setInteractionLoading(postId);
      const on = !userLikes.includes(postId);
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error('Not signed in');
      const { error } = on
        ? await supabase.from('post_likes').insert({ post_id: postId, user_id: uid })
        : await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', uid);
      if (error) throw error;
      setUserLikes(on ? [...userLikes, postId] : userLikes.filter(id => id !== postId));
      setPosts(posts.map(p => (p.id === postId ? { ...p, likes_count: p.likes_count + (on ? 1 : -1) } : p)));
    } catch (error) {
      console.error('Error updating like:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setInteractionLoading(null);
    }
  };

  const handleSavePost = async (postId: string) => {
    try {
      setInteractionLoading(postId);
      const on = !userSaves.includes(postId);
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error('Not signed in');
      const { error } = on
        ? await supabase.from('post_saves').insert({ post_id: postId, user_id: uid })
        : await supabase.from('post_saves').delete().eq('post_id', postId).eq('user_id', uid);
      if (error) throw error;
      setUserSaves(on ? [...userSaves, postId] : userSaves.filter(id => id !== postId));
      setPosts(posts.map(p => (p.id === postId ? { ...p, saves_count: p.saves_count + (on ? 1 : -1) } : p)));
    } catch (error) {
      console.error('Error updating save:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setInteractionLoading(null);
    }
  };

  const REPORT_REASONS = ['spam', 'harassment', 'medical misinformation', 'inappropriate', 'other'];

  const submitReport = async (reason: string) => {
    if (!reporting) return;
    const post = reporting;
    setReporting(null);
    const { error } = await supabase.from('post_reports').insert({ post_id: post.id, reason });
    if (error && error.code !== '23505') {
      Alert.alert('Could not send report', friendlyError(error));
      return;
    }
    // Hide it for the reporter right away
    setPosts(prev => prev.filter(p => p.id !== post.id));
    Alert.alert('Thanks for letting us know', 'Our moderators will review this post. If several people report it, it is hidden automatically.');
  };

  const blockAuthor = (post: Post) => {
    setReporting(null);
    if (!post.user_id) return;
    Alert.alert(`Block ${post.author}?`, 'You will no longer see their posts. You can unblock them any time in Settings.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('user_blocks').insert({ blocked_id: post.user_id });
          if (error && error.code !== '23505') {
            Alert.alert('Could not block', friendlyError(error));
            return;
          }
          setPosts(prev => prev.filter(p => p.user_id !== post.user_id));
        },
      },
    ]);
  };

  const confirmDeletePost = (post: Post) => {
    Alert.alert('Delete your post?', 'This permanently removes it, including its likes and saves.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePostWithMedia(post.id);
            setPosts(prev => prev.filter(p => p.id !== post.id));
          } catch (error) {
            Alert.alert('Could not delete', friendlyError(error));
          }
        },
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Community Board</ThemedText>
        <Text style={styles.subtitle}>Ask questions, share stories, and support each other.</Text>

        <Pressable style={styles.neighborsCard} onPress={() => router.push('/neighbors')}>
          <View style={{ flex: 1 }}>
            <Text style={styles.neighborsTitle}>Parents near you</Text>
            <Text style={styles.neighborsText}>Meet parents in your neighbourhood, city or country.</Text>
          </View>
          {requests > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{requests}</Text></View> : null}
          <Text style={styles.neighborsChevron}>›</Text>
        </Pressable>

        <Pressable 
          style={styles.primaryButton}
          onPress={() => setIsModalVisible(true)}
        >
          <Text style={styles.primaryButtonText}>Start a new post</Text>
        </Pressable>

        {/* View Mode Buttons */}
        <View style={styles.viewModeContainer}>
          <Pressable 
            style={[styles.viewModeButton, viewMode === 'all' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('all')}
          >
            <Text style={[styles.viewModeButtonText, viewMode === 'all' && styles.viewModeButtonTextActive]}>
              All Posts
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.viewModeButton, viewMode === 'liked' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('liked')}
          >
            <Text style={[styles.viewModeButtonText, viewMode === 'liked' && styles.viewModeButtonTextActive]}>
              Liked ({userLikes.length})
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.viewModeButton, viewMode === 'saved' && styles.viewModeButtonActive]}
            onPress={() => setViewMode('saved')}
          >
            <Text style={[styles.viewModeButtonText, viewMode === 'saved' && styles.viewModeButtonTextActive]}>
              Saved ({userSaves.length})
            </Text>
          </Pressable>
        </View>

        {/* Topic Tags */}
        <View style={styles.tagsContainer}>
          <Text style={styles.tagsLabel}>Topics</Text>
          <View style={styles.tagsGrid}>
            {topicTags.map(tag => (
              <Pressable key={tag} style={styles.tagButton}>
                <Text style={styles.tagText}>{tag}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Posts List */}
        {loadError ? <LoadError message={loadError} onRetry={loadPosts} /> : null}
        {postsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentText} />
            <Text style={styles.loadingText}>Loading posts...</Text>
          </View>
        ) : (() => {
          const filteredPosts = viewMode === 'liked' 
            ? posts.filter(p => userLikes.includes(p.id))
            : viewMode === 'saved'
            ? posts.filter(p => userSaves.includes(p.id))
            : posts;

          return filteredPosts.length > 0 ? (
            <View style={styles.list}>
              {filteredPosts.map(post => (
                <View key={post.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Text style={styles.postTitle}>{post.title}</Text>
                </View>
                <Text style={styles.postMeta}>
                  by {post.author} · {formatDate(post.created_at)}
                </Text>
                <Text style={styles.postExcerpt}>{post.excerpt}</Text>
                <PostMedia items={mediaOf[post.id] ?? []} urls={urls} />
                
                <View style={styles.postTags}>
                  {post.tags && post.tags.map((tag: string) => (
                    <View key={tag} style={styles.postTag}>
                      <Text style={styles.postTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.postActions}>
                  <Pressable
                    style={[
                      styles.actionButton,
                      userLikes.includes(post.id) && styles.actionButtonActive,
                    ]}
                    onPress={() => handleLikePost(post.id)}
                    disabled={interactionLoading === post.id}
                  >
                    <Text style={[
                      styles.actionButtonText,
                      userLikes.includes(post.id) && styles.actionButtonTextActive,
                    ]}>
                      {userLikes.includes(post.id) ? 'Liked' : 'Like'} ({post.likes_count})
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.actionButton,
                      userSaves.includes(post.id) && styles.actionButtonActive,
                    ]}
                    onPress={() => handleSavePost(post.id)}
                    disabled={interactionLoading === post.id}
                  >
                    <Text style={[
                      styles.actionButtonText,
                      userSaves.includes(post.id) && styles.actionButtonTextActive,
                    ]}>
                      {userSaves.includes(post.id) ? 'Saved' : 'Save'} ({post.saves_count})
                    </Text>
                  </Pressable>

                  {post.user_id === myId ? (
                    <Pressable style={styles.actionButton} onPress={() => confirmDeletePost(post)}>
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.actionButton} onPress={() => setReporting(post)}>
                      <Text style={styles.actionButtonText}>Report</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {viewMode === 'liked' ? 'No liked posts yet' : viewMode === 'saved' ? 'No saved posts yet' : 'No posts yet. Be the first to share!'}
              </Text>
            </View>
          );
        })()}
      </ScrollView>

      {/* Create Post Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setIsModalVisible(false)}>
                <Text style={styles.modalCloseButton}>Close</Text>
              </Pressable>
              <ThemedText style={styles.modalTitle}>New Post</ThemedText>
              <Pressable 
                onPress={handleCreatePost}
                disabled={loading}
              >
                <Text style={[styles.modalPublishButton, loading && styles.disabled]}>
                  {loading ? progress || 'Publishing...' : 'Publish'}
                </Text>
              </Pressable>
            </View>

            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 14 }}>
              Be kind and respectful. No spam or harassment. Share experiences, not medical advice: for health concerns, talk to your doctor. Posts can be reported and removed.
            </Text>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.muted}
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
              <Text style={styles.characterCount}>{title.length}/100</Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Share your experience, ask for advice, or offer support..."
                placeholderTextColor={colors.muted}
                value={excerpt}
                onChangeText={setExcerpt}
                maxLength={500}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>{excerpt.length}/500</Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Photos and videos (optional)</Text>
              {media.length > 0 ? (
                <View style={styles.mediaRow}>
                  {media.map((m, i) => (
                    <View key={m.uri + i} style={styles.thumb}>
                      {m.kind === 'image' ? (
                        <Image source={{ uri: m.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                      ) : (
                        <View style={styles.videoThumb}>
                          <MaterialCommunityIcons name="play-circle-outline" size={30} color={colors.accentText} />
                          {m.duration ? <Text style={styles.videoLen}>{Math.round(m.duration)}s</Text> : null}
                        </View>
                      )}
                      <Pressable style={styles.thumbRemove} onPress={() => setMedia(prev => prev.filter((_, j) => j !== i))} hitSlop={6} accessibilityLabel="Remove this file">
                        <MaterialCommunityIcons name="close" size={14} color={colors.onAccent} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.mediaButtons}>
                <Pressable style={[styles.mediaBtn, media.length >= MAX_FILES && { opacity: 0.4 }]} onPress={() => addMedia('library')} disabled={media.length >= MAX_FILES}>
                  <MaterialCommunityIcons name="image-multiple-outline" size={18} color={colors.link} />
                  <Text style={styles.mediaBtnText}>Photos or video</Text>
                </Pressable>
                <Pressable style={[styles.mediaBtn, media.length >= MAX_FILES && { opacity: 0.4 }]} onPress={() => addMedia('camera')} disabled={media.length >= MAX_FILES}>
                  <MaterialCommunityIcons name="camera-outline" size={18} color={colors.link} />
                  <Text style={styles.mediaBtnText}>Camera</Text>
                </Pressable>
              </View>
              <Text style={styles.selectedTagsInfo}>
                Up to {MAX_FILES} files ({media.length} added), one video of up to {MAX_VIDEO_SECONDS} seconds. Everyone in the community can see your post, so please leave out your address and other people's children.
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Select Topics</Text>
              <View style={styles.tagSelectionGrid}>
                {topicTags.map(tag => (
                  <Pressable
                    key={tag}
                    style={[
                      styles.tagSelectionButton,
                      selectedTags.includes(tag) && styles.tagSelectionButtonActive,
                    ]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text
                      style={[
                        styles.tagSelectionText,
                        selectedTags.includes(tag) && styles.tagSelectionTextActive,
                      ]}
                    >
                      {tag}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.selectedTagsInfo}>
                {selectedTags.length} topic{selectedTags.length !== 1 ? 's' : ''} selected
              </Text>
            </View>

            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.accentText} />
              </View>
            )}
          </ScrollView>
        </ThemedView>
      </Modal>
      <Modal visible={!!reporting} transparent animationType="fade" onRequestClose={() => setReporting(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.heading, fontSize: 18, fontWeight: '700', marginBottom: 4 }}>Report this post</Text>
            <Text style={{ color: colors.muted, marginBottom: 12 }}>What&apos;s wrong with it?</Text>
            {REPORT_REASONS.map(r => (
              <Pressable key={r} onPress={() => submitReport(r)} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 15, textTransform: 'capitalize' }}>{r}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => reporting && blockAuthor(reporting)} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ color: colors.danger, fontSize: 15 }}>Block {reporting?.author ?? 'this member'}</Text>
            </Pressable>
            <Pressable onPress={() => setReporting(null)} style={{ paddingTop: 12 }}>
              <Text style={{ color: colors.muted, textAlign: 'center' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 24,
    color: colors.heading,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
  },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  thumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  videoThumb: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  videoLen: { color: colors.muted, fontSize: 11 },
  thumbRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  mediaButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  mediaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
  mediaBtnText: { color: colors.text, fontSize: 13 },
  neighborsCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  neighborsTitle: { color: colors.accentText, fontSize: 16, fontWeight: '700', lineHeight: 22 },
  neighborsText: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  neighborsChevron: { color: colors.muted, fontSize: 24 },
  badge: { backgroundColor: colors.accent, borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.onAccent, fontSize: 12, fontWeight: '700' },
  primaryButton: {
    marginTop: 6,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  primaryButtonText: {
    color: colors.onAccent,
    fontWeight: '700',
    fontSize: 16,
  },
  viewModeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 16,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: colors.highlight,
    borderColor: colors.link,
  },
  viewModeButtonText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  viewModeButtonTextActive: {
    color: colors.onAccent,
  },
  tagsContainer: {
    gap: 10,
  },
  tagsLabel: {
    fontSize: 14,
    color: colors.link,
    fontWeight: '600',
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagButton: {
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.link,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    color: colors.link,
    fontWeight: '600',
  },
  list: {
    gap: 12,
  },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  postHeader: {
    gap: 4,
  },
  postTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
  },
  postMeta: {
    fontSize: 12,
    color: colors.muted,
  },
  postExcerpt: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  statText: {
    fontSize: 12,
    color: colors.link,
    fontWeight: '600',
  },
  postTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  postTag: {
    backgroundColor: colors.accentWash,
    borderWidth: 0.5,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  postTagText: {
    fontSize: 11,
    color: colors.accentText,
    fontWeight: '600',
  },
  postActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.wash,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButtonActive: {
    backgroundColor: colors.wash,
    borderColor: colors.link,
  },
  actionButtonText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  actionButtonTextActive: {
    color: colors.link,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    textAlign: 'center',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingVertical: 24,
    paddingBottom: 40,
    gap: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  modalCloseButton: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 20,
    color: colors.heading,
    fontWeight: '700',
  },
  modalPublishButton: {
    color: colors.link,
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  formSection: {
    gap: 8,
  },
  formLabel: {
    fontSize: 14,
    color: colors.link,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  characterCount: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'right',
  },
  tagSelectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagSelectionButton: {
    backgroundColor: colors.wash,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagSelectionButtonActive: {
    backgroundColor: colors.highlight,
    borderColor: colors.link,
  },
  tagSelectionText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  tagSelectionTextActive: {
    color: colors.onAccent,
  },
  selectedTagsInfo: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
