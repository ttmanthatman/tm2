/**
 * TeamChat Socket.IO 处理模块
 * 实时消息、在线状态、接龙
 * v0.5.0: 消息持久化后调用 AI trigger 评估器
 * v0.5.6: 每分钟广播 aiStatusTick, 让前端更新 AI 在线状态
 */
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./config");
const { db, canAccessChannel, canWriteChannel } = require("./database");
const { sendPushToOthers } = require("./push-service");

const onlineUsers = new Map();
const userSocketMap = new Map();

function broadcastOnlineUsers(io) {
  io.emit("onlineUsers", [
    ...new Map(
      Array.from(onlineUsers.values()).map(u => [u.username, u])
    ).values()
  ]);
}

function setupSocket(io) {
  /* ===== 认证中间件 ===== */
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("未提供认证信息"));
    try {
      const d = jwt.verify(token, JWT_SECRET);
      const u = db.prepare("SELECT last_login_at FROM users WHERE id=?").get(d.userId);
      if (u && u.last_login_at && d.loginAt && u.last_login_at !== d.loginAt) {
        return next(new Error("认证失败"));
      }
      socket.user = d;
      next();
    } catch(e) {
      next(new Error("认证失败"));
    }
  });

  /* ===== 连接处理 ===== */
  io.on("connection", (socket) => {
    const userId = socket.user.userId;

    const oldSid = userSocketMap.get(userId);
    if (oldSid && oldSid !== socket.id) {
      const s = io.sockets.sockets.get(oldSid);
      if (s) {
        s.emit("kicked", { message: "您的账号已在其他设备登录" });
        s.disconnect(true);
      }
      onlineUsers.delete(oldSid);
    }
    userSocketMap.set(userId, socket.id);

    const ui = db.prepare("SELECT nickname,avatar FROM users WHERE id=?").get(userId);
    onlineUsers.set(socket.id, {
      username: socket.user.username, userId,
      nickname: ui ? ui.nickname : socket.user.username,
      avatar: ui ? ui.avatar : null
    });
    broadcastOnlineUsers(io);

    const userChannels = db.prepare("SELECT channel_id FROM channel_members WHERE user_id=?").all(userId);
    userChannels.forEach(c => socket.join("ch:" + c.channel_id));
    db.prepare("SELECT id FROM channels WHERE is_private=0").all().forEach(c => socket.join("ch:" + c.id));

    socket.on("switchChannel", (data) => {
      if (data && data.channelId && canAccessChannel(userId, data.channelId)) {
        socket.join("ch:" + data.channelId);
      }
    });

    /* ===== 发送消息 ===== */
    socket.on("sendMessage", (data) => {
      if (!data || typeof data !== "object") return;
      const { content, replyTo, channelId } = data;
      if (!content || typeof content !== "string" || content.trim().length === 0) return;

      const chId = parseInt(channelId) || 1;
      if (!canWriteChannel(userId, chId)) return;

      let trimmed = content.trim().substring(0, 10000);
      const isChain = trimmed.startsWith("[CHAIN]");

      if (isChain) {
        try {
          const cd = JSON.parse(trimmed.substring(7));
          if (!cd.type || cd.type !== "chain" || !cd.topic) return;
        } catch(e) { return; }
      } else {
        trimmed = trimmed.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, "");
        trimmed = trimmed.replace(/<(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, "");
        trimmed = trimmed.replace(/\s+on[a-z]+\s*=\s*["'][^"']*["']/gi, "");
        trimmed = trimmed.replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "");
        trimmed = trimmed.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
        if (!trimmed.replace(/<[^>]*>/g, "").trim() && !/<br\s*\/?>/i.test(trimmed)) return;
      }

      const safeReplyTo = (Number.isInteger(replyTo) && replyTo > 0) ? replyTo : null;
      const nowUtc = new Date().toISOString();

      const result = db.prepare(
        "INSERT INTO messages (user_id,username,content,reply_to,channel_id,created_at) VALUES (?,?,?,?,?,?)"
      ).run(userId, socket.user.username, trimmed, safeReplyTo, chId, nowUtc);

      const user = db.prepare("SELECT nickname,avatar,is_ai FROM users WHERE id=?").get(userId);
      const message = {
        id: result.lastInsertRowid,
        username: socket.user.username,
        nickname: user ? user.nickname : socket.user.username,
        avatar: user ? user.avatar : null,
        content: trimmed, type: "text",
        reply_to: safeReplyTo,
        channel_id: chId,
        created_at: nowUtc,
        is_ai: user && user.is_ai ? 1 : 0
      };
      io.to("ch:" + chId).emit("newMessage", message);

      let pushText;
      if (isChain) {
        try { pushText = "[接龙] " + JSON.parse(trimmed.substring(7)).topic; }
        catch(e) { pushText = "[接龙]"; }
      } else {
        pushText = trimmed.replace(/<[^>]*>/g, "").substring(0, 200);
      }
      sendPushToOthers(userId, user ? user.nickname : socket.user.username, pushText, chId);

      /* ===== v0.5.0: AI 触发评估 =====
       * 不 await，异步跑，不卡主消息路径。
       * trigger.evaluate 内部自己判断是否是人类发的消息。 */
      try {
        const aiTrigger = require("./ai/trigger");
        aiTrigger.evaluate({
          message: {
            id: result.lastInsertRowid,
            user_id: userId,
            username: socket.user.username,
            content: trimmed,
            type: "text",
            channel_id: chId
          },
          io
        });
      } catch(e) {
        console.error("[AI trigger hook]", e && e.message);
      }
    });

    /* ===== 接龙更新 ===== */
    socket.on("updateChain", (data) => {
      if (!data || typeof data !== "object") return;
      const { messageId, content, channelId } = data;
      if (!messageId || !content || typeof content !== "string" || !content.startsWith("[CHAIN]")) return;

      let chainData;
      try {
        chainData = JSON.parse(content.substring(7));
        if (!chainData.type || chainData.type !== "chain") return;
      } catch(e) { return; }

      const origMsg = db.prepare("SELECT id,content,channel_id FROM messages WHERE id=?").get(messageId);
      if (!origMsg || !origMsg.content.startsWith("[CHAIN]")) return;

      let origData;
      try { origData = JSON.parse(origMsg.content.substring(7)); } catch(e) { return; }

      const username = socket.user.username;
      if (origData.participants && origData.participants.some(p => p.username === username)) return;

      const user = db.prepare("SELECT nickname FROM users WHERE id=?").get(userId);
      const myName = user ? user.nickname : username;

      if (!origData.participants) origData.participants = [];
      origData.participants.push({
        seq: origData.participants.length + 1,
        username, name: myName, text: ""
      });

      const newContent = "[CHAIN]" + JSON.stringify(origData);
      db.prepare("UPDATE messages SET content=? WHERE id=?").run(newContent, messageId);
      io.to("ch:" + origMsg.channel_id).emit("chainUpdated", { messageId, content: newContent, channelId: origMsg.channel_id });
      sendPushToOthers(userId, myName, "[接龙] " + myName + " 参与了: " + origData.topic, origMsg.channel_id);
    });

    socket.on("disconnect", () => {
      if (userSocketMap.get(userId) === socket.id) userSocketMap.delete(userId);
      onlineUsers.delete(socket.id);
      broadcastOnlineUsers(io);
    });
  });

  /* v0.5.6: 每分钟广播一次 "ai 在线状态可能变化",
   * 让前端重新拉 /api/users/basic 更新 AI 角色的在线徽标. */
  setInterval(() => {
    try {
      io.emit("aiStatusTick");
    } catch(e) {}
  }, 60 * 1000);
}

module.exports = { setupSocket, onlineUsers, userSocketMap };
