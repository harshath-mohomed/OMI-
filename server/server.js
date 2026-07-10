import express from 'express';
import { createServer } from 'http';
import os from 'os';
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

const getLanAddress = () => {
  const interfaces = os.networkInterfaces();

  for (const networkInterface of Object.values(interfaces)) {
    if (!networkInterface) continue;

    for (const address of networkInterface) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }

  return null;
};

const exitOnStartupFailure = (context, error) => {
  console.error(`[CRITICAL] ${context}`, error);
  process.exit(1);
};

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

app.use(express.static(path.join(__dirname, '../public')));

const startServer = async () => {
  try {
    await initializeDatabaseSchema();

    const redisUrl = process.env.REDIS_URL?.trim();
    if (redisUrl) {
      const redisClient = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: () => false
        }
      });

      let redisErrorLogged = false;
      redisClient.on('error', (err) => {
        if (redisErrorLogged) return;
        redisErrorLogged = true;
        console.error('[ERROR] Native Redis Connection Failure:', err);
      });

      try {
        await redisClient.connect();
        console.log('[INFO] Native Redis Interface Active.');
      } catch (error) {
        console.warn('[WARN] Redis unavailable at startup; continuing without Redis-backed cache.', error);
      }
    } else {
      console.warn('[WARN] REDIS_URL is not set; continuing without Redis-backed cache.');
    }

    // Instantiate Pure Domain Components with New Repositories
    const playerRepo = new PlayerRepository(pool);
    const matchRepo = new MatchRepository(pool);
    const engine = new GameEngine(playerRepo, matchRepo);

    // Bind WebSockets Layer (Ensuring optimized transport configuration)
    initializeSocketLayer(httpServer, engine);

    httpServer.on('error', (error) => {
      exitOnStartupFailure(`Server failed to bind on ${CONFIG.HOST}:${CONFIG.PORT}.`, error);
    });

    httpServer.listen(CONFIG.PORT, CONFIG.HOST, () => {
      const lanAddress = getLanAddress();
      const bindHost = CONFIG.HOST || '0.0.0.0';
      const localUrl = `http://localhost:${CONFIG.PORT}`;
      const networkUrl = lanAddress ? `http://${lanAddress}:${CONFIG.PORT}` : null;

      console.log(`[INFO] Authoritative OMI Stack running on ${bindHost}:${CONFIG.PORT}`);
      console.log(`[INFO] Open locally: ${localUrl}`);

      if (networkUrl) {
        console.log(`[INFO] Other devices on the same Wi-Fi can use: ${networkUrl}`);
      }
    });
  } catch (error) {
    exitOnStartupFailure('PostgreSQL startup failed. The server did not bind to a port.', error);
  }
};

startServer();