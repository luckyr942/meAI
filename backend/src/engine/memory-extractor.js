/**
 * MeAI Memory Extractor
 * Uses the AI to extract structured facts from conversations.
 * Runs after each chat response (non-blocking).
 */

const { config } = require('../config');
const { addMemories } = require('./memory-store');

const EXTRACTION_PROMPT = `You are a memory extraction engine. Analyze this conversation and extract KEY FACTS about the user.

Return ONLY a JSON array. Each item must have:
- "type": one of "fact", "person", "preference", "event", "emotion"
- "content": a short, clear statement (max 15 words)
- "importance": 0.0 to 1.0 (how important is this to remember?)

Types guide:
- "fact" → personal info (name, age, job, school, location)
- "person" → people they mention (family, friends, colleagues)
- "preference" → things they like/dislike
- "event" → upcoming or past events they mention
- "emotion" → recurring emotional patterns

ONLY extract REAL facts directly stated by the user. Never infer or assume.
If there's nothing worth remembering, return an empty array: []

Example output:
[{"type":"fact","content":"Name is Lucky","importance":0.9},{"type":"person","content":"Has a sister named Priya","importance":0.8}]

Conversation:
{conversation}

Extract memories (JSON array only, no explanation):`;

/**
 * Extract memories from a conversation (non-blocking).
 * This runs in the background after each chat response.
 */
async function extractMemories(conversationHistory) {
  try {
    // Only process if there are at least 2 messages (user + assistant)
    if (conversationHistory.length < 2) return;

    // Build conversation text from recent messages
    const recentMessages = conversationHistory.slice(-6); // Last 3 exchanges
    const conversationText = recentMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'MeAI'}: ${m.content}`)
      .join('\n');

    const prompt = EXTRACTION_PROMPT.replace('{conversation}', conversationText);

    // Call the fallback model (lighter, faster) for extraction
    const response = await fetch(`${config.OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://meai.app',
        'X-Title': 'MeAI Memory Extractor',
      },
      body: JSON.stringify({
        model: config.FALLBACK_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.log(`⚠️  Memory extraction API error: ${response.status}`);
      return;
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';

    // Parse JSON from the response (handle markdown code blocks)
    let memories = [];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        memories = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.log('⚠️  Could not parse memory extraction result');
      return;
    }

    if (!Array.isArray(memories) || memories.length === 0) return;

    // Validate and save
    const validMemories = memories
      .filter((m) => m.type && m.content && typeof m.content === 'string')
      .map((m) => ({
        type: m.type,
        content: m.content.substring(0, 200), // Cap length
        importance: Math.min(1, Math.max(0, m.importance || 0.5)),
        source: 'chat',
      }));

    const added = addMemories(validMemories);

    if (added.length > 0) {
      console.log(`🧠 Extracted ${added.length} new memories: ${added.map((m) => m.content).join(', ')}`);
    }
  } catch (error) {
    console.log(`⚠️  Memory extraction failed: ${error.message?.substring(0, 80)}`);
  }
}

module.exports = { extractMemories };
