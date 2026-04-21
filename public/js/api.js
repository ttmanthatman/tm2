/**
 * TeamChat API 客户端
 * 频道/消息加载、外观配置
 *
 * 本文件相对仓库版本的改动:
 *   1) applyAppearance(): bg_type === 'video' 时把 <video> 挂到 .messages-wrapper
 *      (原来挂在 .messages 里, 会被滚动内容一起顶走).
 *   2) _ensureBgVideoCss(): 选择器匹配 .messages-wrapper > .messages,
 *      视频/图片模式下都强制 .messages 自身透明, 让背景层真正显出来.
 *   3) 图片背景也改为设在 .messages-wrapper 上(不滚动), 而非 .messages(会跟内容滚).
 */

/* ===== 频道 ===== */
async function loadChannels() {
  try {
    const r = await fetch(API + '/api/channels', { headers: authH() });
    if (r.ok) {
      const chs = await r.json();
      store.channels = chs.map(c => ({ ...c, _unread: 0 }));
    }
  } catch(e) {}
}

async function switchChannel(id) {
  store.currentChannelId = id;
  localStorage.setItem('currentChannelId', id);
  const c = store.channels.find(c => c.id === id);
  if (c) c._unread = 0;
  if (!msgStore[id] || !msgStore[id].msgs.length) await loadMessages(id);
  if (socket) socket.emit('switchChannel', { channelId: id });
  Vue.nextTick(() => scrollBottom());
}

/* ===== 消息 ===== */
async function loadMessages(channelId, before) {
  if (!channelId) return;
  if (!msgStore[channelId]) {
    msgStore[channelId] = { msgs: [], oldest: null, allLoaded: false };
  }
  const ch = msgStore[channelId];
  if (ch.allLoaded && before) return;

  let url = API + '/api/messages?channelId=' + channelId + '&limit=50';
  if (before && ch.oldest) url += '&before=' + ch.oldest;

  try {
    const r = await fetch(url, { headers: authH() });
    if (r.status === 401) { clearAuth(); return; }
    if (r.status === 403) return;
    const msgs = await r.json();
    if (msgs.length < 50) ch.allLoaded = true;
    if (msgs.length) {
      if (before) { ch.msgs.unshift(...msgs); } else { ch.msgs.push(...msgs); }
      ch.oldest = ch.msgs[0].id;
    }
  } catch(e) { console.error('loadMessages:', e); }
}

/* ===== 外观 ===== */
async function loadAppearance() {
  /* 先从缓存恢复，冷启动不用等网络 */
  try {
    var cached = localStorage.getItem('tc_appearance');
    if (cached) {
      var cd = JSON.parse(cached);
      store.appearance = cd;
      applyAppearance(cd);
    }
  } catch(e) {}
  /* 再从服务器拉最新 */
  try {
    const r = await fetch(API + '/api/settings/appearance');
    if (r.ok) {
      const d = await r.json();
      store.appearance = d;
      localStorage.setItem('tc_appearance', JSON.stringify(d));
      applyAppearance(d);
    }
  } catch(e) {}
}

/* ----- 视频墙纸辅助: 注入一次全局 CSS ----- */
function _ensureBgVideoCss() {
  if (document.getElementById('tc-bg-video-css')) return;
  const s = document.createElement('style');
  s.id = 'tc-bg-video-css';
  s.textContent =
    /* 视频本体: 绝对定位铺满父容器, 不抢事件 */
    '.tc-bg-video{position:absolute;inset:0;width:100%;height:100%;' +
      'z-index:0;pointer-events:none;display:block;background:#000}' +
    /* 关键: 背景(视频/图片)挂在 wrapper 上, .messages 必须透明才能透出来,
     * 同时保持 z-index:1 让消息浮在背景之上 */
    '.messages-wrapper > .messages{position:relative;z-index:1}' +
    '.messages-wrapper.tc-has-bg-video > .messages,' +
    '.messages-wrapper.tc-has-bg-image > .messages{background:transparent !important}' +
    /* 登录页保持原逻辑: 视频是 login-page 的直接子元素 */
    '.login-page > *:not(.tc-bg-video){position:relative;z-index:1}';
  document.head.appendChild(s);
}

function _videoFit(mode) {
  if (mode === 'fit')     return 'contain';
  if (mode === 'stretch') return 'fill';
  /* 'fill'(填充) / 'tile' / 其它 -> cover */
  return 'cover';
}

function _mountBgVideo(host, src, mode) {
  /* 先移除旧的, 避免反复叠加 */
  const old = host.querySelector(':scope > .tc-bg-video');
  if (old) old.remove();

  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative';
  }
  /* 防止视频被 host 的 overflow 漏出去 */
  if (getComputedStyle(host).overflow === 'visible') {
    host.style.overflow = 'hidden';
  }

  const v = document.createElement('video');
  v.className = 'tc-bg-video';
  v.src = src;
  v.muted = true;
  v.autoplay = true;
  v.loop = true;
  v.playsInline = true;
  /* iOS Safari 需要属性形式 */
  v.setAttribute('muted', '');
  v.setAttribute('playsinline', '');
  v.setAttribute('autoplay', '');
  v.setAttribute('loop', '');
  v.style.objectFit = _videoFit(mode);
  host.prepend(v);
  /* 部分浏览器 autoplay 不触发, 主动调一下 */
  const p = v.play();
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

