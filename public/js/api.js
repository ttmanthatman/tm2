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

/* ===== 全员列表 (供 @提及) ===== */
async function loadAllUsers() {
  try {
    const r = await fetch(API + '/api/users/basic', { headers: authH() });
    if (r.ok) store.allUsers = await r.json();
  } catch(e) {}
}

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

  /* ===== 气泡样式 ===== */
  _applyBubbleStyle(d);

  /* iOS Safari: JS 设置 background-image 后有时不触发 repaint, 强制刷一下 */
  requestAnimationFrame(function() {
    document.body.style.transform = 'translateZ(0)';
    requestAnimationFrame(function() { document.body.style.transform = ''; });
  });
}

/* ===== 气泡样式计算 & CSS 变量写入 ===== */
function _hexToHSL(hex) {
  if (!hex || hex.charAt(0) !== '#') return {h:0,s:0,l:50};
  var r = parseInt(hex.slice(1,3),16)/255;
  var g = parseInt(hex.slice(3,5),16)/255;
  var b = parseInt(hex.slice(5,7),16)/255;
  var max = Math.max(r,g,b), min = Math.min(r,g,b);
  var h, s, l = (max+min)/2;
  if (max===min) { h=s=0; } else {
    var dd = max-min; s = l>.5 ? dd/(2-max-min) : dd/(max+min);
    if (max===r) h = ((g-b)/dd + (g<b?6:0))/6;
    else if (max===g) h = ((b-r)/dd+2)/6;
    else h = ((r-g)/dd+4)/6;
  }
  return {h:h*360, s:s*100, l:l*100};
}
function _hsl(h,s,l) { return 'hsl('+Math.round(h)+','+Math.round(Math.max(0,Math.min(100,s)))+'%,'+Math.round(Math.max(0,Math.min(100,l)))+'%)'; }

function _calc3D(c1, c2, t) {
  var h1 = _hexToHSL(c1), h2 = _hexToHSL(c2);

  /* 高光: 大幅提亮 + 降饱和 (宫崎骏高光偏白/粉, 不是纯色提亮) */
  var hiL = Math.min(h1.l + 35*t, 97);
  var hiS = Math.max(h1.s - 20*t, 0);
  var highlight = _hsl(h1.h, hiS, hiL);

  /* 暗部: 色相偏移 + 加饱和 + 大幅压暗 (宫崎骏阴影是有颜色的, 不是纯黑) */
  var shL = Math.max(h2.l - 30*t, 5);
  var shS = Math.min(h2.s + 15*t, 100);
  var shadow = _hsl(h2.h + 8, shS, shL);

  /* 主体渐变: 高光区占更大比例 (40%) 形成"鼓起"的面 */
  var mainGrad = 'linear-gradient(155deg, '+highlight+' 0%, '+c1+' 40%, '+c2+' 75%, '+shadow+' 100%)';

  /* 镜面高光: 更大更亮的椭圆 + 边缘微光带 */
  var specular = 'radial-gradient(ellipse 80% 50% at 25% 15%, rgba(255,255,255,'+(0.5*t)+') 0%, rgba(255,255,255,'+(0.1*t)+') 50%, transparent 72%)';
  var rimLight = 'linear-gradient(135deg, rgba(255,255,255,'+(0.25*t)+') 0%, transparent 40%, transparent 85%, rgba(0,0,0,'+(0.1*t)+') 100%)';

  var bg = specular + ', ' + rimLight + ', ' + mainGrad;

  /* Inset shadow: 加倍强度, 营造"气球皮"的厚度感 */
  var sh = 'inset 0 '+(4*t)+'px '+(10*t)+'px rgba(255,255,255,'+(0.45*t)+')'   /* 顶部内发光 */
    + ', inset 0 -'+(4*t)+'px '+(12*t)+'px rgba(0,0,0,'+(0.18*t)+')'           /* 底部内阴影 */
    + ', inset '+(3*t)+'px 0 '+(6*t)+'px rgba(255,255,255,'+(0.15*t)+')'        /* 左侧边光 */
    + ', inset -'+(2*t)+'px 0 '+(5*t)+'px rgba(0,0,0,'+(0.08*t)+')'            /* 右侧暗边 */
    + ', 0 '+(4*t)+'px '+(14*t)+'px rgba(0,0,0,'+(0.15*t)+')'                  /* 外投影 (浮起感) */
    + ', 0 '+(1*t)+'px '+(3*t)+'px rgba(0,0,0,'+(0.08*t)+')';                  /* 贴近投影 */

  var avgL = (h1.l + h2.l) / 2;
  var bA = (avgL > 70 ? 0.15 : 0.1) * t;

  return { bg: bg, shadow: sh, border: 'rgba(0,0,0,'+bA+')' };
}

function _applyBubbleStyle(d) {
  var style = d.bubble_style || 'flat';
  var myC1  = d.bubble_my_color1    || '#667eea';
  var myC2  = d.bubble_my_color2    || '#667eea';
  var myT   = d.bubble_my_text      || '#ffffff';
  var otC1  = d.bubble_other_color1 || '#ffffff';
  var otC2  = d.bubble_other_color2 || '#ffffff';
  var otT   = d.bubble_other_text   || '#333333';
  var angle = (parseInt(d.bubble_gradient_angle) || 135) + 'deg';
  var inten = (parseInt(d.bubble_3d_intensity) || 60) / 100;

  var root = document.documentElement.style;
  root.setProperty('--b-my-c1', myC1);
  root.setProperty('--b-my-c2', myC2);
  root.setProperty('--b-my-text', myT);
  root.setProperty('--b-ot-c1', otC1);
  root.setProperty('--b-ot-c2', otC2);
  root.setProperty('--b-ot-text', otT);
  root.setProperty('--b-angle', angle);

  /* 3D 预计算 */
  var my3 = _calc3D(myC1, myC2, inten);
  var ot3 = _calc3D(otC1, otC2, inten);
  root.setProperty('--b-my-3d-bg', my3.bg);
  root.setProperty('--b-my-3d-shadow', my3.shadow);
  root.setProperty('--b-my-3d-border', my3.border);
  root.setProperty('--b-ot-3d-bg', ot3.bg);
  root.setProperty('--b-ot-3d-shadow', ot3.shadow);
  root.setProperty('--b-ot-3d-border', ot3.border);

  /* body class 切换 */
  var cl = document.body.classList;
  cl.remove('bubble-2d-single', 'bubble-2d-flow', 'bubble-3d');
  if (style === '2d-single') cl.add('bubble-2d-single');
  else if (style === '2d-flow') cl.add('bubble-2d-flow');
  else if (style === '3d') cl.add('bubble-3d');
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
