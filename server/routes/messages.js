/**
 * TeamChat 消息路由
 * 消息获取、文件上传、头像/背景上传
 */
const express = require("express");
const { db, normalizeToUTC, canAccessChannel, canWriteChannel } = require("../database");
const { authMiddleware, adminMiddleware } = require("../middleware");
const { upload, uploadAvatar, uploadBg, uploadVoice } = require("../upload");
const { sendPushToOthers } = require("../push-service");

const router = express.Router();

/* ===== 获取消息 ===== */
router.get("/messages", authMiddleware, (req, res) => {
  const { before, limit = 50, channelId } = req.query;
  const chId = parseInt(channelId) || 1;

  if (!canAccessChannel(req.user.userId, chId)) {
    return res.status(403).json({ success: false, message: "无权访问此频道" });
  }

  const pl = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
  let sql = "SELECT m.*,u.nickname,u.avatar FROM messages m JOIN users u ON m.user_id=u.id WHERE m.channel_id=?";
  const params = [chId];

  if (before) {
    const pb = parseInt(before);
    if (!isNaN(pb) && pb > 0) { sql += " AND m.id < ?"; params.push(pb); }
  }
  sql += " ORDER BY m.id DESC LIMIT ?";
  params.push(pl);

  res.json(db.prepare(sql).all(...params).reverse().map(m => {
    m.created_at = normalizeToUTC(m.created_at);
    return m;
  }));
});

/* ===== 删除消息 (管理员) ===== */
router.delete("/messages", authMiddleware, adminMiddleware, (req, res) => {
  const { startDate, endDate, channelId } = req.body;
  if (!startDate || !endDate) return res.json({ success: false, message: "请提供日期" });
  let sql = "DELETE FROM messages WHERE DATE(created_at) BETWEEN ? AND ?";
  const params = [startDate, endDate];
  if (channelId) { const cid = parseInt(channelId); if (!isNaN(cid) && cid > 0) { sql += " AND channel_id = ?"; params.push(cid); } }
  res.json({
    success: true,
    deleted: db.prepare(sql).run(...params).changes
  });
});

/* ===== 删除单条消息 (管理员) ===== */
router.delete("/messages/:id", authMiddleware, adminMiddleware, (req, res) => {
  const msgId = parseInt(req.params.id);
  if (!msgId || msgId <= 0) return res.json({ success: false, message: "无效的消息ID" });

  const msg = db.prepare("SELECT id, type, file_path FROM messages WHERE id=?").get(msgId);
  if (!msg) return res.json({ success: false, message: "消息不存在" });

  /* 如果有附件/语音文件,一并删除磁盘文件 */
  if (msg.file_path) {
    const { UPLOAD_DIR, VOICE_DIR } = require("../config");
    const fspath = require("path");
    const fso = require("fs");
    const dir = msg.type === "voice" ? VOICE_DIR : UPLOAD_DIR;
    const abs = fspath.join(dir, msg.file_path);
    if (abs.startsWith(dir + fspath.sep)) {
      try { fso.unlinkSync(abs); } catch (e) {}
    }
  }

  db.prepare("DELETE FROM messages WHERE id=?").run(msgId);

  /* 通过 Socket 通知所有客户端移除该消息 */
  const io = req.app.get("io");
  if (io) io.emit("messagesDeleted", { ids: [msgId] });

  res.json({ success: true, deleted: 1 });
});

/* ===== 上传聊天文件 ===== */
router.post("/upload", authMiddleware, upload.single("file"), (req, res) => {
  if (!req.file) return res.json({ success: false, message: "上传失败" });

  const channelId = parseInt(req.body.channelId) || 1;
  if (!canWriteChannel(req.user.userId, channelId)) {
    return res.json({ success: false, message: "无权在此频道发送" });
  }

  const type = req.file.mimetype.startsWith("image/") ? "image" : "file";
  const user = db.prepare("SELECT username,nickname,avatar FROM users WHERE id=?").get(req.user.userId);
  if (!user) return res.json({ success: false, message: "用户不存在" });

  const nowUtc = new Date().toISOString();
  const result = db.prepare(
    "INSERT INTO messages (user_id,username,content,type,file_name,file_path,file_size,channel_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run(req.user.userId, user.username, "", type, req.file.originalname, req.file.filename, req.file.size, channelId, nowUtc);

  const message = {
    id: result.lastInsertRowid, username: user.username, nickname: user.nickname,
    avatar: user.avatar, content: "", type, file_name: req.file.originalname,
    file_path: req.file.filename, file_size: req.file.size,
    channel_id: channelId, created_at: nowUtc
  };

  const io = req.app.get("io");
  if (io) io.to("ch:" + channelId).emit("newMessage", message);
  sendPushToOthers(req.user.userId, user.nickname || user.username,
    type === "image" ? "[图片]" : "[文件] " + req.file.originalname, channelId);

  res.json({ success: true });
});

/* ===== 上传语音消息 ===== */
router.post("/upload-voice", authMiddleware, uploadVoice.single("voice"), (req, res) => {
  if (!req.file) return res.json({ success: false, message: "上传失败" });

  const channelId = parseInt(req.body.channelId) || 1;
  if (!canWriteChannel(req.user.userId, channelId)) {
    return res.json({ success: false, message: "无权在此频道发送" });
  }

  const duration = parseFloat(req.body.duration) || 0;
  const user = db.prepare("SELECT username,nickname,avatar FROM users WHERE id=?").get(req.user.userId);
  if (!user) return res.json({ success: false, message: "用户不存在" });

  const nowUtc = new Date().toISOString();
  const result = db.prepare(
    "INSERT INTO messages (user_id,username,content,type,file_name,file_path,file_size,duration,channel_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
  ).run(req.user.userId, user.username, "", "voice", req.file.filename, req.file.filename, req.file.size, duration, channelId, nowUtc);

  const message = {
    id: result.lastInsertRowid, username: user.username, nickname: user.nickname,
    avatar: user.avatar, content: "", type: "voice", file_name: req.file.filename,
    file_path: req.file.filename, file_size: req.file.size, duration,
    channel_id: channelId, created_at: nowUtc
  };

  const io = req.app.get("io");
  if (io) io.to("ch:" + channelId).emit("newMessage", message);
  sendPushToOthers(req.user.userId, user.nickname || user.username, "[语音消息]", channelId);

  res.json({ success: true });
});

/* ===== 上传头像 ===== */
router.post("/upload-avatar", authMiddleware, uploadAvatar.single("avatar"), (req, res) => {
  if (!req.file) return res.json({ success: false });
  db.prepare("UPDATE users SET avatar=? WHERE id=?").run(req.file.filename, req.user.userId);
  res.json({ success: true, avatar: req.file.filename });
});

/* ===== 上传背景 ===== */
const path = require("path");
const IMG_EXTS_BG = new Set([".jpg",".jpeg",".png",".gif",".webp",".bmp",".svg"]);
const VID_EXTS_BG = new Set([".mp4",".mov",".webm",".m4v"]);
router.post("/upload-bg", authMiddleware, adminMiddleware, uploadBg.single("bg"), (req, res) => {
  if (!req.file) return res.json({ success: false, message: "上传失败" });
  const ext = path.extname(req.file.filename).toLowerCase();
  const kind = IMG_EXTS_BG.has(ext) ? "image"
             : VID_EXTS_BG.has(ext) ? "video"
             : "other";
  res.json({
    success: true,
    filename: req.file.filename,
    kind,
    size: req.file.size,
    mtime: new Date().toISOString()
  });
});

module.exports = router;
