import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv'; // Import dotenv

// Load your local network environment variables from the .env file
dotenv.config();

import { CONFIG } from './config.js';
import { GameEngine } from './engine/GameEngine.js';
import { initializeSocketLayer } from './socket.js';
import { PlayerRepository } from './database/PlayerRepository.js';
import { MatchRepository } from './database/MatchRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

// Initialize PostgreSQL Pool using your local environment variables
const pool = new pg.Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: parseInt(process.env.PGPORT || '5432')
});

// Structural Schema Initialization check for native PostgreSQL
const initializeDatabaseSchema = async () => {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS players (id VARCHAR(50) PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS matches (id VARCHAR(50) PRIMARY KEY, room_code VARCHAR(10) NOT NULL, winner_team VARCHAR(2) NOT NULL, score_a INTEGER NOT NULL, score_b INTEGER NOT NULL, played_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS player_stats (player_id VARCHAR(50) PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE, matches_played INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0);
  `;
  await pool.query(schemaSql);
  console.log('[INFO] Native PostgreSQL Schema verified successfully.');
};
initializeDatabaseSchema().catch(err => console.error('[CRITICAL] Local Postgres Connection Error:', err));

// Connect to native Redis running locally on your hardware
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('[ERROR] Native Redis Connection Failure:', err));
await redisClient.connect().then(() => console.log('[INFO] Native Redis Interface Active.'));

// Instantiate Pure Domain Components with New Repositories
const playerRepo = new PlayerRepository(pool);
const matchRepo = new MatchRepository(pool);
const engine = new GameEngine(playerRepo, matchRepo);

// Bind WebSockets Layer (Ensuring optimized transport configuration)
initializeSocketLayer(httpServer, engine);

app.use(express.static(path.join(__dirname, '../public')));

httpServer.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`[INFO] Authoritative OMI Stack running on native port environment: http://localhost:${CONFIG.PORT}`);
});