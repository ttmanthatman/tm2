/**
 * TeamChat 管理员文件管理路由
 *  - 聊天附件:  列表 / 批量删除 / 批量打包下载
 *  - 墙纸视频:  列表(含被引用槽位) / 复用到指定槽位 / 批量删除
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const { db, getSetting, setSetting, normalizeToUTC } = require("../database");
const { authMiddleware, adminMiddleware } = require("../middleware");
const { UPLOAD_DIR, BG_DIR } = require("../config");

const router = express.Router();

/* ============================================================
 *  聊天附件管理
 * ============================================================ */

/* 列表: 来自 messages 表中 type=image|file 的记录 */
router.get("/admin/uploads", authMiddleware, adminMiddleware, (req, res) => {
  const { type, channelId, username, q } = req.query;
  let sql = `
    SELECT m.id, m.user_id, m.username, m.type, m.file_name, m.file_path,
           m.file_size, m.channel_id, m.created_at,
           u.nickname, c.name AS channel_name
      FROM messages m
      LEFT JOIN users u    ON u.id = m.user_id
      LEFT JOIN channels c ON c.id = m.channel_id
     WHERE m.type IN ('image','file')
       AND m.file_path IS NOT NULL AND m.file_path != ''`;
  const params = [];
  if (type === "image" || type === "file") { sql += " AND m.type = ?"; params.push(type); }
  if (channelId) { const cid = parseInt(channelId); if (!isNaN(cid)) { sql += " AND m.channel_id = ?"; params.push(cid); } }
  if (username) { sql += " AND m.username = ?"; params.push(String(username)); }
  if (q) { sql += " AND m.file_name LIKE ?"; params.push("%" + String(q).replace(/[%_]/g, "\\$&") + "%"); }
  sql += " ORDER BY m.id DESC LIMIT 1000";

  const rows = db.prepare(sql).all(...params).map(r => {
    r.created_at = normalizeToUTC(r.created_at);
    /* 检查磁盘是否仍存在,顺便修正大小 */
    const abs = path.join(UPLOAD_DIR, r.file_path);
    let exists = false, realSize = r.file_size;
    try {
      const st = fs.statSync(abs);
      exists = st.isFile();
      realSize = st.size;
    } catch (e) {}
    r.exists = exists;
    if (exists) r.file_size = realSize;
    return r;
  });

  /* 总用量 */
  let total = 0;
  rows.forEach(r => { if (r.exists) total += r.file_size || 0; });

  res.json({ items: rows, total_size: total, count: rows.length });
});

