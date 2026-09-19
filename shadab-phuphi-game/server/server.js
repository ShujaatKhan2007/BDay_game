'use strict';

/**
 * SERVER ENTRY POINT
 * ------------------
 * - Express serves a health-check URL (and the built React app, if present).
 * - Socket.IO handles all real-time game communication.
 * - There is NO database. Game data lives in memory (see gameManager.js).
 *
 * Environment variables (all optional):
 *   PORT              port to listen on (default 3001; cloud hosts set this for you)
 *   CLIENT_ORIGIN     the website address(es) allowed to connect, comma separated.
 *                     Example: https://phuphi-game.vercel.app
 *                     Not needed when Express serves the frontend itself.
 *                     If empty, any origin is allowed (fine for local testing).
 *   MAX_PARTICIPANTS  max players per game (default 60)
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const registerSocketHandlers = require('./socketHandlers');
const M = require('./gameManager');

function createServer() {
  const app = express();

  // ---- CORS: which websites may talk to this server ----
  const origins = (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const corsOrigin = origins.length ? origins : '*';
  app.use(cors({ origin: corsOrigin }));

  // ---- Health check (handy for testing and for uptime pings) ----
  app.get('/health', (_req, res) => {
    res.json({ ok: true, games: M.gameCount(), uptimeSeconds: Math.round(process.uptime()) });
  });

  // ---- Serve the built React app if it exists (single-service deployment) ----
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist));
    // Any other URL (e.g. /join/PUPPY25) gets the React app; React reads the code from the URL.
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  } else {
    app.get('/', (_req, res) => {
      res.type('text').send('Shadab Phuphi Birthday Challenge server is running 🎂\nOpen the React app (npm run dev in /client) to play.');
    });
  }

  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: { origin: corsOrigin },
    maxHttpBufferSize: 3e6, // allow doodles (a few hundred KB each)
    pingInterval: 20000,
    pingTimeout: 30000, // be patient with slow phone connections
  });
  registerSocketHandlers(io);

  // Clean up games nobody has touched for 12 hours (frees memory).
  const cleanup = setInterval(() => M.purgeOldGames(), 60 * 60 * 1000);
  cleanup.unref();

  return { app, httpServer, io };
}

module.exports = { createServer };

// Start listening only when run directly (`node server.js`), not when imported by tests.
if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3001;
  const { httpServer } = createServer();
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🎂 Shadab Phuphi Birthday Challenge server listening on port ${PORT}`);
  });

  // Never let one unexpected error take the whole party down.
  process.on('uncaughtException', (err) => console.error('Uncaught exception:', err));
  process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
}
