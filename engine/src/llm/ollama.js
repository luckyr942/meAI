/**
 * MeAI Engine — Ollama Client (Local LLM)
 * ═══════════════════════════════════════════════════════
 * 
 * WHAT IS OLLAMA?
 * Ollama is a tool that runs AI models on YOUR computer.
 * No cloud. No API key. No data leaving your machine.
 * Models like Llama 3.2 run entirely in your RAM/GPU.
 * 
 * WHY THIS FILE EXISTS:
 * This wraps the Ollama SDK into a clean interface that the
 * LLM Router (router.js) can call. The router doesn't care
 * whether it's talking to Ollama or OpenRouter — same interface.
 * 
 * INTERFACE CONTRACT:
 * Every LLM provider must implement:
 *   1. isAvailable()     → can we reach this provider?
 *   2. chat(messages)    → send messages, get response
 *   3. stream(messages)  → send messages, get streaming response
 *   4. embed(text)       → convert text to vector (for memory search)
 * 
 * This is the ADAPTER PATTERN — same interface, different backends.
 * When you add a SaaS mode later, you just create a new adapter.
 */

const { Ollama } = require('ollama');
const { config } = require('../config');

// Create Ollama client pointing to local server
const ollama = new Ollama({ host: config.OLLAMA_BASE_URL });

/**
 * Check if Ollama is running on this machine.
 * 
 * HOW: We ping the Ollama server. If it responds, it's running.
 * This is called by the LLM Router to decide which provider to use.
 * 
 * WHY TRY/CATCH:
 * If Ollama isn't installed or isn't running, the fetch will throw
 * a connection refused error. We catch it and return false.
 */
async function isAvailable() {
  try {
    // Ollama's list endpoint returns available models
    const response = await fetch(`${config.OLLAMA_BASE_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Send a chat request and get a complete response.
 * 
 * @param {Array} messages - OpenAI-format messages:
 *   [{ role: 'system', content: '...' }, { role: 'user', content: 'hello' }]
 * @returns {string} - The AI's response text
 * 
 * WHY OPENAI FORMAT?
 * Even though this is Ollama, we use OpenAI's message format
 * because it's the industry standard. Both Ollama and OpenRouter
 * accept it. This means the Router doesn't need to convert formats.
 */
async function chat(messages) {
  const response = await ollama.chat({
    model: config.OLLAMA_MODEL,
    messages,
    stream: false,
  });

  return response.message.content;
}

/**
 * Send a chat request and get a STREAMING response.
 * 
 * This is an async generator function (notice the * after function).
 * It yields chunks of text as the AI generates them.
 * 
 * WHY STREAMING?
 * Without streaming, the user stares at a blank screen for 5-10 seconds
 * while the AI thinks. With streaming, text appears word-by-word,
 * making the experience feel fast and alive.
 * 
 * HOW ASYNC GENERATORS WORK:
 *   async function* myGenerator() {
 *     yield "first chunk";
 *     yield "second chunk";
 *   }
 * 
 *   for await (const chunk of myGenerator()) {
 *     console.log(chunk); // prints "first chunk", then "second chunk"
 *   }
 */
async function* stream(messages) {
  const response = await ollama.chat({
    model: config.OLLAMA_MODEL,
    messages,
    stream: true,
  });

  // response is an async iterable — we loop through chunks
  for await (const chunk of response) {
    const content = chunk.message?.content;
    if (content) {
      yield content;
    }
  }
}

/**
 * Generate a vector embedding for text.
 * 
 * WHAT IS AN EMBEDDING?
 * It's a list of numbers (like [0.1, -0.3, 0.7, ...]) that represents
 * the MEANING of the text. Texts with similar meanings have similar numbers.
 * 
 * WHY WE NEED THIS:
 * When you say "I love coffee", we embed it → [0.2, 0.8, -0.1, ...]
 * When you later ask "what drinks do I like?", we embed that question
 * and find memories with similar embeddings. "coffee" and "drinks"
 * have similar embeddings even though the WORDS are different.
 * 
 * This is SEMANTIC SEARCH — searching by meaning, not keywords.
 */
async function embed(text) {
  const response = await ollama.embed({
    model: config.OLLAMA_MODEL,
    input: text,
  });

  // Ollama returns { embeddings: [[0.1, -0.3, ...]] }
  return response.embeddings[0];
}

/**
 * Get the provider name (used for logging and settings UI).
 */
function getName() {
  return `Ollama (${config.OLLAMA_MODEL})`;
}

module.exports = { isAvailable, chat, stream, embed, getName };

const ollama = require("ollama");
const {chat}