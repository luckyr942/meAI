/**
 * MeAI Memory Store
 * Persists user memories to a local JSON file.
 * Simple but effective — no database needed for Phase 2.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.resolve(__dirname, '../../data');
const MEMORIES_FILE = path.join(DATA_DIR, 'memories.json');

// ── Ensure data directory exists ────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEMORIES_FILE)) {
    fs.writeFileSync(MEMORIES_FILE, '[]', 'utf-8');
  }
}

// ── Read/Write helpers ──────────────────────────────────

function readMemories() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(MEMORIES_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeMemories(memories) {
  ensureDataDir();
  fs.writeFileSync(MEMORIES_FILE, JSON.stringify(memories, null, 2), 'utf-8');
}

// ── CRUD Operations ─────────────────────────────────────

/**
 * Add a new memory. Deduplicates by content similarity.
 */
function addMemory({ type, content, source = 'chat', importance = 0.5 }) {
  const memories = readMemories();

  // Simple deduplication — skip if very similar memory exists
  const isDuplicate = memories.some((m) => {
    const existing = m.content.toLowerCase();
    const incoming = content.toLowerCase();
    return existing === incoming || existing.includes(incoming) || incoming.includes(existing);
  });

  if (isDuplicate) {
    return null;
  }

  const memory = {
    id: uuidv4(),
    type,          // fact, person, preference, event, emotion
    content,       // "Studies computer science at MIT"
    source,        // "chat"
    importance,    // 0.0 - 1.0
    createdAt: new Date().toISOString(),
  };

  memories.push(memory);
  writeMemories(memories);

  return memory;
}

/**
 * Add multiple memories at once.
 */
function addMemories(memoryList) {
  const added = [];
  for (const mem of memoryList) {
    const result = addMemory(mem);
    if (result) added.push(result);
  }
  return added;
}

/**
 * Get all memories, optionally filtered by type.
 */
function getMemories(type = null) {
  const memories = readMemories();
  if (type) {
    return memories.filter((m) => m.type === type);
  }
  return memories;
}

/**
 * Search memories by keyword.
 */
function searchMemories(query) {
  const memories = readMemories();
  const lower = query.toLowerCase();
  return memories.filter((m) => m.content.toLowerCase().includes(lower));
}

/**
 * Delete a specific memory by ID.
 */
function deleteMemory(id) {
  const memories = readMemories();
  const filtered = memories.filter((m) => m.id !== id);

  if (filtered.length === memories.length) {
    return false; // not found
  }

  writeMemories(filtered);
  return true;
}

/**
 * Clear all memories ("forget me").
 */
function clearAllMemories() {
  writeMemories([]);
  return true;
}

/**
 * Get a formatted summary of memories for injecting into the system prompt.
 */
function getMemorySummary() {
  const memories = readMemories();
  if (memories.length === 0) return '';

  // Group by type
  const grouped = {};
  for (const m of memories) {
    if (!grouped[m.type]) grouped[m.type] = [];
    grouped[m.type].push(m.content);
  }

  const sections = [];

  if (grouped.person) {
    sections.push(`**People**: ${grouped.person.join('. ')}`);
  }
  if (grouped.fact) {
    sections.push(`**Facts**: ${grouped.fact.join('. ')}`);
  }
  if (grouped.preference) {
    sections.push(`**Preferences**: ${grouped.preference.join('. ')}`);
  }
  if (grouped.event) {
    sections.push(`**Events**: ${grouped.event.join('. ')}`);
  }
  if (grouped.emotion) {
    sections.push(`**Emotional patterns**: ${grouped.emotion.join('. ')}`);
  }

  return sections.join('\n');
}

module.exports = {
  addMemory,
  addMemories,
  getMemories,
  searchMemories,
  deleteMemory,
  clearAllMemories,
  getMemorySummary,
};
