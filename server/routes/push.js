/**
 * TeamChat 推送路由
 * VAPID key、订阅/取消/续期
 */
const express = require("express");
const { vapidKeys } = require("../config");
const { db } = require("../database");
const { authMiddleware } = require("../middleware");

const router = express.Router();

router.get("/push/vapid-key", (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

router.post("/push/subscribe", authMiddleware, (req, res) => {
  const { subscription, oldEndpoint } = req.body;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.json({ success: false, message: "无效数据" });
  }
  try {
    if (oldEndpoint) db.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").run(oldEndpoint);
    db.prepare("INSERT OR REPLACE INTO push_subscriptions (user_id,endpoint,keys_p256dh,keys_auth) VALUES (?,?,?,?)").run(
      req.user.userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth
    );
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, message: "保存失败" });
  }
});

router.post("/push/unsubscribe", authMiddleware, (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) db.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").run(endpoint);
  res.json({ success: true });
});

router.post("/push/renew", authMiddleware, (req, res) => {
  const { subscription, oldEndpoint } = req.body;
  if (!subscription || !subscription.endpoint || !subscription.keys || !oldEndpoint) {
    return res.json({ success: false });
  }
  try {
    const old = db.prepare("SELECT user_id FROM push_subscriptions WHERE endpoint=?").get(oldEndpoint);
    if (!old) return res.json({ success: false });
    db.prepare("DELETE FROM push_subscriptions WHERE endpoint=?").run(oldEndpoint);
    db.prepare("INSERT OR REPLACE INTO push_subscriptions (user_id,endpoint,keys_p256dh,keys_auth) VALUES (?,?,?,?)").run(
      old.user_id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth
    );
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false });
  }
});

module.exports = router;
