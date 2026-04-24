/**
 * AI 触发评估器
 * 每条人类消息持久化后调用，决定哪些 AI 角色要响应
 * v0.5.0: 只支持被动 @mention 模式
 */
const { db } = require("../database");
const { AI_FEATURE_ENABLED } = require("../config");
const { isOnline, runReply, getCurrentKey } = require("./character");

/* 角色缓存 (5 秒) */
let _cache = null;
let _cacheAt = 0;
function loadCharacters() {
  const now = Date.now();
  if (_cache && (now - _cacheAt) < 5000) return _cache;
  const rows = db.prepare(`
    SELECT ac.id, ac.user_id, ac.config_json, ac.enabled,
           u.username, u.nickname, u.avatar
    FROM ai_characters ac
    JOIN users u ON ac.user_id = u.id
    WHERE ac.enabled = 1 AND u.is_ai = 1
  `).all();
  _cache = rows.map(r => {
    let config = {};
    try { config = JSON.parse(r.config_json); } catch(e) {}
    return {
      id: r.id,
      userId: r.user_id,
      username: r.username,
      nickname: r.nickname,
      avatar: r.avatar,
      config
    };
  });
  _cacheAt = now;
  return _cache;
}
function invalidateCache() { _cache = null; _cacheAt = 0; }

/* 每角色速率限制 (内存) */
const recentReplies = new Map();
function rateLimitOk(charId, config) {
  const windowSec = 60;
  const max = (config.trigger && config.trigger.max_replies_per_minute) || 3;
  const now = Date.now();
  const arr = (recentReplies.get(charId) || []).filter(t => now - t < windowSec * 1000);
  if (arr.length >= max) { recentReplies.set(charId, arr); return false; }
  arr.push(now);
  recentReplies.set(charId, arr);
  return true;
}

function stripHtmlLower(s) {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .toLowerCase();
}

function isMentioned(plainLower, ch) {
  if (ch.username && plainLower.includes("@" + ch.username.toLowerCase())) return true;
  const kws = ch.config.trigger && ch.config.trigger.mention_keywords;
  if (Array.isArray(kws)) {
    for (const k of kws) {
      if (!k) continue;
      const kk = String(k).toLowerCase().trim();
      if (kk && plainLower.includes(kk)) return true;
    }
  }
  /* 昵称匹配 (昵称至少 2 字符才匹配，避免误伤) */
  if (ch.nickname && ch.nickname.length >= 2 && plainLower.includes(ch.nickname.toLowerCase())) return true;
  if (ch.config.name && ch.config.name.length >= 2 && plainLower.includes(String(ch.config.name).toLowerCase())) return true;
  return false;
}

/* 主入口：socket.js 在 sendMessage 持久化后调用此函数 */
function evaluate({ message, io }) {
  if (!AI_FEATURE_ENABLED) return;
  if (!getCurrentKey()) return;
  if (!message || !message.id || !message.channel_id || !message.user_id) return;
  if (message.type && message.type !== "text") return;
  if (!message.content || typeof message.content !== "string") return;
  if (message.content.startsWith("[CHAIN]")) return;

  /* 发送者若是 AI，不触发 (防死循环) */
  const sender = db.prepare("SELECT is_ai FROM users WHERE id=?").get(message.user_id);
  if (!sender || sender.is_ai) return;

  const plainLower = stripHtmlLower(message.content);
  const characters = loadCharacters();

  for (const ch of characters) {
    try {
      /* 频道范围 */
      const chans = (ch.config.channels && Array.isArray(ch.config.channels)) ? ch.config.channels : [];
      if (chans.length > 0 && !chans.includes(message.channel_id)) continue;

      /* 上线时间 */
      if (!isOnline(ch.config.schedule)) continue;

      /* 模式 (v0.5.0 只支持 passive) */
      const mode = (ch.config.trigger && ch.config.trigger.mode) || "passive";
      if (mode !== "passive") continue;

      /* @mention 检查 */
      if (!isMentioned(plainLower, ch)) continue;

      /* 速率限制 */
      if (!rateLimitOk(ch.id, ch.config)) continue;

      /* 异步触发 */
      const aiUser = {
        id: ch.userId,
        username: ch.username,
        nickname: ch.nickname,
        avatar: ch.avatar
      };
      Promise.resolve().then(() => runReply({
        character: { id: ch.id, config: ch.config },
        aiUser,
        channelId: message.channel_id,
        triggerMsgId: message.id,
        triggerType: "mention",
        io
      })).catch(e => console.error("[AI runReply]", e && e.message));
    } catch(e) {
      console.error("[AI evaluate loop]", e && e.message);
    }
  }
}

module.exports = { evaluate, invalidateCache, loadCharacters };