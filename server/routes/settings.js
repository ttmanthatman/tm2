/**
 * TeamChat 设置路由
 * 外观、通知、时区、注册开关
 */
const express = require("express");
const { getSetting, setSetting } = require("../database");
const { VALID_TIMEZONES } = require("../config");
const { authMiddleware, adminMiddleware } = require("../middleware");

const router = express.Router();

const APPEARANCE_KEYS = [
  "login_title","chat_title","send_text","send_color",
  "bg_type","bg_color","bg_image","bg_mode","bg_video","bg_video_url","bg_video_mode",
  "login_bg_type","login_bg_color1","login_bg_color2","login_bg_image",
  "login_bg_mode","login_bg_video","login_bg_video_url","login_bg_video_mode",
  /* 气泡样式 */
  "bubble_style","bubble_my_color1","bubble_my_color2","bubble_my_text",
  "bubble_other_color1","bubble_other_color2","bubble_other_text",
  "bubble_gradient_angle","bubble_3d_intensity","bubble_3d_bevel",
  "bubble_border_on","bubble_border_width","bubble_border_color1","bubble_border_color2",
  "bubble_shadow_offset","bubble_shadow_blur","bubble_shadow_spread","bubble_shadow_opacity","bubble_shadow_color","bubble_shadow_angle"
];

/* ===== 通知 ===== */
router.get("/settings/notice", (req, res) => {
  res.json({ content: getSetting("pinned_notice"), enabled: getSetting("pinned_notice_enabled") === "1" });
});

router.post("/settings/notice", authMiddleware, adminMiddleware, (req, res) => {
  const { content, enabled } = req.body;
  if (typeof content === "string") setSetting("pinned_notice", content.substring(0, 2000));
  if (typeof enabled === "boolean") setSetting("pinned_notice_enabled", enabled ? "1" : "0");
  const d = { content: getSetting("pinned_notice"), enabled: getSetting("pinned_notice_enabled") === "1" };
  const io = req.app.get("io");
  if (io) io.emit("noticeChanged", d);
  res.json({ success: true });
});

/* ===== 注册开关 ===== */
router.get("/settings/registration", (req, res) => {
  res.json({ open: getSetting("registration_open") === "1" });
});

router.post("/settings/registration", authMiddleware, adminMiddleware, (req, res) => {
  const { open } = req.body;
  setSetting("registration_open", open ? "1" : "0");
  const io = req.app.get("io");
  if (io) io.emit("registrationChanged", { open: !!open });
  res.json({ success: true, open: !!open });
});

/* ===== 时区 ===== */
router.get("/settings/timezone", authMiddleware, (req, res) => {
  res.json({ timezone: getSetting("timezone"), serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
});

router.post("/settings/timezone", authMiddleware, adminMiddleware, (req, res) => {
  const { timezone } = req.body;
  if (!timezone || !VALID_TIMEZONES.includes(timezone)) {
    return res.json({ success: false, message: "不支持的时区" });
  }
  setSetting("timezone", timezone);
  const io = req.app.get("io");
  if (io) io.emit("timezoneChanged", { timezone });
  res.json({ success: true });
});

/* ===== 外观 ===== */
router.get("/settings/appearance", (req, res) => {
  const r = {};
  [...APPEARANCE_KEYS, "timezone"].forEach(k => { r[k] = getSetting(k); });
  res.json(r);
});

router.post("/settings/appearance", authMiddleware, adminMiddleware, (req, res) => {
  const body = req.body;
  const { db } = require("../database");
  const upd = db.prepare("INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES (?,?,datetime('now'))");
  db.transaction(() => {
    for (const k of APPEARANCE_KEYS) {
      if (body[k] !== undefined) upd.run(k, String(body[k]));
    }
  })();
  const bd = {};
  [...APPEARANCE_KEYS, "timezone"].forEach(k => { bd[k] = getSetting(k); });
  const io = req.app.get("io");
  if (io) io.emit("appearanceChanged", bd);
  res.json({ success: true });
});

module.exports = router;
