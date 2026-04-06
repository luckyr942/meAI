/**
 * MeAI Local Database — SQLite (Pure JavaScript)
 * Uses sql.js (WebAssembly SQLite) — zero native dependencies, works on ANY Node.js version.
 * All data lives in ~/.meai/meai.db
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ── Data Directory ──────────────────────────────────────
const MEAI_DIR = path.join(os.homedir(), '.meai');
const DB_PATH = path.join(MEAI_DIR, 'meai.db');

function ensureDataDir() {
  if (!fs.existsSync(MEAI_DIR)) {
    fs.mkdirSync(MEAI_DIR, { recursive: true });
    console.log(`📁 Created MeAI data directory: ${MEAI_DIR}`);
  }
}

// ── Database Singleton ──────────────────────────────────
let db = null;
let dbReady = null;

function initDB() {
  if (dbReady) return dbReady;

  dbReady = (async () => {
    ensureDataDir();
    const SQL = await initSqlJs();

    // Load existing DB or create new
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    // ── Create Tables ───────────────────────────────────
    db.run(`
      CREATE TABLE IF NOT EXISTS job_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Unknown',
        platform TEXT NOT NULL DEFAULT 'Other',
        action_required INTEGER DEFAULT 0,
        source_email_id TEXT UNIQUE,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS finance_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        merchant TEXT,
        category TEXT DEFAULT 'Other',
        type TEXT NOT NULL DEFAULT 'debit',
        source TEXT DEFAULT 'email',
        source_email_id TEXT UNIQUE,
        transaction_date TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        mood TEXT DEFAULT 'neutral',
        tags TEXT,
        conversation_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS processed_emails (
        email_id TEXT PRIMARY KEY,
        module TEXT NOT NULL,
        processed_at TEXT DEFAULT (datetime('now'))
      )
    `);

    console.log(`📦 SQLite Database Ready: ${DB_PATH}`);
    return db;
  })();

  return dbReady;
}

// ── Auto-save to disk periodically ──────────────────────
function saveDB() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('❌ Failed to save DB:', err.message);
  }
}

// Save every 10 seconds
setInterval(saveDB, 10000);

// Save on process exit
process.on('exit', saveDB);
process.on('SIGINT', () => { saveDB(); process.exit(0); });
process.on('SIGTERM', () => { saveDB(); process.exit(0); });

// ── Helper: Run query and return results as objects ──────
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  return { changes: db.getRowsModified(), lastInsertRowid: queryOne('SELECT last_insert_rowid() as id')?.id };
}

// ── Job Application CRUD ────────────────────────────────

const Jobs = {
  create(data) {
    try {
      const result = runSql(
        `INSERT OR IGNORE INTO job_applications (company, role, status, platform, action_required, source_email_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [data.company, data.role, data.status || 'Unknown', data.platform || 'Other', data.action_required ? 1 : 0, data.sourceEmailId || null]
      );
      if (result.changes > 0) {
        saveDB(); // Persist immediately for important writes
        return { id: result.lastInsertRowid, ...data };
      }
      return null;
    } catch (err) {
      // UNIQUE constraint = already exists, skip silently
      return null;
    }
  },

  findAll() {
    return queryAll('SELECT * FROM job_applications ORDER BY created_at DESC');
  },

  findByEmailId(emailId) {
    return queryOne('SELECT * FROM job_applications WHERE source_email_id = ?', [emailId]);
  },

  count() {
    return queryOne('SELECT COUNT(*) as total FROM job_applications')?.total || 0;
  },
};

// ── Finance Transaction CRUD ────────────────────────────

const Finance = {
  create(data) {
    try {
      const result = runSql(
        `INSERT OR IGNORE INTO finance_transactions (amount, merchant, category, type, source, source_email_id, transaction_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.amount, data.merchant || 'Unknown', data.category || 'Other', data.type || 'debit', data.source || 'email', data.sourceEmailId || null, data.transaction_date || new Date().toISOString()]
      );
      if (result.changes > 0) {
        saveDB();
        return { id: result.lastInsertRowid, ...data };
      }
      return null;
    } catch (err) {
      return null;
    }
  },

  findAll() {
    return queryAll('SELECT * FROM finance_transactions ORDER BY created_at DESC');
  },

  getMonthlyBreakdown() {
    return queryAll(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM finance_transactions
      WHERE type = 'debit' AND created_at >= date('now', '-30 days')
      GROUP BY category ORDER BY total DESC
    `);
  },

  getTotalSpent(days = 30) {
    return queryOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM finance_transactions
      WHERE type = 'debit' AND created_at >= date('now', '-' || ? || ' days')
    `, [days])?.total || 0;
  },
};

// ── Journal CRUD ────────────────────────────────────────

const Journal = {
  create(data) {
    const result = runSql(
      `INSERT INTO journal_entries (content, mood, tags, conversation_id) VALUES (?, ?, ?, ?)`,
      [data.content, data.mood || 'neutral', data.tags ? JSON.stringify(data.tags) : null, data.conversation_id || null]
    );
    saveDB();
    return { id: result.lastInsertRowid, ...data };
  },

  findAll(limit = 50) {
    return queryAll('SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT ?', [limit]);
  },

  getMoodHistory(days = 7) {
    return queryAll(`
      SELECT mood, COUNT(*) as count, date(created_at) as day
      FROM journal_entries
      WHERE created_at >= date('now', '-' || ? || ' days')
      GROUP BY mood, day ORDER BY day DESC
    `, [days]);
  },
};

// ── Processed Email Tracking ────────────────────────────

const ProcessedEmails = {
  isProcessed(emailId, module) {
    return !!queryOne('SELECT 1 FROM processed_emails WHERE email_id = ? AND module = ?', [emailId, module]);
  },

  markProcessed(emailId, module) {
    try {
      runSql('INSERT OR IGNORE INTO processed_emails (email_id, module) VALUES (?, ?)', [emailId, module]);
      saveDB();
    } catch (err) {
      // Ignore duplicate
    }
  },
};

// ── Synchronous access after init ───────────────────────
function getDB() {
  return initDB();
}

module.exports = { getDB, initDB, Jobs, Finance, Journal, ProcessedEmails, MEAI_DIR };
