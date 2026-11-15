/**
 * MeAI Engine — Database Migrations
 * ═══════════════════════════════════════════════════════
 * 
 * WHY THIS FILE EXISTS:
 * A migration file defines the SHAPE of your data — every table,
 * every column, every relationship. When the engine boots, it runs
 * these migrations to ensure the database schema is up to date.
 * 
 * WHY NOT JUST db.run(CREATE TABLE) IN RANDOM FILES?
 * Because you end up with schema scattered across 10 files and
 * no idea what your database looks like. One file, one truth.
 * 
 * HOW MIGRATIONS WORK:
 * Each migration has a version number. When the engine starts:
 *   1. Check current schema version in the DB
 *   2. Run any migrations newer than that version
 *   3. Update the version number
 * This means you can add tables/columns later without breaking
 * existing user data.
 * 
 * THE DATA MODEL:
 * ┌──────────────┐    ┌──────────────┐
 * │ conversations │───→│   messages    │  (1 conversation → many messages)
 * └──────────────┘    └──────────────┘
 * 
 * ┌──────────────┐
 * │   memories   │  (standalone — extracted facts about the user)
 * └──────────────┘
 * 
 * ┌──────────────┐
 * │  mood_logs   │  (one entry per message — tracks emotions over time)
 * └──────────────┘
 * 
 * ┌──────────────┐
 * │   settings   │  (key-value store for user preferences)
 * └──────────────┘
 */

const migrations = [
  {
    version: 1,
    description: 'Core tables — conversations, messages, memories, moods, settings',
    sql: `
      -- ═══════════════════════════════════════════════════
      -- CONVERSATIONS
      -- A conversation is a chat thread. Users can have many.
      -- Think of it like a WhatsApp chat — each one has its own history.
      -- ═══════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,                          -- UUID, not auto-increment (easier to sync later)
        title TEXT DEFAULT 'New Conversation',        -- Auto-generated from first message
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- ═══════════════════════════════════════════════════
      -- MESSAGES
      -- Every message in every conversation. This is the chat history.
      -- role = 'user' (what you said) or 'assistant' (what MeAI said)
      -- 
      -- WHY STORE EVERY MESSAGE?
      -- Because when the server restarts, we need to rebuild the
      -- conversation. Without persistence, "remember" means nothing.
      -- ═══════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,                 -- FK → conversations.id
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      -- Index for fast lookups: "give me all messages in conversation X"
      CREATE INDEX IF NOT EXISTS idx_messages_conversation 
        ON messages(conversation_id, created_at);

      -- ═══════════════════════════════════════════════════
      -- MEMORIES
      -- Extracted facts about the user. This is MeAI's long-term memory.
      -- 
      -- type: what KIND of fact is this?
      --   'fact'       → "Name is Lucky" / "Studies CS at XYZ"
      --   'person'     → "Has a sister named Priya"
      --   'preference' → "Loves coffee, hates mornings"
      --   'event'      → "Has an interview on Friday"
      --   'emotion'    → "Gets anxious before deadlines"
      --   'personality'→ "Uses humor when stressed" (learned over time)
      --
      -- importance: 0.0 to 1.0
      --   Name = 0.9 (very important to remember)
      --   "Had pasta for lunch" = 0.2 (not important)
      --
      -- embedding: vector representation for semantic search
      --   Stored as JSON array of floats: [0.1, -0.3, 0.7, ...]
      --   Used by Orama to find "what drinks do I like?" → "loves coffee"
      -- ═══════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,                           -- UUID
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        importance REAL DEFAULT 0.5,
        embedding TEXT,                                -- JSON array of floats (for vector search)
        source TEXT DEFAULT 'chat',                    -- where did this come from? 'chat', 'manual', 'email'
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);

      -- ═══════════════════════════════════════════════════
      -- MOOD LOGS
      -- One entry per USER message. Tracks how you're feeling over time.
      -- This powers the emotion model: trends, patterns, predictions.
      -- 
      -- Example: If MeAI notices you're 'anxious' every Sunday night,
      -- it can say "Hey, I've noticed Sundays are tough. Want to talk?"
      -- ═══════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS mood_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        mood TEXT NOT NULL,                             -- joyful, calm, anxious, sad, etc.
        message_snippet TEXT,                           -- first 100 chars of the message (for context)
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_mood_logs_date ON mood_logs(created_at);

      -- ═══════════════════════════════════════════════════
      -- SETTINGS
      -- Key-value store for user preferences.
      -- Examples: { llm_provider: 'ollama', theme: 'dark', name: 'Lucky' }
      -- ═══════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- ═══════════════════════════════════════════════════
      -- SCHEMA VERSION TRACKER
      -- Records which migrations have been run.
      -- ═══════════════════════════════════════════════════
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `,
  },

  // ── Future migrations go here ──────────────────────
  // {
  //   version: 2,
  //   description: 'Add job_applications table (Jobs module)',
  //   sql: `CREATE TABLE IF NOT EXISTS job_applications ( ... )`,
  // },
];

module.exports = { migrations };
