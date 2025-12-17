# Community Features - Quick Reference

## State Variables

```tsx
// Post and interaction tracking
const [posts, setPosts] = useState<Post[]>([]);           // All posts
const [userLikes, setUserLikes] = useState<number[]>([]); // Liked post IDs
const [userSaves, setUserSaves] = useState<number[]>([]); // Saved post IDs

// Form and UI state
const [isModalVisible, setIsModalVisible] = useState(false);
const [title, setTitle] = useState('');
const [excerpt, setExcerpt] = useState('');
const [selectedTags, setSelectedTags] = useState<string[]>([]);

// Loading states
const [loading, setLoading] = useState(false);             // Post creation
const [postsLoading, setPostsLoading] = useState(true);    // Initial load
const [interactionLoading, setInteractionLoading] = useState<number | null>(null);

// Auth and config
const [userName, setUserName] = useState('');
const [apiUrl, setApiUrl] = useState('');
```

## Key Functions

### fetchPosts(baseUrl: string)
- **Triggers**: On mount, after post creation
- **Does**: Calls `GET /api/posts?limit=50`
- **Updates**: posts state
- **Handles**: Loading state, error logging

### handleCreatePost()
- **Triggers**: "Publish" button in modal
- **Does**: Creates post with title, excerpt, tags
- **Validates**: All fields required, tags required
- **Authenticates**: Uses JWT token from AsyncStorage
- **Calls**: `POST /api/posts`
- **Updates**: posts state, clears form, closes modal
- **Feedback**: Success/error alert

### handleLikePost(postId: number)
- **Triggers**: Like button tap
- **Does**: Toggles like on/off
- **Authenticates**: JWT required (prompts if missing)
- **Calls**: `POST /api/posts/:id/like`
- **Updates**: 
  - userLikes array (add/remove postId)
  - Post's likes_count
- **UI Feedback**: Button changes to "Liked" with yellow highlight

### handleSavePost(postId: number)
- **Triggers**: Save button tap
- **Does**: Toggles save on/off
- **Authenticates**: JWT required (prompts if missing)
- **Calls**: `POST /api/posts/:id/save`
- **Updates**:
  - userSaves array (add/remove postId)
  - Post's saves_count
- **UI Feedback**: Button changes to "Saved" with yellow highlight

## Component Hierarchy

```
CommunityScreen
├── Header & Title
├── "Start a new post" Button
├── Topics Tags Grid
├── Posts Loading/Empty State
├── Posts List
│   └── Post Card (repeating)
│       ├── Title, Author, Date
│       ├── Excerpt
│       ├── Tag Pills
│       └── Actions
│           ├── Like Button
│           └── Save Button
└── Modal (Create Post)
    ├── Header with close/publish
    ├── Title Input
    ├── Description Input
    └── Topic Tags Selection
```

## API Endpoints

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | /posts | No | `{ posts: Post[] }` |
| POST | /posts | Yes | `{ id, author, ... }` |
| POST | /posts/:id/like | Yes | `{ likes_count: number }` |
| POST | /posts/:id/save | Yes | `{ saves_count: number }` |
| GET | /user/likes | Yes | `{ liked_post_ids: number[] }` |
| GET | /user/saves | Yes | `{ saved_post_ids: number[] }` |

## Colors & Styling

### Button States

**Like/Save Button - Inactive:**
- Border: 1px #2F9BA8 (teal)
- Background: rgba(47, 155, 168, 0.1) (light teal)
- Text: #E8FBFF (light)
- Text Content: "Like (5)" or "Save (3)"

**Like/Save Button - Active:**
- Border: 1px #FDFECC (yellow)
- Background: rgba(253, 254, 204, 0.2) (light yellow)
- Text: #FDFECC (yellow)
- Text Content: "Liked (5)" or "Saved (3)"

### Typography

```tsx
// Sizes
title: 24px, bold       // "Community Board"
subtitle: 15px, normal  // Description
postTitle: 16px, bold   // Post title
postMeta: 12px, normal  // Author and date
postExcerpt: 14px, normal, lineHeight 20
actionButtonText: 13px, bold
```

### Color Palette

| Element | Color | Hex |
|---------|-------|-----|
| Background | Dark Navy | #09282eff |
| Primary Accent | Pink | #FED8FE |
| Secondary | Yellow | #FDFECC |
| Border/Accent | Teal | #2F9BA8 |
| Main Text | Light | #E8FBFF |
| Secondary Text | Muted | #A4CDD3 |

## Data Models

### Post Interface
```tsx
interface Post {
  id: number;
  title: string;
  excerpt: string;
  author: string;
  tags: string[];
  likes_count: number;
  saves_count: number;
  created_at: string;
}
```

### Topic Tags
```tsx
const topicTags = [
  'Sleep',
  'Feeding',
  'Breastfeeding',
  'Milestones',
  'Health',
  'Development',
  'Mental Health'
];
```

## Authentication Flow

```tsx
// Step 1: Get token from storage
const token = await AsyncStorage.getItem('authToken');

// Step 2: Check if exists
if (!token) {
  Alert.alert('Not Logged In', 'Please log in to [action]');
  return;
}

// Step 3: Include in API call
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});
```

## State Updates Pattern

### Like/Unlike
```tsx
// Check if already liked
if (userLikes.includes(postId)) {
  // Remove (unlike)
  setUserLikes(userLikes.filter(id => id !== postId));
  // Decrement count
} else {
  // Add (like)
  setUserLikes([...userLikes, postId]);
  // Increment count
}

// Update post with new count from API response
setPosts(posts.map(p =>
  p.id === postId
    ? { ...p, likes_count: data.likes_count }
    : p
));
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Not Logged In" alert | Login first, ensure token in AsyncStorage |
| Like count doesn't update | Check API response, verify likes_count returned |
| Button doesn't show "Liked" | Verify userLikes state update, check post.id |
| Likes disappear after refresh | Check GET /user/likes endpoint, AsyncStorage loading |
| API 401 error | Token expired, force login refresh |
| API 403 error | Token invalid, clear and re-login |

## Testing Commands

### Create Post via API
```bash
curl -X POST http://localhost:4000/api/posts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","excerpt":"Test post","tags":["Sleep"]}'
```

### Like Post via API
```bash
curl -X POST http://localhost:4000/api/posts/1/like \
  -H "Authorization: Bearer TOKEN"
```

### Check Likes
```bash
curl -X GET http://localhost:4000/api/user/likes \
  -H "Authorization: Bearer TOKEN"
```

## Performance Tips

1. **Limit posts fetched**: Using `?limit=50` in GET /posts
2. **Batch user interactions**: Fetch likes and saves together on mount
3. **Disable buttons during request**: Use interactionLoading state
4. **Avoid re-rendering**: Use post.id for unique keys
5. **Cache user data**: Store userName and apiUrl in AsyncStorage

## Future Enhancements

- [ ] Comment system on posts
- [ ] User profiles and following
- [ ] Search and advanced filtering
- [ ] Real-time notifications
- [ ] Post editing for authors
- [ ] Image/media uploads
- [ ] Trending posts algorithm
- [ ] Share to social media

---

**Last Updated**: [Current Date]
**Version**: 1.0
**Component**: `frontend/app/community.tsx`
**Lines**: 722
