/**
 * MeAI Engine — Health Check Route
 * ═══════════════════════════════════════════════════════
 * 
 * A simple endpoint that tells you if the engine is alive
 * and which components are working. Hit GET /health to see:
 *   - Is the database connected?
 *   - Which LLM provider is active?
 *   - How many memories are stored?
 * 
 * WHY HEALTH CHECKS MATTER:
 * 1. The web UI pings this on load to verify the engine is running
 * 2. You can quickly debug issues ("oh, Ollama isn't connected")
 * 3. It's a best practice for any production service
 */

const { Router } = require('express');
const { config } = require('../config');
const { query } = require('../storage/sqlite');
const { getProviderName } = require('../llm/router');

const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const memoryCount = query('SELECT COUNT(*) as count FROM memories')[0]?.count || 0;
  const conversationCount = query('SELECT COUNT(*) as count FROM conversations')[0]?.count || 0;
  const messageCount = query('SELECT COUNT(*) as count FROM messages')[0]?.count || 0;

  let llmProvider;
  try {
    llmProvider = await getProviderName();
  } catch {
    llmProvider = '❌ No provider available';
  }

  res.json({       
    status: 'ok',
    app: config.APP_NAME,
    version: config.APP_VERSION,
    llm: llmProvider,
    storage: `SQLite → ${config.DATA_DIR}/meai.db`,
    stats: {
      memories: memoryCount,
      conversations: conversationCount,
      messages: messageCount,
    },
  });
});

module.exports = { healthRouter };
