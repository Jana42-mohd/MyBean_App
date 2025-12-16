# MyBean Backend

Backend server for the MyBean baby monitoring app. Built with Express.js and PostgreSQL.

## Features

✅ **User Authentication**
- Sign up & login with JWT tokens
- Secure password hashing with bcrypt
- Token-based API authentication

✅ **Community Posts**
- Create, read, delete posts
- Like/unlike posts with automatic count tracking
- Save/unsave posts for later
- Filter posts by topic tags
- Pagination support

✅ **User Management**
- User profiles
- View user's own posts
- View liked posts
- View saved posts

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
PORT=4000
JWT_SECRET=your-secret-key-here
DATABASE_URL=postgres://user:password@localhost:5432/mybean_db
NODE_ENV=development
```

### 3. Start Server
```bash
node server.js
```

Server will run on `http://localhost:4000`

## Project Structure

```
backend/
├── routes/
│   ├── auth.js          # Authentication endpoints
│   ├── survey.js        # Survey/profile endpoints
│   └── posts.js         # Community posts endpoints
├── server.js            # Main Express app
├── SETUP.md             # Setup & configuration guide
├── API.md               # API documentation
├── EXAMPLES.md          # Example requests & responses
└── README.md            # This file
```

## API Endpoints

### Authentication
- `POST /api/signup` - Register new user
- `POST /api/login` - Login user

### Posts (Community)
- `POST /api/posts` - Create a post (protected)
- `GET /api/posts` - Get all posts
- `GET /api/posts/:id` - Get single post
- `POST /api/posts/:id/like` - Like/unlike post (protected)
- `POST /api/posts/:id/save` - Save/unsave post (protected)
- `DELETE /api/posts/:id` - Delete post (protected)

### User Data
- `GET /api/user/posts` - Get user's posts (protected)
- `GET /api/user/likes` - Get user's liked posts (protected)
- `GET /api/user/saves` - Get user's saved posts (protected)

## Database Schema

### Tables
- `users` - User accounts
- `user_profiles` - User profile data
- `posts` - Community posts
- `post_likes` - Post likes tracking
- `post_saves` - Post saves tracking

All tables are automatically created on server startup.

## Authentication

Protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <token>
```

Token is obtained from signup/login and expires in 7 days.

## Error Handling

All errors return JSON with status codes:
- `400` - Bad Request (missing/invalid fields)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (not authorized for action)
- `404` - Not Found
- `409` - Conflict (email exists, etc)
- `500` - Server Error

## Documentation Files

- **API.md** - Complete API endpoint documentation
- **SETUP.md** - Installation and configuration guide
- **EXAMPLES.md** - Request/response examples with cURL commands

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 4000 | Server port |
| JWT_SECRET | Yes | - | Secret key for JWT signing |
| DATABASE_URL | Yes | - | PostgreSQL connection string |
| NODE_ENV | No | development | Environment (development/production) |
| DB_SSL | No | false | Enable SSL for database |

## Dependencies

- `express` - Web framework
- `cors` - CORS middleware
- `body-parser` - JSON parsing
- `pg` - PostgreSQL client
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT authentication

## Development

```bash
# Run server
node server.js

# Run with auto-restart (requires nodemon)
nodemon server.js

# Set port
PORT=5000 node server.js
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong JWT_SECRET
3. Configure DATABASE_URL for production database
4. Enable DB_SSL=true if needed
5. Use a process manager (PM2, forever, etc.)

## Troubleshooting

**Database Connection Failed**
- Ensure PostgreSQL is running
- Verify DATABASE_URL is correct
- Check network access to database

**Token Invalid**
- Ensure JWT_SECRET is set
- Verify token format: `Bearer <token>`
- Check token hasn't expired

**Port Already in Use**
- Change PORT in .env or use `PORT=5000 node server.js`

## Next Steps

1. Set up frontend to connect to these API endpoints
2. Store JWT tokens securely on client
3. Include Authorization header in protected requests
4. Handle authentication errors in frontend

## Support

For issues or questions, check the documentation files:
- API.md - API reference
- SETUP.md - Setup guide
- EXAMPLES.md - Working examples
