/**
 * TeamChat 备份路由
 * 导出、还原聊天记录
 */
const express = require("express");
const { db, normalizeToUTC } = require("../database");
const { authMiddleware, adminMiddleware } = require("../middleware");

const router = express.Router();

/* ===== 导出 ===== */
router.get("/backup", authMiddleware, adminMiddleware, (req, res) => {
  const { startDate, endDate } = req.query;
  let sql = "SELECT m.*,u.username as user_username,u.nickname,u.avatar FROM messages m JOIN users u ON m.user_id=u.id";
  const p = [];
  if (startDate && endDate) {
    sql += " WHERE DATE(m.created_at) BETWEEN ? AND ?";
    p.push(startDate, endDate);
  }
  sql += " ORDER BY m.id";
  res.json({
    messages: db.prepare(sql).all(...p).map(m => { m.created_at = normalizeToUTC(m.created_at); return m; })
  });
});

/* ===== 还原 ===== */
router.post("/restore", authMiddleware, adminMiddleware, (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) return res.json({ success: false, message: "格式错误" });

  let count = 0;
  const ins = db.prepare(
    "INSERT INTO messages (user_id,username,content,type,file_name,file_path,file_size,channel_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  );

  try {
    db.transaction(ms => {
      for (const m of ms) {
        const u = db.prepare("SELECT id FROM users WHERE username=?").get(m.username);
        if (u) {
          ins.run(u.id, m.username, m.content, m.type, m.file_name, m.file_path, m.file_size, m.channel_id || 1, m.created_at);
          count++;
        }
      }
    })(messages);
    res.json({ success: true, count });
  } catch(e) {
    res.json({ success: false, message: "恢复失败" });
  }
});

module.exports = router;
