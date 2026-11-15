/**
 * MeAI Engine — SQLite Database
 * ═══════════════════════════════════════════════════════
 * 
 * WHY SQLITE?
 * 1. Zero setup — no Postgres/MySQL server to install
 * 2. Single file — your entire database is ~/.meai/meai.db
 * 3. Portable — copy the file to another machine = full backup
 * 4. Fast — handles 100k+ memories without breaking a sweat
 * 
 * WHY sql.js (NOT better-sqlite3)?
 * better-sqlite3 needs C++ compilation (fails on some systems).
 * sql.js is pure JavaScript (compiled from C via WebAssembly).
 * It works on EVERY machine with Node.js. Zero native deps.
 * Tradeoff: slightly slower, but for a personal AI it's plenty fast.
 * 
 * HOW IT WORKS:
 * 1. On boot: load existing DB file or create new one
 * 2. Run pending migrations (from migrations.js)
 * 3. Export helper functions: query(), run(), getOne()
 * 4. Auto-save to disk every 10 seconds + on process exit
 * 
 * IMPORTANT PATTERN:
 * sql.js keeps the DB in memory and we manually save to disk.
 * If the process crashes without saving, last 10 seconds of data
 * could be lost. That's why we also save immediately after important
 * writes (like new memories or messages).
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { config } = require('../config');
const { migrations } = require('./migrations');

// ── Database State ──────────────────────────────────
// These are module-level variables. There's only ONE database
// instance for the entire engine (singleton pattern).
let db = null;
const DB_PATH = path.join(config.DATA_DIR, 'meai.db');

/**
 * Initialize the database.
 * Called once during boot. Returns a promise because
 * sql.js loads WebAssembly asynchronously.
 */
async function initDB() {
  // Ensure ~/.meai/ directory exists
  if (!fs.existsSync(config.DATA_DIR)) {
    fs.mkdirSync(config.DATA_DIR, { recursive: true });
    console.log(`📁 Created data directory: ${config.DATA_DIR}`);
  }

  // Load sql.js WebAssembly module
  const SQL = await initSqlJs();

  // Load existing database or create fresh one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log(`📦 Loaded existing database: ${DB_PATH}`);
  } else {
    db = new SQL.Database();
    console.log(`📦 Created new database: ${DB_PATH}`);
  }

  // Enable WAL mode for better concurrent read performance
  db.run('PRAGMA journal_mode=WAL');
  // Enable foreign key enforcement
  db.run('PRAGMA foreign_keys=ON');

  // Run pending migrations
  runMigrations();

  // Auto-save to disk every 10 seconds
  setInterval(saveToDisk, 10_000);

  // Save on clean shutdown
  process.on('exit', saveToDisk);
  process.on('SIGINT', () => { saveToDisk(); process.exit(0); });
  process.on('SIGTERM', () => { saveToDisk(); process.exit(0); });

  return db;
}

/**
 * Run database migrations.
 * 
 * HOW THIS WORKS:
 * 1. Check what version the DB is at (0 if fresh)
 * 2. Loop through migrations array
 * 3. Skip any that have already been applied
 * 4. Run new ones and record their version
 */
function runMigrations() {
  // Create schema_version table if it doesn't exist (bootstrap)
  db.run(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  )`);

  // Get current version
  const result = query('SELECT MAX(version) as current FROM schema_version');
  const currentVersion = result[0]?.current || 0;

  // Apply pending migrations
  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`🔄 Running migration v${migration.version}: ${migration.description}`);
      db.run(migration.sql);
      run('INSERT INTO schema_version (version) VALUES (?)', [migration.version]);
      console.log(`✅ Migration v${migration.version} applied.`);
    }
  }

  saveToDisk();
}

// ── Query Helpers ───────────────────────────────────
// These are the 3 functions every other file will use
// to talk to the database.

/**
 * Run a SELECT query. Returns an array of row objects.
 * 
 * Usage:
 *   const users = query('SELECT * FROM memories WHERE type = ?', ['fact']);
 *   // → [{ id: '...', type: 'fact', content: '...' }, ...]
 */
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Run a SELECT query. Returns the first row or null.
 * 
 * Usage:
 *   const setting = getOne('SELECT * FROM settings WHERE key = ?', ['name']);
 *   // → { key: 'name', value: 'Lucky' } or null
 */
function getOne(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Run an INSERT/UPDATE/DELETE query. Returns { changes, lastId }.
 * 
 * Usage:
 *   const { lastId } = run('INSERT INTO messages (content) VALUES (?)', ['hello']);
 *   // → { changes: 1, lastId: 42 }
 */
function run(sql, params = []) {
  db.run(sql, params);
  return {
    changes: db.getRowsModified(),
    lastId: getOne('SELECT last_insert_rowid() as id')?.id,
  };
}

/**
 * Save the in-memory database to disk.
 * Call this after important writes (new messages, memories).
 */
function saveToDisk() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('❌ Failed to save database:', err.message);
  }
}

module.exports = { initDB, query, getOne, run, saveToDisk };
