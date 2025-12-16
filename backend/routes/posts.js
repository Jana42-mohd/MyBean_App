const express = require('express');
const jwt = require('jsonwebtoken');

module.exports = function makePostsRoutes({ pool, jwtSecret }) {
  const router = express.Router();

  // Middleware to verify JWT token
  const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, jwtSecret);
      req.userId = decoded.sub;
      next();
    } catch (e) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Create a new post
  router.post('/posts', verifyToken, async (req, res) => {
    const { title, excerpt, tags } = req.body || {};
    if (!title || !excerpt) {
      return res.status(400).json({ error: 'Missing title or excerpt' });
    }
    try {
      const result = await pool.query(
        `INSERT INTO posts (user_id, title, excerpt, tags, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, user_id, title, excerpt, tags, created_at, likes_count, saves_count`,
        [req.userId, title, excerpt, tags ? JSON.stringify(tags) : null]
      );
      const post = result.rows[0];
      res.status(201).json(post);
    } catch (e) {
      console.error('Error creating post:', e);
      res.status(500).json({ error: 'Failed to create post' });
    }
  });

  // Get all posts (with pagination and filtering)
  router.get('/posts', async (req, res) => {
    const { limit = 20, offset = 0, tag } = req.query;
    try {
      let query = `
        SELECT p.id, p.user_id, p.title, p.excerpt, p.tags, 
               p.created_at, p.likes_count, p.saves_count,
               u.name as author
        FROM posts p
        JOIN users u ON p.user_id = u.id
      `;
      const params = [];

      if (tag) {
        query += ` WHERE p.tags::text ILIKE $1`;
        params.push(`%${tag}%`);
      }

      query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await pool.query(query, params);
      res.json({
        posts: result.rows,
        count: result.rows.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    } catch (e) {
      console.error('Error fetching posts:', e);
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  });

  // Get a single post by ID
  router.get('/posts/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        `SELECT p.id, p.user_id, p.title, p.excerpt, p.tags,
                p.created_at, p.updated_at, p.likes_count, p.saves_count,
                u.name as author, u.email as author_email
         FROM posts p
         JOIN users u ON p.user_id = u.id
         WHERE p.id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      res.json(result.rows[0]);
    } catch (e) {
      console.error('Error fetching post:', e);
      res.status(500).json({ error: 'Failed to fetch post' });
    }
  });

  // Like a post
  router.post('/posts/:id/like', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
      // Check if already liked
      const likeCheck = await pool.query(
        'SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2',
        [id, req.userId]
      );

      if (likeCheck.rows.length > 0) {
        // Already liked, unlike it
        await pool.query(
          'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
          [id, req.userId]
        );
        // Update likes count
        await pool.query(
          'UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1',
          [id]
        );
        return res.json({ liked: false, message: 'Post unliked' });
      } else {
        // Not liked yet, add like
        await pool.query(
          'INSERT INTO post_likes (post_id, user_id, created_at) VALUES ($1, $2, NOW())',
          [id, req.userId]
        );
        // Update likes count
        await pool.query(
          'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1',
          [id]
        );
        return res.json({ liked: true, message: 'Post liked' });
      }
    } catch (e) {
      console.error('Error liking post:', e);
      res.status(500).json({ error: 'Failed to like post' });
    }
  });

  // Save a post
  router.post('/posts/:id/save', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
      // Check if already saved
      const saveCheck = await pool.query(
        'SELECT id FROM post_saves WHERE post_id = $1 AND user_id = $2',
        [id, req.userId]
      );

      if (saveCheck.rows.length > 0) {
        // Already saved, unsave it
        await pool.query(
          'DELETE FROM post_saves WHERE post_id = $1 AND user_id = $2',
          [id, req.userId]
        );
        // Update saves count
        await pool.query(
          'UPDATE posts SET saves_count = saves_count - 1 WHERE id = $1',
          [id]
        );
        return res.json({ saved: false, message: 'Post removed from saves' });
      } else {
        // Not saved yet, save it
        await pool.query(
          'INSERT INTO post_saves (post_id, user_id, created_at) VALUES ($1, $2, NOW())',
          [id, req.userId]
        );
        // Update saves count
        await pool.query(
          'UPDATE posts SET saves_count = saves_count + 1 WHERE id = $1',
          [id]
        );
        return res.json({ saved: true, message: 'Post saved' });
      }
    } catch (e) {
      console.error('Error saving post:', e);
      res.status(500).json({ error: 'Failed to save post' });
    }
  });

  // Get user's likes
  router.get('/user/likes', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT post_id FROM post_likes WHERE user_id = $1`,
        [req.userId]
      );
      res.json({ likedPosts: result.rows.map(r => r.post_id) });
    } catch (e) {
      console.error('Error fetching user likes:', e);
      res.status(500).json({ error: 'Failed to fetch user likes' });
    }
  });

  // Get user's saved posts
  router.get('/user/saves', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT p.id, p.user_id, p.title, p.excerpt, p.tags,
                p.created_at, p.likes_count, p.saves_count,
                u.name as author
         FROM post_saves ps
         JOIN posts p ON ps.post_id = p.id
         JOIN users u ON p.user_id = u.id
         WHERE ps.user_id = $1
         ORDER BY ps.created_at DESC`,
        [req.userId]
      );
      res.json({ savedPosts: result.rows });
    } catch (e) {
      console.error('Error fetching saved posts:', e);
      res.status(500).json({ error: 'Failed to fetch saved posts' });
    }
  });

  // Get user's own posts
  router.get('/user/posts', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, user_id, title, excerpt, tags, created_at, updated_at, likes_count, saves_count
         FROM posts
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.userId]
      );
      res.json({ userPosts: result.rows });
    } catch (e) {
      console.error('Error fetching user posts:', e);
      res.status(500).json({ error: 'Failed to fetch user posts' });
    }
  });

  // Delete a post (only by creator)
  router.delete('/posts/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
      // Check ownership
      const postCheck = await pool.query(
        'SELECT user_id FROM posts WHERE id = $1',
        [id]
      );
      if (postCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found' });
      }
      if (postCheck.rows[0].user_id !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Delete associated likes and saves
      await pool.query('DELETE FROM post_likes WHERE post_id = $1', [id]);
      await pool.query('DELETE FROM post_saves WHERE post_id = $1', [id]);

      // Delete the post
      await pool.query('DELETE FROM posts WHERE id = $1', [id]);
      res.json({ message: 'Post deleted' });
    } catch (e) {
      console.error('Error deleting post:', e);
      res.status(500).json({ error: 'Failed to delete post' });
    }
  });

  return router;
};
