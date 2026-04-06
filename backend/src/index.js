/**
 * MeAI v2.0 — Local-First Personal AI Platform
 * Zero cloud dependencies. All data lives on your machine.
 */

const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const { config } = require('./config');
const { chatRouter } = require('./routes/chat');
const { memoryRouter } = require('./routes/memory');
const { authRouter } = require('./routes/auth');
const { webhookRouter } = require('./routes/webhooks');
const { jobsRouter } = require('./routes/jobs');
const { financeRouter } = require('./routes/finance');
const { journalRouter } = require('./routes/journal');
const { streamChat } = require('./engine/conversation');
const { initDB, MEAI_DIR } = require('./config/db');

// ── Boot Sequence ───────────────────────────────────────
async function boot() {
  // Initialize SQLite (async because sql.js uses WebAssembly)
  await initDB();
  console.log('📦 SQLite initialized successfully.');

  // Preload Queue Workers (registers job handlers)
  require('./engine/jobQueue');

  // ── Create Express App ──────────────────────────────────
  const app = express();
  const server = http.createServer(app);

  // ── Middleware ───────────────────────────────────────────
  app.use(cors({ origin: config.CORS_ORIGINS }));
  app.use(express.json());

  // ── Routes ──────────────────────────────────────────────
  app.use('/api', chatRouter);
  app.use('/api', memoryRouter);
  app.use('/api/webhooks', webhookRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/finance', financeRouter);
  app.use('/api/journal', journalRouter);
  app.use('/auth', authRouter);

  // ── Health Check ────────────────────────────────────────
  app.get('/health', (_req, res) => {
    const { jobQueue } = require('./engine/jobQueue');
    res.json({
      status: 'ok',
      version: config.APP_VERSION,
      storage: 'SQLite (local)',
      dataDir: MEAI_DIR,
      queue: jobQueue.status(),
      modules: {
        jobTracker: true,
        financeTracker: true,
        journal: true,
        chat: true,
      },
      ai: {
        primary: config.PRIMARY_MODEL,
        fallback: config.FALLBACK_MODEL,
        openrouter: config.OPENROUTER_API_KEY ? '✅' : '⚠️',
      },
    });
  });

  // ── Root ────────────────────────────────────────────────
  app.get('/', (_req, res) => {
    res.json({
      name: 'MeAI',
      version: config.APP_VERSION,
      tagline: 'Your local-first AI life assistant.',
      docs: '/health',
      modules: ['Job Tracker', 'Finance Tracker', 'Smart Journal', 'AI Chat'],
      privacy: 'All data stored locally in ~/.meai/ — zero cloud dependency.',
    });
  });

  // ── WebSocket Server for Streaming ──────────────────────
  const wss = new WebSocketServer({ server, path: '/api/chat/stream' });

  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');

    ws.on('message', async (data) => {
      try {
        const payload = JSON.parse(data.toString());
        const { message, conversation_id } = payload;

        if (!message) {
          ws.send(JSON.stringify({ type: 'error', data: 'Message cannot be empty' }));
          return;
        }

        for await (const chunk of streamChat(message, conversation_id)) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(chunk));
          }
        }
      } catch (error) {
        console.error('❌ WebSocket error:', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'error',
            data: error.message || 'Unknown error',
          }));
        }
      }
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
    });
  });

  // ── Start Server ────────────────────────────────────────
  server.listen(config.PORT, config.HOST, () => {
    console.log('');
    console.log(`🧠 ${config.APP_NAME} v${config.APP_VERSION} is running!`);
    console.log(`   URL: http://${config.HOST}:${config.PORT}`);
    console.log(`   Storage: SQLite → ${MEAI_DIR}/meai.db`);
    console.log(`   Queue: In-Process (no Redis)`);
    console.log(`   AI: ${config.PRIMARY_MODEL}`);
    console.log(`   Modules: Job Tracker | Finance | Journal | Chat`);
    console.log(`   OpenRouter: ${config.OPENROUTER_API_KEY ? '✅ configured' : '⚠️  OPENROUTER_API_KEY not set!'}`);
    console.log('');
  });
}

// ── Launch ──────────────────────────────────────────────
boot().catch((err) => {
  console.error('❌ MeAI failed to boot:', err);
  process.exit(1);
});
