/**
 * MeAI Conversation Engine
 * Handles OpenRouter API calls with free models, conversation state, and response generation.
 * 
 * Primary:  nvidia/nemotron-3-super-120b-a12b:free
 * Fallback: arcee-ai/trinity-large-preview:free
 */

const { v4: uuidv4 } = require('uuid');
const { config } = require('../config');
const { VALID_MOODS } = require('../constants');
const { getCompanionSystemPrompt } = require('./prompts');
const { getMemorySummary } = require('./memory-store');
const { extractMemories } = require('./memory-extractor');

// ── In-memory conversation store (Phase 1) ──────────────
const conversations = new Map();

// ── OpenRouter API call ─────────────────────────────────

async function callOpenRouter(messages, model = null, maxTokens = 1024) {
  const selectedModel = model || config.PRIMARY_MODEL;

  const response = await fetch(`${config.OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://meai.app',
      'X-Title': 'MeAI Companion',
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Call primary model, fall back to Trinity if it fails or takes too long.
 */
async function callWithFallback(messages, maxTokens = 1024) {
  try {
    // Try primary model (Nemotron)
    console.log(`🤖 Using: ${config.PRIMARY_MODEL}`);
    const result = await callOpenRouter(messages, config.PRIMARY_MODEL, maxTokens);
    
    if (result && result.trim().length > 0) {
      return result;
    }
    throw new Error('Empty response from primary model');
  } catch (primaryError) {
    console.log(`⚠️  Primary model failed: ${primaryError.message?.substring(0, 100)}`);
    console.log(`🔄 Falling back to: ${config.FALLBACK_MODEL}`);
    
    try {
      const fallbackResult = await callOpenRouter(messages, config.FALLBACK_MODEL, maxTokens);
      return fallbackResult;
    } catch (fallbackError) {
      console.error(`❌ Both models failed. Fallback error: ${fallbackError.message?.substring(0, 100)}`);
      throw new Error('Both primary and fallback models failed. Please try again later.');
    }
  }
}

// ── Helpers ─────────────────────────────────────────────

function getOrCreateConversation(conversationId) {
  if (conversationId && conversations.has(conversationId)) {
    return [conversationId, conversations.get(conversationId)];
  }

  const newId = uuidv4();
  conversations.set(newId, []);
  return [newId, conversations.get(newId)];
}

/**
 * Convert history to OpenAI-compatible messages format.
 */
function buildMessages(systemPrompt, history) {
  return [
    { role: 'system', content: systemPrompt },
    ...history.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  ];
}

// ── Instant Mood Detection (no API call — keyword-based) ─

function detectMood(message) {
  const lower = message.toLowerCase();

  const moodKeywords = {
    joyful:     ['happy', 'joy', 'amazing', 'wonderful', 'love', 'awesome', 'fantastic', 'great', 'best', 'yay', '😊', '😄', '🎉', '❤️'],
    excited:    ['excited', 'can\'t wait', 'hyped', 'pumped', 'stoked', 'thrilled', 'omg', '🔥', '🚀', '!!!'],
    calm:       ['peaceful', 'calm', 'relaxed', 'chill', 'serene', 'quiet', 'content', 'okay'],
    anxious:    ['anxious', 'worried', 'nervous', 'scared', 'afraid', 'stress', 'panic', 'overwhelm', 'overthink'],
    sad:        ['sad', 'depressed', 'lonely', 'miss', 'crying', 'heartbroken', 'lost', 'empty', 'down', '😢', '😞'],
    frustrated: ['frustrated', 'annoyed', 'ugh', 'stuck', 'hate', 'stupid', 'broken', 'tired of', 'sick of'],
    angry:      ['angry', 'furious', 'rage', 'pissed', 'mad', 'livid', 'wtf'],
  };

  for (const [mood, keywords] of Object.entries(moodKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return mood;
    }
  }

  return 'neutral';
}

// ── Main Chat Function ──────────────────────────────────

async function chat(message, conversationId) {
  const [convId, history] = getOrCreateConversation(conversationId);

  // Detect mood instantly (no API call)
  const detectedMood = detectMood(message);

  // Add user message to history
  history.push({
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  });

  // Build messages with system prompt + injected memories
  const memorySummary = getMemorySummary();
  const messages = buildMessages(getCompanionSystemPrompt(memorySummary), history);

  // Call with fallback
  const responseText = await callWithFallback(messages);

  // Add assistant response to history
  history.push({
    role: 'assistant',
    content: responseText,
    timestamp: new Date().toISOString(),
  });

  // Keep conversation manageable (last 50 messages)
  if (history.length > 50) {
    conversations.set(convId, history.slice(-50));
  }

  // Extract memories in background (non-blocking)
  extractMemories(history).catch(() => {});

  return { response: responseText, conversationId: convId, detectedMood };
}

// ── Streaming Chat (SSE via OpenRouter) ─────────────────

async function* streamChat(message, conversationId) {
  const [convId, history] = getOrCreateConversation(conversationId);

  history.push({
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  });

  yield { type: 'conversation_id', data: convId };

  const memorySummary = getMemorySummary();
  const messages = buildMessages(getCompanionSystemPrompt(memorySummary), history);
  let selectedModel = config.PRIMARY_MODEL;
  let fullResponse = '';

  try {
    // Try streaming with primary model
    console.log(`🤖 Streaming: ${selectedModel}`);
    const response = await fetch(`${config.OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://meai.app',
        'X-Title': 'MeAI Companion',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        max_tokens: 1024,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Stream failed: ${response.status}`);
    }

    // Parse SSE stream
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
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              yield { type: 'text_delta', data: content };
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }
  } catch (streamError) {
    console.log(`⚠️  Stream failed, falling back to non-stream: ${streamError.message?.substring(0, 80)}`);

    // Fallback: non-streaming call
    fullResponse = await callWithFallback(messages);
    yield { type: 'text_delta', data: fullResponse };
  }

  // Save assistant response
  history.push({
    role: 'assistant',
    content: fullResponse,
    timestamp: new Date().toISOString(),
  });

  if (history.length > 50) {
    conversations.set(convId, history.slice(-50));
  }

  // Detect mood (instant — no API call)
  const detectedMood = detectMood(message);
  if (detectedMood) {
    yield { type: 'mood', data: detectedMood };
  }

  // Extract memories in background (non-blocking)
  extractMemories(history).catch(() => {});

  yield { type: 'done', data: '' };
}

module.exports = { chat, streamChat };
