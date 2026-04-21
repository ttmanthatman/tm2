/**
 * TeamChat 中间件
 * JWT 认证、管理员权限检查
 */
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./config");
const { db } = require("./database");

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "未提供认证信息" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare("SELECT id, is_admin, last_login_at FROM users WHERE id = ?").get(decoded.userId);
    if (!user) return res.status(401).json({ success: false, message: "用户不存在" });
    if (user.last_login_at && decoded.loginAt && user.last_login_at !== decoded.loginAt) {
      return res.status(401).json({ success: false, message: "账号已在其他设备登录" });
    }
    req.user = decoded;
    req.user.isAdmin = !!user.is_admin;
    next();
  } catch(e) {
    res.status(401).json({ success: false, message: "认证失败" });
  }
}

function adminMiddleware(req, res, next) {
  if (!req.user.isAdmin) {
    return res.status(403).json({ success: false, message: "需要管理员权限" });
  }
  next();
}

module.exports = { authMiddleware, adminMiddleware };