function _removeBgVideo(host) {
  if (!host) return;
  const old = host.querySelector(':scope > .tc-bg-video');
  if (old) old.remove();
}

function applyAppearance(d) {
  if (!d) return;
  if (d.timezone) store.timezone = d.timezone;
  _ensureBgVideoCss();

  const sb = document.querySelector('.input-area .send-btn');
  if (sb) {
    if (d.send_text) sb.textContent = d.send_text;
    if (d.send_color) sb.style.background = d.send_color;
  }

  /* ===== 聊天背景 =====
   * 视频必须挂到 .messages-wrapper (overflow:hidden, 不滚动),
   * 不能挂到 .messages (overflow-y:auto, 绝对定位子元素会跟内容滚走).
   */
  const wrap = document.querySelector('.messages-wrapper');
  const ml   = document.querySelector('.messages');
  if (wrap && ml) {
    if (d.bg_type === 'video' && d.bg_video) {
      /* 视频模式 */
      wrap.classList.add('tc-has-bg-video');
      wrap.classList.remove('tc-has-bg-image');
      wrap.style.backgroundColor    = d.bg_color || '#000';
      wrap.style.backgroundImage    = '';
      wrap.style.backgroundSize     = '';
      wrap.style.backgroundPosition = '';
      wrap.style.backgroundRepeat   = '';
      ml.style.backgroundImage      = 'none';
      ml.style.backgroundAttachment = '';
      ml.style.backgroundColor      = 'transparent';
      _mountBgVideo(
        wrap,
        API + '/backgrounds/' + encodeURIComponent(d.bg_video),
        d.bg_video_mode
      );
    } else if (d.bg_type === 'image' && d.bg_image) {
      /* 图片模式 — 背景挂到 wrapper(不滚动), messages 透明 */
      wrap.classList.remove('tc-has-bg-video');
      wrap.classList.add('tc-has-bg-image');
      _removeBgVideo(wrap);
      /* 清理 ml 上可能残留的旧背景样式 */
      ml.style.backgroundImage      = 'none';
      ml.style.backgroundAttachment = '';
      ml.style.backgroundColor      = 'transparent';
      /* 背景设在 wrap 上 */
      wrap.style.backgroundImage    = 'url(' + API + '/backgrounds/' + encodeURIComponent(d.bg_image) + ')';
      wrap.style.backgroundSize     = d.bg_mode === 'tile' ? 'auto' : 'cover';
      wrap.style.backgroundPosition = 'center';
      wrap.style.backgroundRepeat   = d.bg_mode === 'tile' ? 'repeat' : 'no-repeat';
      wrap.style.backgroundColor    = d.bg_color || '#f0f2f5';
    } else {
      /* 纯色 / 默认 — 清理 wrap 和 ml 上所有背景残留 */
      wrap.classList.remove('tc-has-bg-video');
      wrap.classList.remove('tc-has-bg-image');
      wrap.style.backgroundColor    = '';
      wrap.style.backgroundImage    = '';
      wrap.style.backgroundSize     = '';
      wrap.style.backgroundPosition = '';
      wrap.style.backgroundRepeat   = '';
      _removeBgVideo(wrap);
      ml.style.backgroundImage      = 'none';
      ml.style.backgroundAttachment = '';
      ml.style.backgroundColor      = d.bg_color || '#f0f2f5';
    }
  }

  /* ===== 登录页背景 ===== */
  const lp = document.querySelector('.login-page');
  if (lp) {
    const lbt = d.login_bg_type || 'gradient';
    if (lbt === 'video' && d.login_bg_video) {
      lp.style.background = d.login_bg_color1 || '#000';
      _mountBgVideo(
        lp,
        API + '/backgrounds/' + encodeURIComponent(d.login_bg_video),
        d.login_bg_video_mode
      );
    } else if (lbt === 'color') {
      _removeBgVideo(lp);
      lp.style.background = d.login_bg_color1 || '#667eea';
    } else if (lbt === 'image' && d.login_bg_image) {
      _removeBgVideo(lp);
      lp.style.background = 'url(' + API + '/backgrounds/' + encodeURIComponent(d.login_bg_image) + ') center/cover no-repeat';
    } else {
      _removeBgVideo(lp);
      lp.style.background = 'linear-gradient(135deg,' + (d.login_bg_color1 || '#667eea') + ' 0%,' + (d.login_bg_color2 || '#764ba2') + ' 100%)';
    }
  }

  /* iOS Safari: JS 设置 background-image 后有时不触发 repaint, 强制刷一下 */
  requestAnimationFrame(function() {
    document.body.style.transform = 'translateZ(0)';
    requestAnimationFrame(function() { document.body.style.transform = ''; });
  });
}

/* ===== 用户导入/导出 ===== */
async function exportUsers() {
  const r = await fetch(API + '/api/admin/users/export', { headers: authH() });
  if (!r.ok) throw new Error('导出失败 (HTTP ' + r.status + ')');
  return await r.json();
}

async function importUsers(users) {
  const r = await fetch(API + '/api/admin/users/import', {
    method: 'POST',
    headers: authH({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ users })
  });
  if (!r.ok) throw new Error('导入失败 (HTTP ' + r.status + ')');
  return await r.json();
}
