/**
 * TeamChat 频道路由
 * 频道 CRUD、成员管理、权限控制
 */
const express = require("express");
const { db } = require("../database");
const { authMiddleware, adminMiddleware } = require("../middleware");

const router = express.Router();

/* ===== 获取用户可访问的频道 ===== */
router.get("/channels", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT is_admin FROM users WHERE id=?").get(req.user.userId);
  let channels;
  if (user && user.is_admin) {
    channels = db.prepare(
      "SELECT c.*, (SELECT COUNT(*) FROM channel_members WHERE channel_id=c.id) as _memberCount FROM channels c ORDER BY c.is_default DESC, c.id ASC"
    ).all();
  } else {
    channels = db.prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM channel_members WHERE channel_id=c.id) as _memberCount
       FROM channels c WHERE c.is_private = 0
       OR c.id IN (SELECT channel_id FROM channel_members WHERE user_id = ?)
       ORDER BY c.is_default DESC, c.id ASC`
    ).all(req.user.userId);
  }
  res.json(channels);
});

/* ===== 管理员: 获取所有频道 ===== */
router.get("/admin/channels", authMiddleware, adminMiddleware, (req, res) => {
  res.json(db.prepare(
    "SELECT c.*, (SELECT COUNT(*) FROM channel_members WHERE channel_id=c.id) as _memberCount FROM channels c ORDER BY c.is_default DESC, c.id ASC"
  ).all());
});

/* ===== 创建频道 ===== */
router.post("/channels", authMiddleware, adminMiddleware, (req, res) => {
  const { name, description, is_private } = req.body;
  if (!name) return res.json({ success: false, message: "缺少频道名" });

  try {
    const r = db.prepare(
      "INSERT INTO channels (name, description, is_private, created_by) VALUES (?, ?, ?, ?)"
    ).run(name, description || "", is_private ? 1 : 0, req.user.userId);
    const chId = r.lastInsertRowid;

    /* 创建者为 owner */
    db.prepare("INSERT INTO channel_members (channel_id, user_id, role) VALUES (?, ?, 'owner')").run(chId, req.user.userId);

    /* 公开频道自动加入所有用户 */
    if (!is_private) {
      db.prepare("SELECT id FROM users").all().forEach(u => {
        if (u.id !== req.user.userId) {
          db.prepare("INSERT OR IGNORE INTO channel_members (channel_id,user_id,role) VALUES (?,?,'member')").run(chId, u.id);
        }
      });
    }

    const ch = db.prepare("SELECT * FROM channels WHERE id=?").get(chId);
    const io = req.app.get("io");
    if (io) io.emit("channelCreated", ch);
    res.json({ success: true, channel: ch });
  } catch(e) {
    res.json({ success: false, message: "创建失败" });
  }
});

/* ===== 删除频道 ===== */
router.delete("/channels/:id", authMiddleware, adminMiddleware, (req, res) => {
  const ch = db.prepare("SELECT * FROM channels WHERE id=?").get(req.params.id);
  if (!ch) return res.json({ success: false, message: "频道不存在" });
  if (ch.is_default) return res.json({ success: false, message: "不能删除默认频道" });

  db.prepare("DELETE FROM messages WHERE channel_id=?").run(ch.id);
  db.prepare("DELETE FROM channel_members WHERE channel_id=?").run(ch.id);
  db.prepare("DELETE FROM channels WHERE id=?").run(ch.id);

  const io = req.app.get("io");
  if (io) io.emit("channelDeleted", { channelId: ch.id });
  res.json({ success: true });
});

/* ===== 频道成员管理 ===== */
router.get("/channels/:id/members", authMiddleware, (req, res) => {
  res.json(db.prepare(
    "SELECT cm.*, u.username, u.nickname, u.avatar FROM channel_members cm JOIN users u ON cm.user_id = u.id WHERE cm.channel_id = ?"
  ).all(req.params.id));
});

router.post("/channels/:id/members", authMiddleware, adminMiddleware, (req, res) => {
  const { username, role } = req.body;
  const user = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  if (!user) return res.json({ success: false, message: "用户不存在" });

  try {
    db.prepare("INSERT OR REPLACE INTO channel_members (channel_id, user_id, role) VALUES (?, ?, ?)").run(
      req.params.id, user.id, role || "member"
    );
    const io = req.app.get("io");
    if (io) io.emit("membershipChanged", {});
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, message: "添加失败" });
  }
});

router.put("/channels/:id/members/:userId", authMiddleware, adminMiddleware, (req, res) => {
  const { role } = req.body;
  db.prepare("UPDATE channel_members SET role=? WHERE channel_id=? AND user_id=?").run(role, req.params.id, req.params.userId);
  const io = req.app.get("io");
  if (io) io.emit("membershipChanged", {});
  res.json({ success: true });
});

router.delete("/channels/:id/members/:userId", authMiddleware, adminMiddleware, (req, res) => {
  db.prepare("DELETE FROM channel_members WHERE channel_id=? AND user_id=?").run(req.params.id, req.params.userId);
  const io = req.app.get("io");
  if (io) io.emit("membershipChanged", {});
  res.json({ success: true });
});

module.exports = router;
