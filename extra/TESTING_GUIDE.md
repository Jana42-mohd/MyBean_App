# Testing Guide: Like & Save Functionality

## Prerequisites
1. Backend server running: `npm start` in `/backend` directory
2. PostgreSQL database running and connected
3. User logged in with valid JWT token stored in AsyncStorage
4. At least one post in the database

## Manual Testing Steps

### Test 1: Like a Post

**Setup:**
- Ensure you're logged in (JWT token in AsyncStorage)
- View any post in the community feed

**Action:**
1. Tap the "Like" button on a post
2. Observe the button appearance change

**Expected Results:**
- Button text changes from "Like" to "Liked"
- Button background changes from teal to yellow
- Like count increments by 1
- No error alerts

**Database Check:**
```sql
-- Check post_likes table
SELECT * FROM post_likes WHERE post_id = [postId] AND user_id = [userId];

-- Check posts table like count
SELECT likes_count FROM posts WHERE id = [postId];
```

---

### Test 2: Unlike a Post

**Setup:**
- Must have liked a post (button shows "Liked")

**Action:**
1. Tap the "Liked" button again

**Expected Results:**
- Button text changes from "Liked" back to "Like"
- Button background changes from yellow back to teal
- Like count decrements by 1
- Post is removed from post_likes table

**Database Check:**
```sql
-- Entry should be deleted
SELECT * FROM post_likes WHERE post_id = [postId] AND user_id = [userId];
-- Should return 0 rows
```

---

### Test 3: Save a Post

**Setup:**
- Ensure you're logged in
- View any post with "Save" button

**Action:**
1. Tap the "Save" button on a post
2. Observe the button appearance change

**Expected Results:**
- Button text changes from "Save" to "Saved"
- Button background changes from teal to yellow
- Save count increments by 1
- No error alerts

**Database Check:**
```sql
-- Check post_saves table
SELECT * FROM post_saves WHERE post_id = [postId] AND user_id = [userId];

-- Check posts table save count
SELECT saves_count FROM posts WHERE id = [postId];
```

---

### Test 4: Unsave a Post

**Setup:**
- Must have saved a post (button shows "Saved")

**Action:**
1. Tap the "Saved" button again

**Expected Results:**
- Button text changes from "Saved" back to "Save"
- Button background changes from yellow back to teal
- Save count decrements by 1

**Database Check:**
```sql
-- Entry should be deleted
SELECT * FROM post_saves WHERE post_id = [postId] AND user_id = [userId];
-- Should return 0 rows
```

---

### Test 5: Like Multiple Posts

**Setup:**
- View multiple posts
- Logged in

**Action:**
1. Like post A
2. Like post B
3. Like post C
4. Check all buttons show "Liked" status

**Expected Results:**
- Each post tracks its own like independently
- Counts are accurate per post
- All buttons show correct state

**Database Check:**
```sql
-- Check all likes for current user
SELECT post_id FROM post_likes WHERE user_id = [userId];
-- Should show 3 posts

-- Verify counts
SELECT id, likes_count FROM posts WHERE id IN ([postA], [postB], [postC]);
```

---

### Test 6: Persistence After Refresh

**Setup:**
- Like and save some posts
- Note which posts are interacted with

**Action:**
1. Close the app completely
2. Reopen the app
3. Navigate to Community screen
4. Observe post states

**Expected Results:**
- All previously liked posts still show "Liked"
- All previously saved posts still show "Saved"
- Counts are accurate
- No duplicate interactions

**Technical Flow:**
1. useEffect runs on mount
2. Calls GET /api/user/likes → gets array of post IDs
3. Calls GET /api/user/saves → gets array of post IDs
4. State is populated with user interactions
5. UI reflects current state

---

### Test 7: Without Authentication

**Setup:**
- Clear authToken from AsyncStorage (logout or delete token)
- View community feed

**Action:**
1. Tap "Like" button on any post
2. Observe alert dialog

