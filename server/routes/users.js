/**
 * TeamChat 用户管理路由
 * 增删查改用户 (管理员)
 */
const express = require("express");
const bcrypt = require("bcryptjs");
const { db } = require("../database");
const { authMiddleware, adminMiddleware } = require("../middleware");

const router = express.Router();

/* ===== 用户列表 ===== */
router.get("/users", authMiddleware, adminMiddleware, (req, res) => {
  res.json(db.prepare("SELECT id,username,nickname,avatar,is_admin,created_at FROM users").all());
});

/* ===== 添加用户 ===== */
router.post("/users", authMiddleware, adminMiddleware, async (req, res) => {
  const { username, password, nickname } = req.body;
  if (!username || !password) return res.json({ success: false, message: "缺少参数" });
  if (!/^[a-zA-Z0-9_.\-]+$/.test(username)) return res.json({ success: false, message: "用户名非法" });
  if (password.length < 6) return res.json({ success: false, message: "密码不能小于6位" });

  try {
    const r = db.prepare("INSERT INTO users (username,password,nickname) VALUES (?,?,?)").run(
      username, await bcrypt.hash(password, 10), nickname || username
    );
    db.prepare("SELECT id FROM channels WHERE is_private=0").all().forEach(ch => {
      db.prepare("INSERT OR IGNORE INTO channel_members (channel_id,user_id,role) VALUES (?,?,'member')").run(ch.id, r.lastInsertRowid);
    });
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, message: "用户名已存在" });
  }
});

/* ===== (兼容旧接口) 注册 ===== */
router.post("/register", authMiddleware, adminMiddleware, async (req, res) => {
  const { username, password, nickname } = req.body;
  if (!username || !password) return res.json({ success: false, message: "缺少参数" });
  if (!/^[a-zA-Z0-9_.\-]+$/.test(username)) return res.json({ success: false, message: "用户名非法" });
  if (password.length < 6) return res.json({ success: false, message: "密码不能小于6位" });
  try {
    const r = db.prepare("INSERT INTO users (username,password,nickname) VALUES (?,?,?)").run(
      username, await bcrypt.hash(password, 10), nickname || username
    );
    db.prepare("SELECT id FROM channels WHERE is_private=0").all().forEach(ch => {
      db.prepare("INSERT OR IGNORE INTO channel_members (channel_id,user_id,role) VALUES (?,?,'member')").run(ch.id, r.lastInsertRowid);
    });
    res.json({ success: true });
  } catch(e) { res.json({ success: false, message: "用户名已存在" }); }
});

/* ===== 删除用户 ===== */
router.delete("/users/:username", authMiddleware, adminMiddleware, (req, res) => {
  const t = db.prepare("SELECT is_admin FROM users WHERE username=?").get(req.params.username);
  if (!t) return res.json({ success: false, message: "用户不存在" });
  if (t.is_admin) return res.json({ success: false, message: "不能删除管理员" });
  db.prepare("DELETE FROM users WHERE username=?").run(req.params.username);
  res.json({ success: true });
});

/* ===== 重置密码 ===== */
router.post("/admin/reset-password", authMiddleware, adminMiddleware, async (req, res) => {
  const { username, newPassword } = req.body;
  if (!username || !newPassword || newPassword.length < 6) return res.json({ success: false, message: "参数不足" });
  db.prepare("UPDATE users SET password=? WHERE username=?").run(await bcrypt.hash(newPassword, 10), username);
  res.json({ success: true });
});

module.exports = router;
