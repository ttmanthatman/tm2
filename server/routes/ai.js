/**
 * AI 角色管理路由 (全部需管理员权限)
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { db } = require("../database");
const { authMiddleware, adminMiddleware } = require("../middleware");
const { uploadAvatar } = require("../upload");
const { invalidateCache } = require("../ai/trigger");
const { isOnline, runReply, getCurrentKey } = require("../ai/character");
const { AI_FEATURE_ENABLED } = require("../config");
const { getSetting, setSetting } = require("../database");

function maskKey(k) {
  if (!k) return "";
  if (k.length <= 10) return "****";
  return k.substring(0, 4) + "****" + k.substring(k.length - 4);
}

/* v0.5.6: 把更新广播出去, 让所有客户端刷新用户列表 */
function broadcastUsersChanged(req, reason) {
  try {
    const io = req.app.get("io");
    if (io) io.emit("usersChanged", { reason: reason || "ai_changed" });
  } catch(e) {}
}

const router = express.Router();

/* ===== 校验 & 默认值 ===== */
function validateConfig(c) {
  const errs = [];
  if (!c || typeof c !== "object") { errs.push("config 必须是对象"); return errs; }
  if (!c.name || typeof c.name !== "string") errs.push("缺少 name");
  if (c.channels != null && !Array.isArray(c.channels)) errs.push("channels 必须是数组");
  if (c.schedule && c.schedule.online_windows && !Array.isArray(c.schedule.online_windows)) {
    errs.push("schedule.online_windows 必须是数组");
  }
  if (c.trigger && c.trigger.mention_keywords && !Array.isArray(c.trigger.mention_keywords)) {
    errs.push("trigger.mention_keywords 必须是数组");
  }
  return errs;
}

function fillDefaults(c) {
  const d = {
    name: "AI",
    persona: {},
    schedule: { timezone: "Asia/Shanghai", online_windows: [] },
    trigger: { mode: "passive", mention_keywords: [], max_replies_per_minute: 3 },
    channels: [],
    model: { provider: "deepseek", name: "deepseek-chat", temperature: 0.8, max_context_messages: 20 },
    budget: { daily_tokens: 50000, per_message_max_tokens: 500 },
    typing_behavior: {
      thinking_delay_sec: [0.5, 2],
      typing_speed_cps: [10, 20],
      max_total_delay_sec: 15,
      show_typing_indicator: true
    }
  };
  return Object.assign(d, c);
}

