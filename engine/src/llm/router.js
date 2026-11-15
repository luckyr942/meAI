/**
 * MeAI Engine — LLM Router
 * ═══════════════════════════════════════════════════════
 * 
 * THE MOST IMPORTANT FILE IN THE ENGINE.
 * 
 * The rest of the engine just calls:
 *   const { chat, stream } = require('../llm/router');
 *   const response = await chat(messages);
 * 
 * The Router figures out which provider is available.
 * 
 * ROUTING WATERFALL (3 tiers):
 * ┌─────────────────────────────────────────────────┐
 * │ 1. Ollama running locally?                      │
 * │    → Use Ollama (100% local, free, private)     │
 * ├─────────────────────────────────────────────────┤
 * │ 2. GROQ_API_KEY set?                            │
 * │    → Use Groq (fast cloud, free tier)           │
 * ├─────────────────────────────────────────────────┤
 * │ 3. OPENROUTER_API_KEY set?                      │
 * │    → Use OpenRouter (100+ models)               │
 * ├─────────────────────────────────────────────────┤
 * │ 4. Nothing → Error with setup instructions      │
 * └─────────────────────────────────────────────────┘
 * 
 * FOR NON-TECH USERS:
 * Get a free Groq key (30 seconds, no credit card).
 * Set GROQ_API_KEY in .env → MeAI works immediately.
 * 
 * FOR PRIVACY USERS:
 * Install Ollama → MeAI auto-detects → 100% offline.
 */

const ollamaClient = require('./ollama');
const groqClient = require('./groq');
const openrouterClient = require('./openrouter');

// Provider cache — re-checked every 60 seconds
let activeProvider = null;
let lastCheck = 0;
const CHECK_INTERVAL = 60_000;

/**
 * Determine which LLM provider to use.
 * Tries: Ollama → Groq → OpenRouter
 */
async function getProvider() {
  const now = Date.now();

  if (activeProvider && (now - lastCheck) < CHECK_INTERVAL) {
    return activeProvider;
  }

  // 1. Ollama (local — best for privacy)
  if (await ollamaClient.isAvailable()) {
    activeProvider = ollamaClient;
    lastCheck = now;
    console.log(`🤖 LLM: ${ollamaClient.getName()} [LOCAL]`);
    return activeProvider;
  }

  // 2. Groq (fast cloud — best for non-tech users)
  if (await groqClient.isAvailable()) {
    activeProvider = groqClient;
    lastCheck = now;
    console.log(`⚡ LLM: ${groqClient.getName()} [CLOUD — fast & free]`);
    return activeProvider;
  }

  // 3. OpenRouter (general cloud — most models)
  if (await openrouterClient.isAvailable()) {
    activeProvider = openrouterClient;
    lastCheck = now;
    console.log(`☁️  LLM: ${openrouterClient.getName()} [CLOUD]`);
    return activeProvider;
  }

  throw new Error(
    'No LLM provider available! Choose one:\n\n' +
    '  ⚡ EASIEST: Get a free Groq key (30 sec, no credit card):\n' +
    '     → https://console.groq.com\n' +
    '     → Add GROQ_API_KEY=your-key to .env\n\n' +
    '  🔒 MOST PRIVATE: Install Ollama:\n' +
    '     → brew install ollama && ollama pull llama3.2:3b\n\n' +
    '  ☁️  MOST MODELS: Get an OpenRouter key:\n' +
    '     → https://openrouter.ai/keys\n' +
    '     → Add OPENROUTER_API_KEY=your-key to .env'
  );
}

async function chat(messages) {
  const provider = await getProvider();
  return provider.chat(messages);
}

async function* stream(messages) {
  const provider = await getProvider();
  for await (const chunk of provider.stream(messages)) {
    yield chunk;
  }
}

async function embed(text) {
  const provider = await getProvider();
  return provider.embed(text);
}

async function getProviderName() {
  try {
    const provider = await getProvider();
    return provider.getName();
  } catch {
    return 'No provider';
  }
}

function resetProvider() {
  activeProvider = null;
  lastCheck = 0;
}

module.exports = { chat, stream, embed, getProviderName, resetProvider };
