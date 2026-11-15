/**
 * MeAI Engine — Configuration
 * ═══════════════════════════════════════════════════════
 * 
 * WHY THIS FILE EXISTS:
 * Every system needs a single source of truth for its settings.
 * Instead of reading process.env everywhere (messy), we load it
 * once here and export a clean object that every file imports.
 * 
 * HOW IT WORKS:
 * 1. Loads .env file from the project root (meai/.env)
 * 2. Maps env vars to a structured config object
 * 3. Sets sensible defaults so the engine works even with zero config
 * 
 * DESIGN DECISION:
 * Notice there are TWO LLM providers configured:
 *   - Ollama (local, free, private) → DEFAULT
 *   - OpenRouter (cloud, needs API key) → FALLBACK
 * This is the core of "local-first" — Ollama runs on YOUR machine,
 * OpenRouter is optional for users who want smarter cloud models.
 */

const path = require('path');
const os = require('os');

// Load .env from project root (meai/.env), not from engine/
const envPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: envPath });

const config = {

  // ── App Identity ────────────────────────────────────
  APP_NAME: 'MeAI',
  APP_VERSION: '2.0.0',
  DEBUG: process.env.DEBUG === 'true',

  // ── Local LLM (Ollama) ─────────────────────────────
  // This is the DEFAULT. Runs on the user's machine. Free. Private.
  // Users install Ollama (brew install ollama) and pull a model.
  // The engine auto-detects if Ollama is running.
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama3.2:3b',

  // ── Cloud LLM (OpenRouter) — Optional Fallback ─────
  // Only used if Ollama is not running AND user has an API key.
  // Free models available at openrouter.ai
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',

  // ── Cloud LLM (Groq) — Fast & Free ────────────────
  // Groq is the easiest option for non-tech users.
  // Get a free key in 30 seconds at: https://console.groq.com
  // No credit card needed. Generous free tier.
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',

  // ── Storage ────────────────────────────────────────
  // All data lives in ~/.meai/ on the user's machine.
  // This means: uninstall the app, your data stays.
  // Reinstall the app, your memories are still there.
  DATA_DIR: process.env.MEAI_DATA_DIR || path.join(os.homedir(), '.meai'),

  // ── Server ─────────────────────────────────────────
  PORT: parseInt(process.env.ENGINE_PORT || '4545', 10),
  HOST: process.env.HOST || '0.0.0.0',

  // ── CORS (who can talk to the engine) ──────────────
  // Default: allow everything (for local dev).
  // In production/SaaS mode, lock this down.
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : '*',
};

module.exports = { config };