**Expected Results:**
- Alert dialog appears: "Not Logged In"
- Message: "Please log in to like posts"
- No API call made
- Post state unchanged

**Code Check:**
```tsx
// In handleLikePost()
const token = await AsyncStorage.getItem('authToken');
if (!token) {
  Alert.alert('Not Logged In', 'Please log in to like posts');
  return; // ← Prevents API call
}
```

---

### Test 8: Loading State

**Setup:**
- Network tab open in Chrome DevTools (if testing on web)
- Or add throttling to see loading behavior

**Action:**
1. Tap "Like" button
2. Quickly tap another button before request completes
3. Observe behavior

**Expected Results:**
- Current button becomes disabled during request
- Other buttons remain enabled
- Only one interaction can process at a time
- Button re-enables when request completes

**Code Check:**
```tsx
// disabled={interactionLoading === post.id}
// Only current post ID gets disabled
```

---

### Test 9: Error Handling

**Setup:**
- Temporarily stop backend server
- Be in community feed

**Action:**
1. Try to like a post
2. Observe error handling

**Expected Results:**
- Alert dialog shows error
- Post state unchanged
- User can retry after backend restarts
- No crash or freeze

---

### Test 10: Like Count Accuracy

**Setup:**
- Multiple users logged in (or simulate with different tokens)
- Each user likes the same post

**Action:**
1. User A likes post X → count should be 1
2. User B likes post X → count should be 2
3. User C likes post X → count should be 3
4. User A unlikes post X → count should be 2

**Database Check:**
```sql
-- Check total likes for post X
SELECT COUNT(*) as like_count FROM post_likes WHERE post_id = X;

-- Compare with posts table
SELECT likes_count FROM posts WHERE id = X;
-- Should match
```

---

## API Testing with cURL

### Like a Post
```bash
curl -X POST http://localhost:4000/api/posts/1/like \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{}'
```

**Expected Response:**
```json
{
  "message": "Post liked successfully",
  "likes_count": 5
}
```

### Save a Post
```bash
curl -X POST http://localhost:4000/api/posts/1/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{}'
```

**Expected Response:**
```json
{
  "message": "Post saved successfully",
  "saves_count": 3
}
```

### Get User's Liked Posts
```bash
curl -X GET http://localhost:4000/api/user/likes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "liked_post_ids": [1, 3, 5, 7]
}
```

### Get User's Saved Posts
```bash
curl -X GET http://localhost:4000/api/user/saves \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "saved_post_ids": [2, 4, 6]
}
```

---

## Debugging Tips

### Issue: Like count not updating
1. Check network tab → see if POST request succeeded
2. Check backend logs for errors
3. Verify JWT token is valid and not expired
4. Check database: post_likes table may have the record

### Issue: Button not showing "Liked" state
1. Check userLikes state: console.log(userLikes)
2. Verify post.id is being passed correctly
3. Check if state update is happening: refresh and check persistence

### Issue: Count is wrong
1. Check database directly: SELECT likes_count FROM posts WHERE id = ?
2. Verify counts on UI vs database match
3. Check for duplicate entries in post_likes table: SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?

### Issue: Network error
1. Verify backend is running: curl http://localhost:4000/health
2. Check AsyncStorage for correct apiUrl: console.log(apiUrl)
3. Verify JWT token: console.log(token)
4. Check CORS settings in backend

---

## Success Criteria

✅ All buttons render correctly
✅ Like/unlike toggles work
✅ Save/unsave toggles work
✅ Counts update accurately
✅ State persists after refresh
✅ Authentication prompt appears when needed
✅ Loading states display properly
✅ Errors are handled gracefully
✅ Database entries are created/deleted correctly
✅ Multiple users' interactions are independent

---

**Last Updated**: [Current Date]
**Tested With**: React Native Expo, PostgreSQL 12+, Express.js
**Status**: Ready for QA Testing
