/**
 * TeamChat 配置模块
 * 管理密钥、路径、端口等全局配置
 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const webpush = require("web-push");

const APP_ROOT = path.resolve(__dirname, "..");
const PORT = process.env.PORT || __PORT_PLACEHOLDER__;

/* ===== 目录 ===== */
const DB_PATH = path.join(APP_ROOT, "database.sqlite");
const UPLOAD_DIR = path.join(APP_ROOT, "uploads");
const AVATAR_DIR = path.join(APP_ROOT, "avatars");
const BG_DIR = path.join(APP_ROOT, "backgrounds");
[UPLOAD_DIR, AVATAR_DIR, BG_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

/* ===== JWT 密钥 ===== */
const SECRET_FILE = path.join(APP_ROOT, ".jwt_secret");
let JWT_SECRET;
if (fs.existsSync(SECRET_FILE)) {
  JWT_SECRET = fs.readFileSync(SECRET_FILE, "utf-8").trim();
} else {
  JWT_SECRET = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(SECRET_FILE, JWT_SECRET, { mode: 0o600 });
}

/* ===== VAPID (Web Push) ===== */
const VAPID_FILE = path.join(APP_ROOT, ".vapid_keys");
let vapidKeys;
if (fs.existsSync(VAPID_FILE)) {
  vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, "utf-8"));
} else {
  vapidKeys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys), { mode: 0o600 });
}
webpush.setVapidDetails(
  "mailto:admin@teamchat.local",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

/* ===== 允许上传的文件类型 ===== */
const ALLOWED_EXT = [
  ".jpg",".jpeg",".png",".gif",".webp",".bmp",
  ".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",
  ".txt",".csv",".zip",".rar",".7z",".mp3",".mp4",".mov"
];

const VALID_TIMEZONES = [
  "Asia/Shanghai","Asia/Tokyo","Asia/Singapore","Asia/Kolkata","Asia/Dubai",
  "Europe/London","Europe/Paris","Europe/Moscow",
  "America/New_York","America/Chicago","America/Denver","America/Los_Angeles",
  "Pacific/Auckland","Australia/Sydney"
];

const DEFAULT_SETTINGS = {
  timezone: "Asia/Shanghai",
  login_title: "团队聊天室",
  chat_title: "TeamChat",
  send_text: "发送",
  send_color: "#667eea",
  bg_type: "color",
  bg_color: "#f0f2f5",
  bg_image: "",
  bg_mode: "cover",
  bg_video: "",
  bg_video_url: "",
  bg_video_mode: "cover",
  pinned_notice: "",
  pinned_notice_enabled: "0",
  registration_open: "0",
  login_bg_type: "gradient",
  login_bg_color1: "#667eea",
  login_bg_color2: "#764ba2",
  login_bg_image: "",
  login_bg_mode: "cover",
  login_bg_video: "",
  login_bg_video_url: "",
  login_bg_video_mode: "cover"
};

module.exports = {
  APP_ROOT, PORT, DB_PATH, UPLOAD_DIR, AVATAR_DIR, BG_DIR,
  JWT_SECRET, vapidKeys,
  ALLOWED_EXT, VALID_TIMEZONES, DEFAULT_SETTINGS
};
