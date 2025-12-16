const express = require('express');
const jwt = require('jsonwebtoken');

function authMiddleware(jwtSecret) {
  return function (req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    try {
      const payload = jwt.verify(token, jwtSecret);
      req.userId = payload.sub;
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }
}

module.exports = function makeSurveyRoutes({ pool, jwtSecret }) {
  const router = express.Router();
  const requireAuth = authMiddleware(jwtSecret);

  router.post('/survey', requireAuth, async (req, res) => {
    const surveyData = req.body || {};
    try {
      await pool.query(
        `INSERT INTO user_profiles (user_id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (user_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [req.userId, JSON.stringify(surveyData)]
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.get('/survey', requireAuth, async (req, res) => {
    try {
      const result = await pool.query('SELECT data FROM user_profiles WHERE user_id = $1', [req.userId]);
      const row = result.rows[0];
      res.json({ data: row ? row.data : null });
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}
