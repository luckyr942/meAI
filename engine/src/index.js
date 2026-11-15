/**
 * MeAI Engine — Entry Point
 * ═══════════════════════════════════════════════════════
 * 
 * THIS IS WHERE EVERYTHING BEGINS.
 * 
 * When you run `npm run dev`, Node.js executes this file.
 * It does 3 things in order:
 * 
 * 1. INITIALIZE — Boot the database (async because sql.js uses WASM)
 * 2. CONFIGURE  — Create Express app, add middleware, mount routes
 * 3. LISTEN     — Start the HTTP + WebSocket server
 * 
 * WHY IS boot() AN ASYNC FUNCTION?
 * Because sql.js loads WebAssembly, which is asynchronous.
 * We can't set up routes that need the DB until it's ready.
 * So we wrap everything in an async boot() and await initDB().
 * 
 * THE LAYER CAKE:
 * ┌──────────────────────────────┐
 * │  HTTP Request from Web/App   │
 * ├──────────────────────────────┤
 * │  Express Middleware (cors)   │
 * ├──────────────────────────────┤
 * │  Routes (/api/chat, /health) │
 * ├──────────────────────────────┤
 * │  Engine (conversation, llm)  │
 * ├──────────────────────────────┤
 * │  Storage (SQLite)            │
 * └──────────────────────────────┘
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { config } = require('./config');
const { initDB } = require('./storage/sqlite');

// ── Route imports ───────────────────────────────────
const { healthRouter } = require('./routes/health');

// ── Boot Sequence ───────────────────────────────────
async function boot() {

  // ── Step 1: Initialize Database ─────────────────
  // This MUST happen before anything else.
  // Routes need the DB to work. LLM router needs config.
  await initDB();

  // ── Step 2: Create Express App ──────────────────
  const app = express();
  const server = http.createServer(app);

  // ── Middleware ───────────────────────────────────
  // cors() — allows web UI (localhost:3000) to talk to engine (localhost:8000)
  // express.json() — parses JSON request bodies (for POST /api/chat)
  app.use(cors({ origin: config.CORS_ORIGINS }));
  app.use(express.json());

  // ── Mount Routes ────────────────────────────────
  // Each route file handles one domain (health, chat, memory, etc.)
  // We mount them under different paths.
  app.use('/', healthRouter);
  // app.use('/api', chatRouter);          // ← Phase 2
  // app.use('/api', memoryRouter);        // ← Phase 2
  // app.use('/api', conversationRouter);  // ← Phase 2

  // ── Root Endpoint ───────────────────────────────
  // Quick "is it alive?" check
  app.get('/', (_req, res) => {
    res.json({
      name: config.APP_NAME,
      version: config.APP_VERSION,
      tagline: 'Your Personal AI that runs on YOUR machine.',
      docs: '/health',
    });
  });

  // ── Step 3: Start Server ────────────────────────
  server.listen(config.PORT, config.HOST, () => {
    console.log('');
    console.log(`🧠 ═══════════════════════════════════════════`);
    console.log(`   ${config.APP_NAME} Engine v${config.APP_VERSION}`);
    console.log(`   URL:     http://${config.HOST}:${config.PORT}`);
    console.log(`   Storage: ${config.DATA_DIR}/meai.db`);
    console.log(`   Health:  http://localhost:${config.PORT}/health`);
    console.log(`🧠 ═══════════════════════════════════════════`);
    console.log('');
  });
}

// ── Launch ──────────────────────────────────────────
boot().catch((err) => {
  console.error('❌ MeAI Engine failed to boot:', err);
  process.exit(1);
});