/* 批量删除: body = { ids:[messageId,...] } */
router.post("/admin/uploads/delete", authMiddleware, adminMiddleware, (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(n => Number.isInteger(n) && n > 0) : [];
  if (!ids.length) return res.json({ success: false, message: "未选择文件" });

  const ph = ids.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT id, file_path, channel_id FROM messages
      WHERE id IN (${ph})
        AND type IN ('image','file')
        AND file_path IS NOT NULL AND file_path != ''`
  ).all(...ids);

  let diskRemoved = 0, diskMissing = 0;
  rows.forEach(r => {
    const abs = path.join(UPLOAD_DIR, r.file_path);
    if (!abs.startsWith(UPLOAD_DIR + path.sep)) return; /* 路径穿越保护 */
    try { fs.unlinkSync(abs); diskRemoved++; }
    catch (e) { if (e.code === "ENOENT") diskMissing++; }
  });

  const dbDeleted = db.prepare(`DELETE FROM messages WHERE id IN (${ph})`).run(...ids).changes;

  /* 通知前端把这些消息从 UI 移除 */
  const io = req.app.get("io");
  if (io) io.emit("messagesDeleted", { ids: rows.map(r => r.id) });

  res.json({
    success: true,
    db_deleted: dbDeleted,
    disk_removed: diskRemoved,
    disk_missing: diskMissing
  });
});

/* 批量打包下载 (zip): GET /api/admin/uploads/download-zip?ids=1,2,3&token=... */
router.get("/admin/uploads/download-zip", (req, res) => {
  /* 浏览器 <a download> 不带 Authorization header,改为 query token 校验 */
  const jwt = require("jsonwebtoken");
  const { JWT_SECRET } = require("../config");
  const token = req.query.token || req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "未提供认证" });
  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); }
  catch (e) { return res.status(401).json({ success: false, message: "认证失败" }); }
  if (!decoded.isAdmin) return res.status(403).json({ success: false, message: "需要管理员权限" });

  const ids = String(req.query.ids || "")
    .split(",").map(s => parseInt(s.trim()))
    .filter(n => Number.isInteger(n) && n > 0);
  if (!ids.length) return res.status(400).json({ success: false, message: "未选择文件" });

  const ph = ids.map(() => "?").join(",");
  const rows = db.prepare(
    `SELECT id, file_path, file_name FROM messages
      WHERE id IN (${ph})
        AND type IN ('image','file')
        AND file_path IS NOT NULL AND file_path != ''`
  ).all(...ids);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const zipName = `teamchat-files-${stamp}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${zipName}"; filename*=UTF-8''${encodeURIComponent(zipName)}`
  );

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.on("warning", err => { if (err.code !== "ENOENT") console.warn("zip warning:", err); });
  archive.on("error", err => { console.error("zip error:", err); try { res.end(); } catch (e) {} });
  archive.pipe(res);

  /* 同名去重: 后缀加 (1)(2) */
  const used = new Map();
  rows.forEach(r => {
    const abs = path.join(UPLOAD_DIR, r.file_path);
    if (!abs.startsWith(UPLOAD_DIR + path.sep)) return;
    if (!fs.existsSync(abs)) return;
    let name = r.file_name || r.file_path;
    if (used.has(name)) {
      const n = used.get(name) + 1; used.set(name, n);
      const ext = path.extname(name); const base = name.slice(0, name.length - ext.length);
      name = `${base} (${n})${ext}`;
    } else used.set(name, 0);
    archive.file(abs, { name });
  });

  archive.finalize();
});

/* ============================================================
 *  墙纸 / 视频 库
 * ============================================================ */

const BG_SLOTS = [
  { key: "bg_image",        label: "聊天背景图", kind: "image" },
  { key: "bg_video",        label: "聊天背景视频", kind: "video" },
  { key: "login_bg_image",  label: "登录背景图", kind: "image" },
  { key: "login_bg_video",  label: "登录背景视频", kind: "video" }
];

const IMG_EXTS = new Set([".jpg",".jpeg",".png",".gif",".webp",".bmp",".svg"]);
const VID_EXTS = new Set([".mp4",".mov",".webm",".m4v"]);

function fileKindOf(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (IMG_EXTS.has(ext)) return "image";
  if (VID_EXTS.has(ext)) return "video";
  return "other";
}

/* 列表: 扫描 BG_DIR + 标注被哪些槽位引用 */
router.get("/admin/backgrounds", authMiddleware, adminMiddleware, (req, res) => {
  /* 当前各槽位引用 */
  const slotMap = {};
  BG_SLOTS.forEach(s => { slotMap[s.key] = getSetting(s.key) || ""; });

  let entries = [];
  try { entries = fs.readdirSync(BG_DIR); }
  catch (e) { entries = []; }

  const items = entries
    .filter(name => {
      try { return fs.statSync(path.join(BG_DIR, name)).isFile(); }
      catch (e) { return false; }
    })
    .map(name => {
      const abs = path.join(BG_DIR, name);
      const st = fs.statSync(abs);
      const kind = fileKindOf(name);
      const usedBy = BG_SLOTS
        .filter(s => slotMap[s.key] === name)
        .map(s => ({ key: s.key, label: s.label }));
      return {
        filename: name,
        kind,
        size: st.size,
        mtime: new Date(st.mtimeMs).toISOString(),
        used_by: usedBy
      };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));

  let total = 0;
  items.forEach(i => { total += i.size || 0; });

  res.json({ items, total_size: total, slots: BG_SLOTS, current: slotMap });
});

/* 复用: 把已有 BG 文件应用到指定槽位 (或清空)
 * body = { slot:'bg_image'|'bg_video'|'login_bg_image'|'login_bg_video', filename:'...' | '' }
 */
