import { StyleSheet, ScrollView, Text, View, Pressable, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LoadError, friendlyError } from '@/components/LoadError';

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

  useEffect(() => {
    const init = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        setMyId(u.user.id);
        const { data: prof } = await supabase.from('profiles').select('name').eq('id', u.user.id).maybeSingle();
        setUserName(prof?.name || 'Anonymous');
      }
      await loadPosts();
    };
    init();
  }, []);

  const loadPosts = async () => {
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
      setPosts((feed.data ?? []) as Post[]);
      setUserLikes((likes.data ?? []).map((r: any) => r.post_id));
      setUserSaves((saves.data ?? []).map((r: any) => r.post_id));
    } catch (error) {
      console.error('Error loading posts:', error);
      setLoadError(friendlyError(error));
    } finally {
      setPostsLoading(false);
    }
  };

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
      const { error } = await supabase.from('posts').insert({
        title: title.trim(),
        excerpt: excerpt.trim(),
        tags: selectedTags.map(t => t.toLowerCase()),
      });
      if (error) throw error;
      setTitle('');
      setExcerpt('');
      setSelectedTags([]);
      setIsModalVisible(false);
      await loadPosts();
      Alert.alert('Success', 'Your post has been published!');
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setLoading(false);
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

  const confirmDeletePost = (post: Post) => {
    Alert.alert('Delete your post?', 'This permanently removes it, including its likes and saves.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('posts').delete().eq('id', post.id);
          if (error) Alert.alert('Could not delete', friendlyError(error));
          else setPosts(prev => prev.filter(p => p.id !== post.id));
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
            <ActivityIndicator size="large" color="#FED8FE" />
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
                  {loading ? 'Publishing...' : 'Publish'}
                </Text>
              </Pressable>
            </View>

            <Text style={{ color: '#A4CDD3', fontSize: 12, lineHeight: 18, marginBottom: 14 }}>
              Be kind and respectful. No spam or harassment. Share experiences, not medical advice: for health concerns, talk to your doctor. Posts can be reported and removed.
            </Text>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="What's on your mind?"
                placeholderTextColor="#A4CDD3"
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
                placeholderTextColor="#A4CDD3"
                value={excerpt}
                onChangeText={setExcerpt}
                maxLength={500}
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>{excerpt.length}/500</Text>
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
                <ActivityIndicator size="large" color="#FED8FE" />
              </View>
            )}
          </ScrollView>
        </ThemedView>
      </Modal>
      <Modal visible={!!reporting} transparent animationType="fade" onRequestClose={() => setReporting(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#0f3a41ff', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#2F9BA8' }}>
            <Text style={{ color: '#FED8FE', fontSize: 18, fontWeight: '700', marginBottom: 4 }}>Report this post</Text>
            <Text style={{ color: '#A4CDD3', marginBottom: 12 }}>What's wrong with it?</Text>
            {REPORT_REASONS.map(r => (
              <Pressable key={r} onPress={() => submitReport(r)} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#2F9BA8' }}>
                <Text style={{ color: '#E8FBFF', fontSize: 15, textTransform: 'capitalize' }}>{r}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setReporting(null)} style={{ paddingTop: 12 }}>
              <Text style={{ color: '#A4CDD3', textAlign: 'center' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09282eff',
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
    color: '#FED8FE',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    color: '#A4CDD3',
  },
  primaryButton: {
    marginTop: 6,
    backgroundColor: '#FED8FE',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#FED8FE',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  primaryButtonText: {
    color: '#12454E',
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
    backgroundColor: '#0f3a41ff',
    borderWidth: 1.5,
    borderColor: '#2F9BA8',
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: '#FDFECC',
    borderColor: '#FDFECC',
  },
  viewModeButtonText: {
    fontSize: 13,
    color: '#E8FBFF',
    fontWeight: '600',
  },
  viewModeButtonTextActive: {
    color: '#09282eff',
  },
  tagsContainer: {
    gap: 10,
  },
  tagsLabel: {
    fontSize: 14,
    color: '#FDFECC',
    fontWeight: '600',
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagButton: {
    backgroundColor: 'rgba(253, 254, 204, 0.15)',
    borderWidth: 1,
    borderColor: '#FDFECC',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    color: '#FDFECC',
    fontWeight: '600',
  },
  list: {
    gap: 12,
  },
  postCard: {
    backgroundColor: '#0f3a41ff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2F9BA8',
    gap: 8,
  },
  postHeader: {
    gap: 4,
  },
  postTitle: {
    fontSize: 16,
    color: '#E8FBFF',
    fontWeight: '700',
  },
  postMeta: {
    fontSize: 12,
    color: '#A4CDD3',
  },
  postExcerpt: {
    fontSize: 14,
    color: '#E8FBFF',
    lineHeight: 20,
  },
  postStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  statText: {
    fontSize: 12,
    color: '#FDFECC',
    fontWeight: '600',
  },
  postTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  postTag: {
    backgroundColor: 'rgba(254, 216, 254, 0.15)',
    borderWidth: 0.5,
    borderColor: '#FED8FE',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  postTagText: {
    fontSize: 11,
    color: '#FED8FE',
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
    backgroundColor: 'rgba(47, 155, 168, 0.1)',
    borderWidth: 1,
    borderColor: '#2F9BA8',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(253, 254, 204, 0.2)',
    borderColor: '#FDFECC',
  },
  actionButtonText: {
    fontSize: 13,
    color: '#E8FBFF',
    fontWeight: '600',
  },
  actionButtonTextActive: {
    color: '#FDFECC',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    color: '#A4CDD3',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#A4CDD3',
    fontSize: 15,
    textAlign: 'center',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#09282eff',
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
    color: '#A4CDD3',
    fontSize: 14,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 20,
    color: '#FED8FE',
    fontWeight: '700',
  },
  modalPublishButton: {
    color: '#FDFECC',
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
    color: '#FDFECC',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0f3a41ff',
    borderWidth: 1,
    borderColor: '#2F9BA8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#E8FBFF',
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  characterCount: {
    fontSize: 12,
    color: '#A4CDD3',
    textAlign: 'right',
  },
  tagSelectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagSelectionButton: {
    backgroundColor: 'rgba(47, 155, 168, 0.1)',
    borderWidth: 1.5,
    borderColor: '#2F9BA8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagSelectionButtonActive: {
    backgroundColor: '#FDFECC',
    borderColor: '#FDFECC',
  },
  tagSelectionText: {
    fontSize: 13,
    color: '#E8FBFF',
    fontWeight: '600',
  },
  tagSelectionTextActive: {
    color: '#12454E',
  },
  selectedTagsInfo: {
    fontSize: 12,
    color: '#A4CDD3',
    marginTop: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
