

const { config } = require('../config');

/**
 * Check if OpenRouter is available.
 * It's "available" if the user has set an API key.
 * (We don't ping the server — if the key is set, we assume it works.)
 */
async function isAvailable() {
  return config.OPENROUTER_API_KEY.length > 0;
}

/**
 * Send a chat request to OpenRouter.
 * Uses native fetch (built into Node 18+) — no axios needed.
 */
async function chat(messages) {
  const response = await fetch(`${config.OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://meai.app',
      'X-Title': 'MeAI Engine',
    },
    body: JSON.stringify({
      model: config.OPENROUTER_MODEL,
      messages,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Stream a chat response from OpenRouter using Server-Sent Events (SSE).
 * 
 * HOW SSE STREAMING WORKS:
 * We send { stream: true } in the request. OpenRouter responds with
 * a stream of "data:" lines, each containing a JSON chunk.
 * We parse each chunk and yield the text content.
 * 
 *   data: {"choices":[{"delta":{"content":"Hello"}}]}
 *   data: {"choices":[{"delta":{"content":" there"}}]}
 *   data: [DONE]
 */
async function* stream(messages) {
  const response = await fetch(`${config.OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://meai.app',
      'X-Title': 'MeAI Engine',
    },
    body: JSON.stringify({
      model: config.OPENROUTER_MODEL,
      messages,
      max_tokens: 1024,
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter stream error: ${response.status}`);
  }

  // Read the SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';  // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Skip malformed chunks (happens sometimes)
        }
      }
    }
  }
}

/**
 * Generate embeddings via OpenRouter.
 * Note: Not all OpenRouter models support embeddings.
 * If this fails, the memory system falls back to keyword matching.
 */
async function embed(text) {
  try {
    const response = await fetch(`${config.OPENROUTER_BASE_URL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch {
    return null;  // Embeddings are optional — memory still works without them
  }
}

function getName() {
  return `OpenRouter (${config.OPENROUTER_MODEL})`;
}

module.exports = { isAvailable, chat, stream, embed, getName };
