/**
 * TeamChat 推送通知服务
 * Web Push 发送逻辑
 */
const webpush = require("web-push");
const { db, getSetting } = require("./database");

function sendPushToOthers(senderUserId, senderName, messageText, channelId) {
  const ch = db.prepare("SELECT * FROM channels WHERE id=?").get(channelId);
  let subs;
  if (ch && ch.is_private) {
    subs = db.prepare(
      "SELECT ps.* FROM push_subscriptions ps JOIN channel_members cm ON ps.user_id = cm.user_id WHERE cm.channel_id = ? AND ps.user_id != ?"
    ).all(channelId, senderUserId);
  } else {
    subs = db.prepare("SELECT * FROM push_subscriptions WHERE user_id != ?").all(senderUserId);
  }

  const chatTitle = getSetting("chat_title") || "TeamChat";
  const body = messageText.replace(/<[^>]*>/g, "");
  const payload = JSON.stringify({
    title: chatTitle,
    body: senderName + ": " + (body.length > 100 ? body.substring(0, 100) + "..." : body),
    icon: "/images/icon-192.png",
    data: { url: "/" }
  });

  for (const sub of subs) {
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
      payload,
      { TTL: 86400, urgency: "high", topic: "teamchat-msg" }
    ).catch(err => {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare("DELETE FROM push_subscriptions WHERE id=?").run(sub.id);
      }
    });
  }
}

module.exports = { sendPushToOthers };
