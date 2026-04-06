/**
 * MeAI Configuration
 * Loads environment variables with sensible defaults.
 */

const path = require('path');

// Load .env from project root (meai/.env), using absolute path to avoid CWD issues
// override: true ensures .env values take priority over system env vars
const envPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: envPath, override: true });

const config = {
  APP_NAME: 'MeAI',
  APP_VERSION: '0.1.0',
  DEBUG: process.env.DEBUG === 'true',

  // ── AI Platforms (LLM) ──────────────────────────────────
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY || '',
  
  // Model prioritization (Groq for speed, OpenRouter for logic, HF for backup)
  PRIMARY_MODEL: process.env.PRIMARY_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
  FALLBACK_MODEL: process.env.FALLBACK_MODEL || 'arcee-ai/trinity-large-preview:free',
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
  GROQ_BASE_URL: 'https://api.groq.com/openai/v1',

  // ── Environment Services ──────────────────────────────
  MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/meai_jobs',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // ── Google API Config (Gmail OAuth) ───────────────────
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:8000/auth/callback',

  // ── Server ────────────────────────────────────────────
  PORT: parseInt(process.env.BACKEND_PORT || '8000', 10),
  HOST: process.env.HOST || '0.0.0.0',

  // ── CORS ──────────────────────────────────────────────
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
};

module.exports = { config };