/* ===== 列表 ===== */
router.get("/ai/characters", authMiddleware, adminMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT ac.id, ac.user_id, ac.config_json, ac.state_json, ac.enabled,
           ac.tokens_used_today, ac.budget_reset_at, ac.context_window_start,
           ac.created_at, ac.updated_at,
           u.username, u.nickname, u.avatar
    FROM ai_characters ac
    JOIN users u ON ac.user_id = u.id
    ORDER BY ac.id ASC
  `).all();
  const list = rows.map(r => {
    let config = {}, state = {};
    try { config = JSON.parse(r.config_json); } catch(e) {}
    try { state = JSON.parse(r.state_json); } catch(e) {}
    return {
      id: r.id,
      user_id: r.user_id,
      username: r.username,
      nickname: r.nickname,
      avatar: r.avatar,
      config, state,
      enabled: !!r.enabled,
      tokens_used_today: r.tokens_used_today,
      budget_reset_at: r.budget_reset_at,
      context_window_start: r.context_window_start || 0,
      created_at: r.created_at,
      updated_at: r.updated_at,
      is_online_now: isOnline(config.schedule)
    };
  });
  const curKey = getCurrentKey();
  res.json({
    success: true,
    characters: list,
    ai_enabled: !!AI_FEATURE_ENABLED,
    key_set: !!curKey,
    key_masked: maskKey(curKey)
  });
});

/* ===== 查看当前 AI 全局配置 (key 掩码) ===== */
router.get("/ai/config", authMiddleware, adminMiddleware, (req, res) => {
  const curKey = getCurrentKey();
  res.json({
    success: true,
    ai_feature_enabled: !!AI_FEATURE_ENABLED,
    key_set: !!curKey,
    key_masked: maskKey(curKey),
    debug_messages: getSetting("ai_debug_messages") === "1"
  });
});

/* ===== 开关 debug 日志 ===== */
router.post("/ai/config/debug", authMiddleware, adminMiddleware, (req, res) => {
  const on = !!(req.body && req.body.enabled);
  setSetting("ai_debug_messages", on ? "1" : "0");
  res.json({ success: true, debug_messages: on });
});

/* ===== 设置 / 清空 DeepSeek API Key ===== */
router.post("/ai/config/key", authMiddleware, adminMiddleware, (req, res) => {
  const raw = req.body && typeof req.body.key === "string" ? req.body.key.trim() : "";
  if (raw === "") {
    setSetting("deepseek_api_key", "");
    return res.json({ success: true, cleared: true });
  }
  /* DeepSeek key 格式粗校验 */
  if (!/^sk-[A-Za-z0-9_-]{10,}$/.test(raw)) {
    return res.json({ success: false, message: "key 格式不对 (应以 sk- 开头)" });
  }
  setSetting("deepseek_api_key", raw);
  res.json({ success: true, key_masked: maskKey(raw) });
});

/* ===== 测试 key 连通性 (不依赖角色) ===== */
router.post("/ai/config/test-key", authMiddleware, adminMiddleware, async (req, res) => {
  const key = getCurrentKey();
  if (!key) return res.json({ success: false, message: "尚未设置 key" });
  try {
    const ds = require("../ai/deepseek-client");
    const r = await ds.chatCompletion({
      apiKey: key,
      baseUrl: require("../config").DEEPSEEK_BASE_URL,
      model: "deepseek-chat",
      messages: [{ role: "user", content: "回复一个字: 好" }],
      temperature: 0,
      maxTokens: 10,
      timeoutMs: 15000
    });
    res.json({
      success: true,
      reply: (r.content || "").substring(0, 50),
      tokens: (r.inputTokens || 0) + (r.outputTokens || 0),
      latency_ms: r.latency
    });
  } catch(e) {
    res.json({ success: false, message: (e && e.message) || String(e) });
  }
});

/* ===== 创建 ===== */
router.post("/ai/characters", authMiddleware, adminMiddleware, async (req, res) => {
  const { username, config } = req.body;
  if (!username || !/^[a-zA-Z0-9_.\-]+$/.test(username)) {
    return res.json({ success: false, message: "username 非法 (只允许字母数字下划线和短横)" });
  }
  if (username.length > 40) return res.json({ success: false, message: "username 太长" });
  if (db.prepare("SELECT id FROM users WHERE username=?").get(username)) {
    return res.json({ success: false, message: "username 已存在 (人类或 AI 都不能重名)" });
  }
  const errs = validateConfig(config);
  if (errs.length) return res.json({ success: false, message: errs.join("; ") });

  const cfg = fillDefaults(config);
  const nickname = cfg.name || username;
  const fakePass = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);

  const userIns = db.prepare(
    "INSERT INTO users (username, password, nickname, avatar, is_admin, is_ai) VALUES (?,?,?,NULL,0,1)"
  ).run(username, fakePass, nickname);
  const newUserId = userIns.lastInsertRowid;

  /* 加入所有公开频道 */
  const pubChs = db.prepare("SELECT id FROM channels WHERE is_private=0").all();
  const insMember = db.prepare("INSERT OR IGNORE INTO channel_members (channel_id, user_id, role) VALUES (?,?,'member')");
  pubChs.forEach(c => insMember.run(c.id, newUserId));

  /* v0.5.5: 初始 context_window_start = 当前最新 msg.id + 1 (新角色不背历史包袱) */
  const maxMsgRow = db.prepare("SELECT COALESCE(MAX(id), 0) AS mid FROM messages").get();
  const initWindowStart = (maxMsgRow && maxMsgRow.mid ? maxMsgRow.mid : 0) + 1;

  const now = new Date().toISOString();
  const acIns = db.prepare(
    "INSERT INTO ai_characters (user_id, config_json, state_json, enabled, context_window_start, budget_reset_at, created_at, updated_at) VALUES (?,?,?,1,?,?,?,?)"
  ).run(newUserId, JSON.stringify(cfg), "{}", initWindowStart, now, now, now);

  invalidateCache();
  broadcastUsersChanged(req, "ai_created");
  res.json({ success: true, id: acIns.lastInsertRowid, user_id: newUserId });
});

/* ===== 更新 (config / enabled) ===== */
router.put("/ai/characters/:id", authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const { config, enabled } = req.body;
  const row = db.prepare("SELECT id, user_id FROM ai_characters WHERE id=?").get(id);
  if (!row) return res.json({ success: false, message: "角色不存在" });

  if (config) {
    const errs = validateConfig(config);
    if (errs.length) return res.json({ success: false, message: errs.join("; ") });
    const cfg = fillDefaults(config);
    db.prepare("UPDATE ai_characters SET config_json=?, updated_at=? WHERE id=?")
      .run(JSON.stringify(cfg), new Date().toISOString(), id);
    if (cfg.name) {
      db.prepare("UPDATE users SET nickname=? WHERE id=?").run(cfg.name, row.user_id);
    }
  }
  if (typeof enabled === "boolean") {
    db.prepare("UPDATE ai_characters SET enabled=?, updated_at=? WHERE id=?")
      .run(enabled ? 1 : 0, new Date().toISOString(), id);
  }

  invalidateCache();
  broadcastUsersChanged(req, "ai_updated");
  res.json({ success: true });
});

/* ===== 删除 ===== */
router.delete("/ai/characters/:id", authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const row = db.prepare("SELECT id, user_id FROM ai_characters WHERE id=?").get(id);
  if (!row) return res.json({ success: false, message: "角色不存在" });
  db.prepare("DELETE FROM ai_characters WHERE id=?").run(id);
  db.prepare("DELETE FROM users WHERE id=? AND is_ai=1").run(row.user_id);
  invalidateCache();
  broadcastUsersChanged(req, "ai_deleted");
  res.json({ success: true });
});

/* ===== 上传头像 ===== */
router.post("/ai/characters/:id/avatar", authMiddleware, adminMiddleware, uploadAvatar.single("avatar"), (req, res) => {
  if (!req.file) return res.json({ success: false, message: "上传失败" });
  const id = parseInt(req.params.id);
  const row = db.prepare("SELECT user_id FROM ai_characters WHERE id=?").get(id);
  if (!row) return res.json({ success: false, message: "角色不存在" });
  db.prepare("UPDATE users SET avatar=? WHERE id=?").run(req.file.filename, row.user_id);
  invalidateCache();
  broadcastUsersChanged(req, "ai_avatar");
  res.json({ success: true, avatar: req.file.filename });
});

/* ===== 调用日志 ===== */
router.get("/ai/characters/:id/logs", authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
  const rows = db.prepare("SELECT * FROM ai_logs WHERE character_id=? ORDER BY id DESC LIMIT ?").all(id, limit);
  res.json({ success: true, logs: rows });
});

/* ===== 重置对话上下文 (前推 window_start 到当前最新) ===== */
router.post("/ai/characters/:id/reset-context", authMiddleware, adminMiddleware, (req, res) => {
  const id = parseInt(req.params.id);
  const row = db.prepare("SELECT id FROM ai_characters WHERE id=?").get(id);
  if (!row) return res.json({ success: false, message: "角色不存在" });
  const maxMsgRow = db.prepare("SELECT COALESCE(MAX(id), 0) AS mid FROM messages").get();
  const newStart = (maxMsgRow && maxMsgRow.mid ? maxMsgRow.mid : 0) + 1;
  db.prepare("UPDATE ai_characters SET context_window_start=?, updated_at=? WHERE id=?")
    .run(newStart, new Date().toISOString(), id);
  res.json({ success: true, window_start: newStart });
});

/* ===== 手动测试发言 ===== */
router.post("/ai/characters/:id/test", authMiddleware, adminMiddleware, async (req, res) => {
  const id = parseInt(req.params.id);
  const chId = parseInt(req.body.channelId);
  if (!chId) return res.json({ success: false, message: "缺少 channelId" });
  const row = db.prepare(`
    SELECT ac.id, ac.user_id, ac.config_json, u.username, u.nickname, u.avatar
    FROM ai_characters ac JOIN users u ON ac.user_id = u.id WHERE ac.id=?
  `).get(id);
  if (!row) return res.json({ success: false, message: "角色不存在" });
  let config = {};
  try { config = JSON.parse(row.config_json); } catch(e) {}

  const io = req.app.get("io");
  try {
    await runReply({
      character: { id: row.id, config },
      aiUser: { id: row.user_id, username: row.username, nickname: row.nickname, avatar: row.avatar },
      channelId: chId,
      triggerMsgId: null,
      triggerType: "manual_test",
      io
    });
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, message: (e && e.message) || String(e) });
  }
});

module.exports = router;
