/**
 * TeamChat 文件上传配置
 * Multer 存储策略、文件过滤
 */
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { UPLOAD_DIR, AVATAR_DIR, BG_DIR, VOICE_DIR, ALLOWED_EXT } = require("./config");

function fixFilename(file) {
  try {
    const raw = file.originalname;
    let hasNonAscii = false;
    for (let i = 0; i < raw.length; i++) {
      if (raw.charCodeAt(i) > 127) { hasNonAscii = true; break; }
    }
    if (!hasNonAscii) return;
    const buf = Buffer.from(raw, "latin1");
    const dec = buf.toString("utf8");
    if (!dec.includes("\ufffd")) file.originalname = dec;
  } catch(e) {}
}

/* ===== 聊天文件上传 ===== */
const storage = multer.diskStorage({
  destination: (r, f, cb) => cb(null, UPLOAD_DIR),
  filename: (r, f, cb) => { fixFilename(f); cb(null, uuidv4() + path.extname(f.originalname).toLowerCase()); }
});
function fileFilter(r, f, cb) {
  fixFilename(f);
  const ext = path.extname(f.originalname).toLowerCase();
  cb(ALLOWED_EXT.includes(ext) ? null : new Error("不支持的文件类型"), ALLOWED_EXT.includes(ext));
}
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter, defParamCharset: "utf8" });

/* ===== 头像上传 ===== */
const avatarStorage = multer.diskStorage({
  destination: (r, f, cb) => cb(null, AVATAR_DIR),
  filename: (r, f, cb) => { fixFilename(f); cb(null, uuidv4() + path.extname(f.originalname).toLowerCase()); }
});
const IMG_EXT = [".jpg",".jpeg",".png",".gif",".webp"];
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (r, f, cb) => {
    fixFilename(f);
    const ext = path.extname(f.originalname).toLowerCase();
    cb(IMG_EXT.includes(ext) ? null : new Error("头像只支持图片"), IMG_EXT.includes(ext));
  },
  defParamCharset: "utf8"
});

/* ===== 背景上传 ===== */
const bgStorage = multer.diskStorage({
  destination: (r, f, cb) => cb(null, BG_DIR),
  filename: (r, f, cb) => { fixFilename(f); cb(null, uuidv4() + path.extname(f.originalname).toLowerCase()); }
});
const BG_EXT = [".jpg",".jpeg",".png",".gif",".webp",".bmp",".svg",".mp4",".mov",".webm",".m4v"];
const uploadBg = multer({
  storage: bgStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (r, f, cb) => {
    fixFilename(f);
    const ext = path.extname(f.originalname).toLowerCase();
    cb(BG_EXT.includes(ext) ? null : new Error("背景只支持图片或视频"), BG_EXT.includes(ext));
  },
  defParamCharset: "utf8"
});

/* ===== 语音上传 ===== */
const voiceStorage = multer.diskStorage({
  destination: (r, f, cb) => cb(null, VOICE_DIR),
  filename: (r, f, cb) => cb(null, uuidv4() + ".webm")
});
const uploadVoice = multer({
  storage: voiceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (r, f, cb) => {
    /* 只接受 webm / ogg (Opus 编码容器) */
    const ok = /^audio\/(webm|ogg)/.test(f.mimetype);
    cb(ok ? null : new Error("语音格式不支持"), ok);
  }
});

module.exports = { upload, uploadAvatar, uploadBg, uploadVoice };