router.post("/admin/backgrounds/apply", authMiddleware, adminMiddleware, (req, res) => {
  const slot = String(req.body?.slot || "");
  const filename = String(req.body?.filename || "");
  const slotDef = BG_SLOTS.find(s => s.key === slot);
  if (!slotDef) return res.json({ success: false, message: "未知槽位" });

  if (filename) {
    /* 校验文件存在且类型匹配 */
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return res.json({ success: false, message: "非法文件名" });
    }
    const abs = path.join(BG_DIR, filename);
    if (!abs.startsWith(BG_DIR + path.sep) || !fs.existsSync(abs)) {
      return res.json({ success: false, message: "文件不存在" });
    }
    if (fileKindOf(filename) !== slotDef.kind) {
      return res.json({ success: false, message: `该槽位仅支持${slotDef.kind === "image" ? "图片" : "视频"}` });
    }
  }

  setSetting(slot, filename);

  /* 推送外观更新, 让所有客户端重新拉取 */
  const io = req.app.get("io");
  if (io) {
    const APPEARANCE_KEYS = [
      "login_title","chat_title","send_text","send_color",
      "bg_type","bg_color","bg_image","bg_mode","bg_video","bg_video_url","bg_video_mode",
      "login_bg_type","login_bg_color1","login_bg_color2","login_bg_image",
      "login_bg_mode","login_bg_video","login_bg_video_url","login_bg_video_mode"
    ];
    const bd = {};
    APPEARANCE_KEYS.concat(["timezone"]).forEach(k => { bd[k] = getSetting(k); });
    io.emit("appearanceChanged", bd);
  }

  res.json({ success: true });
});

/* 批量删除: body = { filenames:[...], force?:true }
 * 默认拒绝删除被引用的文件;force=true 时会先把对应槽位清空再删
 */
router.post("/admin/backgrounds/delete", authMiddleware, adminMiddleware, (req, res) => {
  const filenames = Array.isArray(req.body?.filenames)
    ? req.body.filenames.filter(n => typeof n === "string" && n && !n.includes("/") && !n.includes("\\") && !n.includes(".."))
    : [];
  const force = !!req.body?.force;
  if (!filenames.length) return res.json({ success: false, message: "未选择文件" });

  /* 当前引用 */
  const slotMap = {};
  BG_SLOTS.forEach(s => { slotMap[s.key] = getSetting(s.key) || ""; });

  const inUse = [];
  filenames.forEach(fn => {
    const refs = BG_SLOTS.filter(s => slotMap[s.key] === fn).map(s => s.label);
    if (refs.length) inUse.push({ filename: fn, refs });
  });

  if (inUse.length && !force) {
    return res.json({ success: false, in_use: inUse, message: "部分文件正被使用" });
  }

  /* force: 先清空引用 */
  let clearedSlots = 0;
  if (force && inUse.length) {
    inUse.forEach(u => {
      BG_SLOTS.forEach(s => {
        if (slotMap[s.key] === u.filename) { setSetting(s.key, ""); clearedSlots++; }
      });
    });
  }

  let removed = 0, missing = 0;
  filenames.forEach(fn => {
    const abs = path.join(BG_DIR, fn);
    if (!abs.startsWith(BG_DIR + path.sep)) return;
    try { fs.unlinkSync(abs); removed++; }
    catch (e) { if (e.code === "ENOENT") missing++; }
  });

  /* 如果改动了引用,广播外观更新 */
  if (clearedSlots > 0) {
    const io = req.app.get("io");
    if (io) {
      const APPEARANCE_KEYS = [
        "login_title","chat_title","send_text","send_color",
        "bg_type","bg_color","bg_image","bg_mode","bg_video","bg_video_url","bg_video_mode",
        "login_bg_type","login_bg_color1","login_bg_color2","login_bg_image",
        "login_bg_mode","login_bg_video","login_bg_video_url","login_bg_video_mode"
      ];
      const bd = {};
      APPEARANCE_KEYS.concat(["timezone"]).forEach(k => { bd[k] = getSetting(k); });
      io.emit("appearanceChanged", bd);
    }
  }

  res.json({ success: true, removed, missing, cleared_slots: clearedSlots });
});

module.exports = router;
