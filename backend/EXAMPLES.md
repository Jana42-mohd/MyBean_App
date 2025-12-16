# API Examples & Testing

## Complete Example Workflow

### 1. User Registration

**Request:**
```bash
POST /api/signup
Content-Type: application/json

{
  "name": "Sarah Johnson",
  "email": "sarah@example.com",
  "password": "SecurePass123!"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": 1,
    "name": "Sarah Johnson",
    "email": "sarah@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 2. User Login

**Request:**
```bash
POST /api/login
Content-Type: application/json

{
  "email": "sarah@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "name": "Sarah Johnson",
    "email": "sarah@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 3. Create a Post

**Request:**
```bash
POST /api/posts
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "title": "Breastfeeding challenges",
  "excerpt": "Struggling with engorgement and blocked ducts. Any tips from experienced moms?",
  "tags": ["breastfeeding", "support", "newborn"]
}
```

**Response (201 Created):**
```json
{
  "id": 5,
  "user_id": 1,
  "title": "Breastfeeding challenges",
  "excerpt": "Struggling with engorgement and blocked ducts. Any tips from experienced moms?",
  "tags": ["breastfeeding", "support", "newborn"],
  "created_at": "2025-12-15T14:30:45.123Z",
  "likes_count": 0,
  "saves_count": 0
}
```

---

### 4. Fetch All Posts with Pagination

**Request:**
```bash
GET /api/posts?limit=10&offset=0
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "posts": [
    {
      "id": 5,
      "user_id": 1,
      "title": "Breastfeeding challenges",
      "excerpt": "Struggling with engorgement and blocked ducts. Any tips from experienced moms?",
      "tags": ["breastfeeding", "support", "newborn"],
      "created_at": "2025-12-15T14:30:45.123Z",
      "likes_count": 3,
      "saves_count": 1,
      "author": "Sarah Johnson"
    },
    {
      "id": 4,
      "user_id": 3,
      "title": "Sleep training at 6 months",
      "excerpt": "Started sleep training with our 6-month-old. Results have been amazing!",
      "tags": ["sleep", "milestones"],
      "created_at": "2025-12-14T10:15:30.456Z",
      "likes_count": 12,
      "saves_count": 8,
      "author": "Jessica Lee"
    }
  ],
  "count": 2,
  "limit": 10,
  "offset": 0
}
```

---

### 5. Filter Posts by Tag

**Request:**
```bash
GET /api/posts?tag=breastfeeding&limit=20
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "posts": [
    {
      "id": 5,
      "user_id": 1,
      "title": "Breastfeeding challenges",
      "excerpt": "Struggling with engorgement and blocked ducts. Any tips from experienced moms?",
      "tags": ["breastfeeding", "support", "newborn"],
      "created_at": "2025-12-15T14:30:45.123Z",
      "likes_count": 3,
      "saves_count": 1,
      "author": "Sarah Johnson"
    }
  ],
  "count": 1,
  "limit": 20,
  "offset": 0
}
```

---

### 6. Get Single Post

**Request:**
```bash
GET /api/posts/5
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "id": 5,
  "user_id": 1,
  "title": "Breastfeeding challenges",
  "excerpt": "Struggling with engorgement and blocked ducts. Any tips from experienced moms?",
  "tags": ["breastfeeding", "support", "newborn"],
  "created_at": "2025-12-15T14:30:45.123Z",
  "updated_at": "2025-12-15T14:30:45.123Z",
  "likes_count": 3,
  "saves_count": 1,
  "author": "Sarah Johnson",
  "author_email": "sarah@example.com"
}
```

---

### 7. Like a Post

**Request:**
```bash
POST /api/posts/5/like
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK) - First Like:**
```json
{
  "liked": true,
  "message": "Post liked"
}
```

**Response (200 OK) - Unlike:**
```json
{
  "liked": false,
  "message": "Post unliked"
}
```

---

### 8. Save a Post

**Request:**
```bash
POST /api/posts/5/save
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK) - First Save:**
```json
{
  "saved": true,
  "message": "Post saved"
}
```

**Response (200 OK) - Unsave:**
```json
{
  "saved": false,
  "message": "Post removed from saves"
}
```

---

### 9. Get User's Liked Posts

**Request:**
```bash
GET /api/user/likes
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "likedPosts": [1, 3, 5, 7]
}
```

---

### 10. Get User's Saved Posts

**Request:**
```bash
GET /api/user/saves
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "savedPosts": [
    {
      "id": 5,
      "user_id": 1,
      "title": "Breastfeeding challenges",
      "excerpt": "Struggling with engorgement and blocked ducts...",
      "tags": ["breastfeeding", "support", "newborn"],
      "created_at": "2025-12-15T14:30:45.123Z",
      "likes_count": 3,
      "saves_count": 1,
      "author": "Sarah Johnson"
    }
  ]
}
```

---

### 11. Get User's Own Posts

**Request:**
```bash
GET /api/user/posts
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "userPosts": [
    {
      "id": 5,
      "user_id": 1,
      "title": "Breastfeeding challenges",
      "excerpt": "Struggling with engorgement and blocked ducts...",
      "tags": ["breastfeeding", "support", "newborn"],
      "created_at": "2025-12-15T14:30:45.123Z",
      "updated_at": "2025-12-15T14:30:45.123Z",
      "likes_count": 3,
      "saves_count": 1
    }
  ]
}
```

---

### 12. Delete a Post

**Request:**
```bash
DELETE /api/posts/5
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200 OK):**
```json
{
  "message": "Post deleted"
}
```

---

## Error Examples

### Missing Required Fields
**Request:**
```bash
POST /api/posts
Authorization: Bearer token...
{
  "title": "My post"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Missing title or excerpt"
}
```

### Unauthorized Access
**Request:**
```bash
POST /api/posts/5/like
```

**Response (401 Unauthorized):**
```json
{
  "error": "Missing or invalid authorization header"
}
```

### Post Not Found
**Request:**
```bash
GET /api/posts/99999
```

**Response (404 Not Found):**
```json
{
  "error": "Post not found"
}
```

### Forbidden (Not Post Owner)
**Request:**
```bash
DELETE /api/posts/5
Authorization: Bearer different-user-token...
```

**Response (403 Forbidden):**
```json
{
  "error": "Unauthorized"
}
```

---

## Testing with cURL

Copy and paste these commands to test the API:

```bash
# Sign up
curl -X POST http://localhost:4000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"TestPass123"}'

# Login
curl -X POST http://localhost:4000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'

# Create post (replace TOKEN with actual token)
curl -X POST http://localhost:4000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"title":"Test Post","excerpt":"This is a test","tags":["test"]}'

# Get all posts
curl http://localhost:4000/api/posts

# Like post (replace 1 with post ID and TOKEN with actual token)
curl -X POST http://localhost:4000/api/posts/1/like \
  -H "Authorization: Bearer TOKEN"

# Save post
curl -X POST http://localhost:4000/api/posts/1/save \
  -H "Authorization: Bearer TOKEN"

# Get user's saved posts
curl http://localhost:4000/api/user/saves \
  -H "Authorization: Bearer TOKEN"
```
