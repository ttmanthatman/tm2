/**
 * TeamChat v9 — 模块化入口
 * 组装所有模块，启动服务
 */
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const { PORT, UPLOAD_DIR, AVATAR_DIR, BG_DIR } = require("./config");
const { db } = require("./database");

/* ===== Express App ===== */
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

/* 将 io 和 onlineUsers 挂载到 app，供路由使用 */
const { setupSocket, onlineUsers } = require("./socket");
app.set("io", io);
app.set("onlineUsers", onlineUsers);

/* ===== 全局中间件 ===== */
app.use(cors());
app.use(express.json({ limit: "5mb" }));

/* ===== 静态文件 (特殊缓存策略) ===== */
app.get("/sw.js", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Content-Type", "application/javascript");
  res.sendFile(path.join(__dirname, "..", "public", "sw.js"));
});
app.get("/manifest.json", (req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Content-Type", "application/manifest+json");
  res.sendFile(path.join(__dirname, "..", "public", "manifest.json"));
});
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/avatars", express.static(AVATAR_DIR));
app.use("/backgrounds", express.static(BG_DIR));

/* ===== API 路由 ===== */
app.use("/api", require("./routes/auth"));
app.use("/api", require("./routes/channels"));
app.use("/api", require("./routes/messages"));
app.use("/api", require("./routes/settings"));
app.use("/api", require("./routes/users"));
app.use("/api", require("./routes/push"));
app.use("/api", require("./routes/backup"));
app.use("/api", require("./routes/admin-files"));

/* ===== SPA 回退 ===== */
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api/")) {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

/* ===== Socket.IO ===== */
setupSocket(io);

/* ===== 优雅退出 ===== */
process.on("SIGTERM", () => {
  io.close();
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000);
});

/* ===== 启动 ===== */
server.listen(PORT, () => {
  console.log("TeamChat v9 (模块化) 服务器运行在端口 " + PORT);
});
