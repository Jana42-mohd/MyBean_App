import { StyleSheet, ScrollView, Text, View, Pressable, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Post {
  id: string;
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

const DEMO_POSTS: Post[] = [
  {
    id: 'demo_1',
    title: 'Tips for better sleep routines',
    excerpt: 'My baby finally sleeps through the night! Here\'s what worked for us: consistent bedtime, white noise, and a calm environment.',
    author: 'Sarah M.',
    tags: ['sleep', 'development'],
    likes_count: 24,
    saves_count: 12,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo_2',
    title: 'Breastfeeding challenges in the first month',
    excerpt: 'Struggling with latching? I was too. Don\'t hesitate to reach out to a lactation consultant - it made all the difference!',
    author: 'Emma L.',
    tags: ['breastfeeding', 'feeding', 'mental health'],
    likes_count: 18,
    saves_count: 8,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo_3',
    title: 'When did your baby reach their first milestone?',
    excerpt: 'Curious about when your baby smiled for the first time? My little one smiled at 6 weeks and it melted my heart!',
    author: 'Jessica K.',
    tags: ['milestones', 'development'],
    likes_count: 32,
    saves_count: 15,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function CommunityScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
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
    const initializeAndFetchPosts = async () => {
      try {
        // Get user name from storage
        const storedUserName = await AsyncStorage.getItem('surveyData');
        if (storedUserName) {
          const surveyData = JSON.parse(storedUserName);
          setUserName(surveyData.parentName || 'Anonymous');
        } else {
          setUserName('You');
        }

        // Load local posts and demo posts
        await loadPosts();
      } catch (e) {
        console.error('Error initializing community:', e);
        // Load demo posts on error
        setPosts(DEMO_POSTS);
      }
    };

    initializeAndFetchPosts();
  }, []);

  const loadPosts = async () => {
    try {
      setPostsLoading(true);
      
      // Get local posts from storage
      const localPostsJson = await AsyncStorage.getItem('communityPosts');
      const localPosts = localPostsJson ? JSON.parse(localPostsJson) : [];
      
      // Get user likes and saves
      const likesJson = await AsyncStorage.getItem('userLikes');
      const savesJson = await AsyncStorage.getItem('userSaves');
      
      setUserLikes(likesJson ? JSON.parse(likesJson) : []);
      setUserSaves(savesJson ? JSON.parse(savesJson) : []);
      
      // Combine demo posts with local posts (local posts first)
      const allPosts = [...localPosts, ...DEMO_POSTS].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setPosts(allPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
      setPosts(DEMO_POSTS);
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
      
      const newPost: Post = {
        id: `post_${Date.now()}`,
        title: title.trim(),
        excerpt: excerpt.trim(),
        author: userName,
        tags: selectedTags.map(t => t.toLowerCase()),
        likes_count: 0,
        saves_count: 0,
        created_at: new Date().toISOString(),
        local: true,
      };

      // Get existing posts from storage
      const existingPostsJson = await AsyncStorage.getItem('communityPosts');
      const existingPosts = existingPostsJson ? JSON.parse(existingPostsJson) : [];
      
      // Add new post to the beginning
      const updatedPosts = [newPost, ...existingPosts];
      
      // Save to storage
      await AsyncStorage.setItem('communityPosts', JSON.stringify(updatedPosts));
      
      // Update local state
      setPosts([newPost, ...posts]);
      
      // Reset form and close modal
      setTitle('');
      setExcerpt('');
      setSelectedTags([]);
      setIsModalVisible(false);
      
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
      
      // Update local storage
      const newLikes = userLikes.includes(postId) 
        ? userLikes.filter(id => id !== postId)
        : [...userLikes, postId];
      
      await AsyncStorage.setItem('userLikes', JSON.stringify(newLikes));
      setUserLikes(newLikes);

      // Update posts state
      setPosts(posts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likes_count: newLikes.includes(postId) ? p.likes_count + 1 : p.likes_count - 1,
          };
        }
        return p;
      }));
    } catch (error) {
      console.error('Error liking post:', error);
      Alert.alert('Error', 'Failed to like post. Please try again.');
    } finally {
      setInteractionLoading(null);
    }
  };

  const handleSavePost = async (postId: string) => {
    try {
      setInteractionLoading(postId);
      
      // Update local storage
      const newSaves = userSaves.includes(postId) 
        ? userSaves.filter(id => id !== postId)
        : [...userSaves, postId];
      
      await AsyncStorage.setItem('userSaves', JSON.stringify(newSaves));
      setUserSaves(newSaves);

      // Update posts state
      setPosts(posts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            saves_count: newSaves.includes(postId) ? p.saves_count + 1 : p.saves_count - 1,
          };
        }
        return p;
      }));
    } catch (error) {
      console.error('Error saving post:', error);
      Alert.alert('Error', 'Failed to save post. Please try again.');
    } finally {
      setInteractionLoading(null);
    }
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
    <ThemedView style={styles.container}>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09282eff',
  },
  content: {
    paddingTop: 80,
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
