/**
 * TeamChat 数据库模块
 * SQLite 初始化、迁移、辅助函数
 */
const Database = require("better-sqlite3");
const { DB_PATH, DEFAULT_SETTINGS } = require("./config");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* ===== 表结构 ===== */
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
    nickname TEXT, avatar TEXT, is_admin INTEGER DEFAULT 0,
    last_login_at TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, description TEXT DEFAULT '',
    is_private INTEGER DEFAULT 0, is_default INTEGER DEFAULT 0,
    created_by INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS channel_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, user_id),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, username TEXT NOT NULL,
    content TEXT, type TEXT DEFAULT 'text',
    file_name TEXT, file_path TEXT, file_size INTEGER,
    reply_to INTEGER, channel_id INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, endpoint TEXT UNIQUE NOT NULL,
    keys_p256dh TEXT NOT NULL, keys_auth TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS ai_characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    config_json TEXT NOT NULL,
    state_json TEXT DEFAULT '{}',
    enabled INTEGER DEFAULT 1,
    tokens_used_today INTEGER DEFAULT 0,
    budget_reset_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS ai_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    channel_id INTEGER,
    trigger_type TEXT,
    input_msg_id INTEGER,
    output_msg_id INTEGER,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_ai_logs_char ON ai_logs(character_id, id DESC);
`);

/* ===== 迁移 (安全的 ALTER TABLE) ===== */
const migrations = [
  "ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0",
  "ALTER TABLE messages ADD COLUMN reply_to INTEGER",
  "ALTER TABLE users ADD COLUMN last_login_at TEXT",
  "ALTER TABLE messages ADD COLUMN channel_id INTEGER DEFAULT 1",
  "ALTER TABLE messages ADD COLUMN duration REAL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN is_ai INTEGER DEFAULT 0",
  "ALTER TABLE ai_logs ADD COLUMN cache_hit_tokens INTEGER DEFAULT 0",
  "ALTER TABLE ai_logs ADD COLUMN cache_miss_tokens INTEGER DEFAULT 0",
  "ALTER TABLE ai_characters ADD COLUMN context_window_start INTEGER DEFAULT 0",
];
migrations.forEach(sql => { try { db.exec(sql); } catch(e) {} });

/* 时间戳迁移: 确保 UTC 格式 */
try {
  const nf = db.prepare(
    "SELECT COUNT(*) as cnt FROM messages WHERE created_at NOT LIKE '%Z' AND created_at NOT LIKE '%+%' AND created_at NOT LIKE '%-__:__'"
  ).get();
  if (nf && nf.cnt > 0) {
    db.exec("UPDATE messages SET created_at = REPLACE(created_at, ' ', 'T') || 'Z' WHERE created_at NOT LIKE '%Z' AND created_at NOT LIKE '%+%' AND created_at NOT LIKE '%-__:__'");
    console.log("✅ 已迁移 " + nf.cnt + " 条时间戳");
  }
} catch(e) {}

/* ===== 默认频道 ===== */
const defaultCh = db.prepare("SELECT id FROM channels WHERE is_default = 1").get();
if (!defaultCh) {
  const r = db.prepare(
    "INSERT INTO channels (name, description, is_default, is_private) VALUES ('综合频道', '默认公开频道', 1, 0)"
  ).run();
  const chId = r.lastInsertRowid;
  const users = db.prepare("SELECT id FROM users").all();
  const ins = db.prepare("INSERT OR IGNORE INTO channel_members (channel_id, user_id, role) VALUES (?, ?, ?)");
  users.forEach(u => ins.run(chId, u.id, "member"));
  db.prepare("UPDATE messages SET channel_id = ? WHERE channel_id IS NULL OR channel_id = 0 OR channel_id = 1").run(chId);
  console.log("✅ 默认频道已创建, ID=" + chId);
}

/* ===== 默认设置 ===== */
const insSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);

/* ===== 首次迁移: 把老 .deepseek_key / env 的值搬进 DB (只做一次) ===== */
try {
  const { DEEPSEEK_FALLBACK_KEY } = require("./config");
  const existing = db.prepare("SELECT value FROM settings WHERE key='deepseek_api_key'").get();
  if (!existing && DEEPSEEK_FALLBACK_KEY) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("deepseek_api_key", DEEPSEEK_FALLBACK_KEY);
    console.log("✅ 已把 .deepseek_key 的值迁入数据库 (settings.deepseek_api_key)");
  }
} catch(e) { console.error("[migrate deepseek key]", e.message); }

/* ===== 辅助函数 ===== */
function getSetting(k) {
  const r = db.prepare("SELECT value FROM settings WHERE key=?").get(k);
  return r ? r.value : (DEFAULT_SETTINGS[k] || "");
}

function setSetting(k, v) {
  db.prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,datetime('now'))").run(k, v);
}

function normalizeToUTC(ts) {
  if (!ts) return ts;
  if (ts.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(ts)) return ts;
  return ts.replace(" ", "T") + "Z";
}

function canAccessChannel(userId, channelId) {
  const ch = db.prepare("SELECT * FROM channels WHERE id=?").get(channelId);
  if (!ch) return false;
  if (!ch.is_private) return true;
  const user = db.prepare("SELECT is_admin FROM users WHERE id=?").get(userId);
  if (user && user.is_admin) return true;
  return !!db.prepare("SELECT role FROM channel_members WHERE channel_id=? AND user_id=?").get(channelId, userId);
}

function canWriteChannel(userId, channelId) {
  const ch = db.prepare("SELECT * FROM channels WHERE id=?").get(channelId);
  if (!ch) return false;
  if (!ch.is_private) return true;
  const user = db.prepare("SELECT is_admin FROM users WHERE id=?").get(userId);
  if (user && user.is_admin) return true;
  const mem = db.prepare("SELECT role FROM channel_members WHERE channel_id=? AND user_id=?").get(channelId, userId);
  if (!mem) return false;
  return mem.role !== "viewer";
}

module.exports = {
  db, getSetting, setSetting, normalizeToUTC,
  canAccessChannel, canWriteChannel
};
