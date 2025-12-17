const express = require('express');
const fs = require('fs');
const path = require('path');
// Use local file storage instead of S3
const { uploadLocal } = require('../config/local-upload');

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = function makeUserRoutes({ pool, jwtSecret }) {
  const router = express.Router();

  // Get user profile with photo
  router.get('/user/profile', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, name, email, profile_photo FROM users WHERE id = $1',
        [req.user.sub]
      );
      const user = result.rows[0];
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Upload profile photo
  router.post('/user/profile-photo', verifyToken, uploadLocal.single('photo'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Build the photo URL (accessible via /uploads/profile-photos/filename.jpg)
      const photoUrl = `/uploads/profile-photos/${req.file.filename}`;

      // Get the old photo to delete it from local storage
      const oldPhotoResult = await pool.query(
        'SELECT profile_photo FROM users WHERE id = $1',
        [req.user.sub]
      );

      const oldPhoto = oldPhotoResult.rows[0]?.profile_photo;
      if (oldPhoto && oldPhoto.startsWith('/uploads/')) {
        // Delete old local file
        try {
          const oldFilePath = path.join(__dirname, '..', oldPhoto);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        } catch (deleteError) {
          console.error('Error deleting old photo from local storage:', deleteError);
        }
      }

      // Update user profile with new photo URL
      const result = await pool.query(
        'UPDATE users SET profile_photo = $1 WHERE id = $2 RETURNING id, name, email, profile_photo',
        [photoUrl, req.user.sub]
      );

      const user = result.rows[0];
      res.json(user);
    } catch (e) {
      console.error('Upload error:', e);
      res.status(500).json({ error: 'Server error during upload' });
    }
  });

  // Update user profile (name, etc.)
  router.put('/user/profile', verifyToken, async (req, res) => {
    try {
      const { name } = req.body || {};
      if (!name) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await pool.query(
        'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, profile_photo',
        [name, req.user.sub]
      );

      const user = result.rows[0];
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Delete profile photo
  router.delete('/user/profile-photo', verifyToken, async (req, res) => {
    try {
      const photoResult = await pool.query(
        'SELECT profile_photo FROM users WHERE id = $1',
        [req.user.sub]
      );

      const photo = photoResult.rows[0]?.profile_photo;
      if (photo && photo.startsWith('/uploads/')) {
        // Delete local file
        try {
          const filePath = path.join(__dirname, '..', photo);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (deleteError) {
          console.error('Error deleting photo from local storage:', deleteError);
        }
      }

      const result = await pool.query(
        'UPDATE users SET profile_photo = NULL WHERE id = $1 RETURNING id, name, email, profile_photo',
        [req.user.sub]
      );

      const user = result.rows[0];
      res.json(user);
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};
