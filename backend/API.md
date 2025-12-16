# MyBean Backend API Documentation

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Auth Endpoints

#### Sign Up
- **POST** `/api/signup`
- **Body**: `{ name, email, password }`
- **Response**: `{ user: { id, name, email }, token }`

#### Login
- **POST** `/api/login`
- **Body**: `{ email, password }`
- **Response**: `{ user: { id, name, email }, token }`

---

### Posts Endpoints

#### Create a Post
- **POST** `/api/posts` (Protected)
- **Body**: `{ title, excerpt, tags }`
- **Response**: `{ id, user_id, title, excerpt, tags, created_at, likes_count, saves_count }`
- **Example**:
  ```json
  {
    "title": "Night feeds tips",
    "excerpt": "How often are your 3-month-olds waking?",
    "tags": ["sleep", "newborn"]
  }
  ```

#### Get All Posts
- **GET** `/api/posts?limit=20&offset=0&tag=sleep`
- **Query Parameters**:
  - `limit` (optional): Number of posts per page (default: 20)
  - `offset` (optional): Pagination offset (default: 0)
  - `tag` (optional): Filter by tag
- **Response**: `{ posts: [...], count, limit, offset }`
- **Example Response**:
  ```json
  {
    "posts": [
      {
        "id": 1,
        "user_id": 2,
        "title": "Night feeds tips",
        "excerpt": "How often are your 3-month-olds waking?",
        "tags": ["sleep", "newborn"],
        "created_at": "2025-12-15T10:30:00Z",
        "likes_count": 12,
        "saves_count": 5,
        "author": "Jamie"
      }
    ],
    "count": 1,
    "limit": 20,
    "offset": 0
  }
  ```

#### Get Single Post
- **GET** `/api/posts/:id`
- **Response**: `{ id, user_id, title, excerpt, tags, created_at, updated_at, likes_count, saves_count, author, author_email }`

#### Like a Post
- **POST** `/api/posts/:id/like` (Protected)
- **Response**: `{ liked: true/false, message }`
- **Notes**: Toggle like/unlike. Increments/decrements likes_count automatically.

#### Save a Post
- **POST** `/api/posts/:id/save` (Protected)
- **Response**: `{ saved: true/false, message }`
- **Notes**: Toggle save/unsave. Increments/decrements saves_count automatically.

#### Delete a Post
- **DELETE** `/api/posts/:id` (Protected)
- **Response**: `{ message: "Post deleted" }`
- **Notes**: Only the post creator can delete their own post. Automatically deletes associated likes and saves.

---

### User Posts Endpoints

#### Get User's Own Posts
- **GET** `/api/user/posts` (Protected)
- **Response**: `{ userPosts: [...] }`

#### Get User's Likes
- **GET** `/api/user/likes` (Protected)
- **Response**: `{ likedPosts: [1, 3, 5] }` (array of post IDs)

#### Get User's Saved Posts
- **GET** `/api/user/saves` (Protected)
- **Response**: `{ savedPosts: [...] }`

---

## Database Schema

### posts
```sql
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  tags JSONB,
  likes_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### post_likes
```sql
CREATE TABLE post_likes (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);
```

### post_saves
```sql
CREATE TABLE post_saves (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);
```

---

## Error Responses

All error responses follow this format:
```json
{
  "error": "Error message"
}
```

Common status codes:
- `400`: Bad Request (missing required fields)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (not authorized to perform action)
- `404`: Not Found (resource doesn't exist)
- `409`: Conflict (e.g., email already exists)
- `500`: Server Error
