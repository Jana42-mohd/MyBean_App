// Basic Express backend for auth with PostgreSQL/MySQL
require('dotenv').config();  // Enable for environment variables
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Config via hardcoded values
const PORT = 4000;
const JWT_SECRET = 'mybean-super-secure-jwt-secret-key-2024';

// Hardcoded RDS Database Configuration
// RDS Endpoint: user-information.cellg5n8wcin.us-east-1.rds.amazonaws.com
const DATABASE_URL = 'postgresql://postgres:Jenny22072004@user-information.cellg5n8wcin.us-east-1.rds.amazonaws.com:5432/MyBean';

// PostgreSQL pool with hardcoded connection
const pool = new Pool({
	connectionString: DATABASE_URL,
	ssl: { rejectUnauthorized: false }, // RDS requires SSL
});

async function ensureSchema() {
	await pool.query(`
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			profile_photo TEXT,
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
const makeUserRoutes = require('./routes/user');

app.use('/api', makeAuthRoutes({ pool, jwtSecret: JWT_SECRET }));
app.use('/api', makeSurveyRoutes({ pool, jwtSecret: JWT_SECRET }));
app.use('/api', makePostsRoutes({ pool, jwtSecret: JWT_SECRET }));
app.use('/api', makeUserRoutes({ pool, jwtSecret: JWT_SECRET }));

// Start server
ensureSchema()
	.then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Auth server running on port ${PORT}`)))
	.catch((e) => {
		console.error('Failed to init schema', e);
		process.exit(1);
	});

