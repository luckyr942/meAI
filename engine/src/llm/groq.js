/**
 * MeAI Engine — Groq Client (Free Cloud LLM — Zero Signup!)
 * ═══════════════════════════════════════════════════════
 * 
 * WHY THIS FILE EXISTS:
 * This is the DEFAULT for non-tech users.
 * 
 * THE PROBLEM:
 * - Ollama requires installation → too hard for non-tech users
 * - OpenRouter requires signup + API key → too much friction
 * - We need something that works IMMEDIATELY with zero setup
 * 
 * THE SOLUTION:
 * Groq offers free AI models with extremely fast inference.
 * We ship a default API key with rate limits so that when a
 * non-tech user runs MeAI for the first time, it just WORKS.
 * 
 * USER TIERS:
 * ┌─────────────────────────────────────────────────────┐
 * │  Tier 1: NON-TECH USER                              │
 * │  → Uses built-in Groq free key                      │
 * │  → Zero setup. It just works.                       │
 * │  → Rate limited (but fine for personal use)          │
 * ├─────────────────────────────────────────────────────┤
 * │  Tier 2: PRIVACY USER                               │
 * │  → Installs Ollama (brew install ollama)             │
 * │  → 100% local. No data leaves their machine.         │
 * ├─────────────────────────────────────────────────────┤
 * │  Tier 3: POWER USER                                 │
 * │  → Brings their own API key (OpenRouter, Groq, etc.) │
 * │  → Access to GPT-4, Claude, Llama 70B, etc.          │
 * └─────────────────────────────────────────────────────┘
 * 
 * SAME INTERFACE as ollama.js and openrouter.js:
 * isAvailable(), chat(), stream(), embed(), getName()
 */

const { config } = require('../config');

// Groq's API is OpenAI-compatible, making it easy to integrate
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// The model to use — Llama 3.2 3B is fast and free on Groq
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Get the Groq API key.
 * Priority: user's own key → built-in free key
 */
function getApiKey() {
  // If user set their own Groq key, use that (no rate limits)
  if (config.GROQ_API_KEY) {
    return config.GROQ_API_KEY;
  }

  // Otherwise, return empty — user needs to set one
  // In production, you'd embed a rate-limited key here
  // For now, users must get a free key at console.groq.com
  return '';
}

/**
 * Check if Groq is available.
 * Available if we have an API key (built-in or user-provided).
 */
async function isAvailable() {
  return getApiKey().length > 0;
}

/**
 * Non-streaming chat.
 */
async function chat(messages) {
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Streaming chat — same SSE pattern as OpenRouter.
 */
async function* stream(messages) {
  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq stream error: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }
}

/**
 * Groq doesn't have a public embeddings API yet.
 * Return null — the memory system falls back to keyword matching.
 */
async function embed(text) {
  return null;
}

function getName() {
  return `Groq (${GROQ_MODEL})`;
}

module.exports = { isAvailable, chat, stream, embed, getName };
