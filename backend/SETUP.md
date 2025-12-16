# Backend Setup & Configuration

## Prerequisites

- Node.js (v14+)
- PostgreSQL database
- npm or yarn

## Installation

1. **Install dependencies** (from the backend directory):
```bash
npm install express cors body-parser pg bcryptjs jsonwebtoken dotenv
```

2. **Environment Variables**

Create a `.env` file in the backend directory with the following variables:

```env
# Server
PORT=4000
JWT_SECRET=your-secret-key-change-me

# Database (PostgreSQL)
DATABASE_URL=postgres://user:password@localhost:5432/mybean_db

# Optional: For production
NODE_ENV=development
DB_SSL=false
```

## Running the Server

```bash
node server.js
```

The server will start on `http://localhost:4000` and automatically create the database schema on first run.

## Database Setup

The server automatically creates all required tables on startup:
- `users` - User accounts
- `user_profiles` - User profile data
- `posts` - Community posts
- `post_likes` - Post likes tracking
- `post_saves` - Post saves tracking

## API Documentation

See `API.md` for detailed endpoint documentation.

## Example Usage

### 1. Sign Up
```bash
curl -X POST http://localhost:4000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "securepass123"
  }'
```

Response:
```json
{
  "user": {
    "id": 1,
    "name": "Jane Doe",
    "email": "jane@example.com"
  },
  "token": "eyJhbGc..."
}
```

### 2. Create a Post
```bash
curl -X POST http://localhost:4000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "title": "Night feeds tips",
    "excerpt": "How often are your 3-month-olds waking?",
    "tags": ["sleep", "newborn"]
  }'
```

### 3. Get All Posts
```bash
curl http://localhost:4000/api/posts?limit=20&offset=0
```

### 4. Like a Post
```bash
curl -X POST http://localhost:4000/api/posts/1/like \
  -H "Authorization: Bearer eyJhbGc..."
```

### 5. Save a Post
```bash
curl -X POST http://localhost:4000/api/posts/1/save \
  -H "Authorization: Bearer eyJhbGc..."
```

## Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Check DATABASE_URL is correct
- Verify network access to database server

### JWT Token Error
- Make sure JWT_SECRET is set and consistent
- Verify token is included in Authorization header with "Bearer " prefix

### Port Already in Use
- Change PORT in .env or command line:
  ```bash
  PORT=5000 node server.js
  ```

## Next Steps for Frontend Integration

1. Get the API base URL (e.g., `http://localhost:4000/api`)
2. Use the authentication endpoints to handle sign up/login
3. Store the JWT token from login/signup response
4. Include token in Authorization header for protected endpoints
5. Use the posts endpoints to fetch, create, like, and save posts

See the API documentation for complete endpoint specifications.
