/**
 * TeamChat 文件上传配置
 * Multer 存储策略、文件过滤
 */
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { UPLOAD_DIR, AVATAR_DIR, BG_DIR, VOICE_DIR, ALLOWED_EXT } = require("./config");

/* v0.5.9: 检测原文件名是否已经是正确的 Unicode 字符串
 * - 任何码点 > 255: 一定已是正确 Unicode (含多字节字符), 直接放过
 *   (如果再 Buffer.from(raw, "latin1") 会取低字节, 把 "展" 0x5C55 变成 'U' 0x55)
 * - 全部码点 ≤ 255 但有 > 127: 推测是某些客户端按 latin1 发送的 UTF-8 字节
 *   (例如未正确声明 charset 的旧版浏览器), 转回字节再按 UTF-8 解码
 * - 全 ASCII: 无需处理 */
function fixFilename(file) {
  try {
    const raw = file.originalname;
    if (!raw) return;
    let hasNonAscii = false;
    let hasHighCodepoint = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i);
      if (c > 255) { hasHighCodepoint = true; break; }
      if (c > 127) hasNonAscii = true;
    }
    if (hasHighCodepoint) return; /* 已是正确 Unicode, 不要再回炒 */
    if (!hasNonAscii) return;     /* 纯 ASCII, 无需处理 */
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
const VOICE_MIME_EXT = {
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/aac": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/mpeg": ".mp3",
};
const voiceStorage = multer.diskStorage({
  destination: (r, f, cb) => cb(null, VOICE_DIR),
  filename: (r, f, cb) => {
    /* 根据实际 MIME 类型选择正确扩展名 */
    const base = f.mimetype.split(";")[0].trim().toLowerCase();
    const ext = VOICE_MIME_EXT[base] || ".webm";
    cb(null, uuidv4() + ext);
  }
});
const uploadVoice = multer({
  storage: voiceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (r, f, cb) => {
    /* 接受 webm / ogg / mp4 / aac / m4a (覆盖 iOS Safari) */
    const base = f.mimetype.split(";")[0].trim().toLowerCase();
    const ok = !!VOICE_MIME_EXT[base];
    cb(ok ? null : new Error("语音格式不支持"), ok);
  }
});

module.exports = { upload, uploadAvatar, uploadBg, uploadVoice };
