// Basic Express backend for auth with PostgreSQL/MySQL (via env)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Config via env vars
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// PostgreSQL pool (set DATABASE_URL or individual vars)
// Example DATABASE_URL: postgres://user:pass@host:5432/dbname
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: process.env.DB_SSL ? { rejectUnauthorized: false } : false,
});

async function ensureSchema() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT NOW()
		);
	`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS user_profiles (
			user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
			data JSONB NOT NULL DEFAULT '{}'::jsonb,
			updated_at TIMESTAMP DEFAULT NOW()
		);
	`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS posts (
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
	`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS post_likes (
			id SERIAL PRIMARY KEY,
			post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at TIMESTAMP DEFAULT NOW(),
			UNIQUE(post_id, user_id)
		);
	`);
	await pool.query(`
		CREATE TABLE IF NOT EXISTS post_saves (
			id SERIAL PRIMARY KEY,
			post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at TIMESTAMP DEFAULT NOW(),
			UNIQUE(post_id, user_id)
		);
	`);
}

app.get('/health', async (req, res) => {
	try {
		await pool.query('SELECT 1');
		res.json({ ok: true });
	} catch (e) {
		res.status(500).json({ ok: false, error: e.message });
	}
});

// Wire modular routes
const makeAuthRoutes = require('./routes/auth');
const makeSurveyRoutes = require('./routes/survey');
const makePostsRoutes = require('./routes/posts');

app.use('/api', makeAuthRoutes({ pool, jwtSecret: JWT_SECRET }));
app.use('/api', makeSurveyRoutes({ pool, jwtSecret: JWT_SECRET }));
app.use('/api', makePostsRoutes({ pool, jwtSecret: JWT_SECRET }));

// Start server
ensureSchema()
	.then(() => app.listen(PORT, () => console.log(`Auth server running on port ${PORT}`)))
	.catch((e) => {
		console.error('Failed to init schema', e);
		process.exit(1);
	});

