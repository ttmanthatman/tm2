/**
 * TeamChat 认证路由
 * 登录、注册、修改密码
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { JWT_SECRET } = require("../config");
const { db, getSetting } = require("../database");
const { authMiddleware } = require("../middleware");

const router = express.Router();

/* ===== 登录 ===== */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: "缺少参数" });

  const user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.json({ success: false, message: "用户名或密码错误" });
  }

  const loginAt = new Date().toISOString();
  db.prepare("UPDATE users SET last_login_at=? WHERE id=?").run(loginAt, user.id);

  const token = jwt.sign(
    { userId: user.id, username: user.username, isAdmin: user.is_admin, loginAt },
    JWT_SECRET, { expiresIn: "7d" }
  );

  /* 踢掉已有会话 (需要通过 io 实例，由 socket 模块处理) */
  const io = req.app.get("io");
  const onlineUsers = req.app.get("onlineUsers");
  if (io && onlineUsers) {
    for (const [sid, info] of onlineUsers.entries()) {
      if (info.userId === user.id) {
        const s = io.sockets.sockets.get(sid);
        if (s) { s.emit("kicked", { message: "您的账号已在其他设备登录" }); s.disconnect(true); }
      }
    }
  }

  /* 确保用户在默认频道 */
  const defCh = db.prepare("SELECT id FROM channels WHERE is_default=1").get();
  if (defCh) {
    db.prepare("INSERT OR IGNORE INTO channel_members (channel_id, user_id, role) VALUES (?, ?, 'member')").run(defCh.id, user.id);
  }

  res.json({
    success: true, token, username: user.username, userId: user.id,
    nickname: user.nickname, avatar: user.avatar, isAdmin: !!user.is_admin
  });
});

/* ===== 公开注册 ===== */
router.post("/public-register", async (req, res) => {
  if (getSetting("registration_open") !== "1") {
    return res.json({ success: false, message: "注册通道已关闭" });
  }
  const { username, password, nickname } = req.body;
  if (!username || !password) return res.json({ success: false, message: "缺少参数" });
  if (!/^[a-zA-Z0-9_.\-]+$/.test(username)) return res.json({ success: false, message: "用户名只允许字母数字下划线" });
  if (username.length < 2 || username.length > 20) return res.json({ success: false, message: "用户名需 2-20 字符" });
  if (password.length < 6) return res.json({ success: false, message: "密码不能小于6位" });

  try {
    const r = db.prepare("INSERT INTO users (username,password,nickname) VALUES (?,?,?)").run(
      username, await bcrypt.hash(password, 10), nickname || username
    );
    /* 加入所有公开频道 */
    const pubChs = db.prepare("SELECT id FROM channels WHERE is_private=0").all();
    pubChs.forEach(ch => {
      db.prepare("INSERT OR IGNORE INTO channel_members (channel_id,user_id,role) VALUES (?,?,'member')").run(ch.id, r.lastInsertRowid);
    });
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, message: "用户名已存在" });
  }
});

/* ===== 修改密码 ===== */
router.post("/change-password", authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.json({ success: false, message: "新密码不能小于6位" });

  const user = db.prepare("SELECT password FROM users WHERE id=?").get(req.user.userId);
  if (!user) return res.json({ success: false, message: "用户不存在" });
  if (!(await bcrypt.compare(oldPassword, user.password))) return res.json({ success: false, message: "原密码错误" });

  db.prepare("UPDATE users SET password=? WHERE id=?").run(await bcrypt.hash(newPassword, 10), req.user.userId);
  res.json({ success: true });
});

module.exports = router;
