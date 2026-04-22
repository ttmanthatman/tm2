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

function _calc3D(c1, c2, t, bv, bdr, sdw) {
  /* t=整体强度, bv=倒角, bdr=描边, sdw=外阴影 */
  var h1 = _hexToHSL(c1), h2 = _hexToHSL(c2);

  /* 自适应高光 */
  var hiRoom = 97 - h1.l;
  var hiL = h1.l + hiRoom * 0.6 * t;
  var hiS = h1.s * (1 - 0.25 * t);
  var highlight = _hsl(h1.h, hiS, hiL);

  /* 自适应暗部 */
  var shRoom = h2.l - 5;
  var shL = h2.l - shRoom * 0.55 * t;
  var shS = Math.min(h2.s * (1 + 0.2 * t), 100);
  var shadow = _hsl(h2.h + 8, shS, shL);

  /* 主渐变 + 镜面 */
  var mainGrad = 'linear-gradient(155deg,'+highlight+' 0%,'+c1+' 30%,'+c2+' 72%,'+shadow+' 100%)';
  var specAlpha = 0.35 * t;
  var specular = 'radial-gradient(ellipse 70% 45% at 28% 18%,rgba(255,255,255,'+specAlpha+') 0%,rgba(255,255,255,'+(specAlpha*0.2)+') 55%,transparent 75%)';

  /* ---- 渐变描边 (background-clip 技巧) ----
   * 开启时: 每个内容层加 padding-box, 最底层放描边渐变 border-box
   * border 设为 transparent 让描边渐变从 border 区域露出 */
  var bg, border;
  if (bdr && bdr.on) {
    var bdrGrad = 'linear-gradient(155deg,'+bdr.c1+','+bdr.c2+')';
    bg = specular + ' padding-box,' + mainGrad + ' padding-box,' + bdrGrad + ' border-box';
    border = bdr.width + 'px solid transparent';
  } else {
    bg = specular + ',' + mainGrad;
    border = 'none';
  }

  /* 倒角 inset shadow */
  var bOff  = 1 + bv * 5;
  var bBlur = 2 + bv * 5;
  var bHiA  = (0.35 + bv * 0.35) * t;
  var bShA  = (0.12 + bv * 0.18) * t;

  var sh = 'inset 0 '+bOff+'px '+bBlur+'px rgba(255,255,255,'+bHiA+')'
    + ',inset 0 -'+bOff+'px '+bBlur+'px rgba(0,0,0,'+bShA+')'
    + ',inset '+bOff+'px 0 '+bBlur+'px rgba(255,255,255,'+(bHiA*0.4)+')'
    + ',inset -'+(bOff*0.7)+'px 0 '+bBlur+'px rgba(0,0,0,'+(bShA*0.5)+')';

  /* 外投影 (用户可调: distance+angle → X/Y, blur, spread, opacity, color) */
  if (sdw && sdw.opacity > 0) {
    var _r = parseInt(sdw.color.slice(1,3),16) || 0;
    var _g = parseInt(sdw.color.slice(3,5),16) || 0;
    var _b = parseInt(sdw.color.slice(5,7),16) || 0;
    var _a = sdw.opacity / 100;
    var rad = sdw.angle * Math.PI / 180;
    var sx = Math.round(sdw.offset * Math.sin(rad) * 10) / 10;
    var sy = Math.round(-sdw.offset * Math.cos(rad) * 10) / 10;
    sh += ','+sx+'px '+sy+'px '+sdw.blur+'px '+sdw.spread+'px rgba('+_r+','+_g+','+_b+','+_a+')';
  }

  return { bg: bg, shadow: sh, border: border };
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
  var bevel = (parseInt(d.bubble_3d_bevel) || 50) / 100;

  /* 描边参数 */
  var bdr = {
    on:    d.bubble_border_on === '1' || d.bubble_border_on === true,
    width: parseInt(d.bubble_border_width) || 2,
    c1:    d.bubble_border_color1 || '#ffffff',
    c2:    d.bubble_border_color2 || '#000000'
  };

  /* 阴影参数 */
  var sdw = {
    offset:  parseInt(d.bubble_shadow_offset)  || 4,
    blur:    parseInt(d.bubble_shadow_blur)    || 12,
    spread:  parseInt(d.bubble_shadow_spread)  || 0,
    opacity: parseInt(d.bubble_shadow_opacity) || 15,
    color:   d.bubble_shadow_color || '#000000',
    angle:   parseInt(d.bubble_shadow_angle)   || 180
  };

  var root = document.documentElement.style;
  root.setProperty('--b-my-c1', myC1);
  root.setProperty('--b-my-c2', myC2);
  root.setProperty('--b-my-text', myT);
  root.setProperty('--b-ot-c1', otC1);
  root.setProperty('--b-ot-c2', otC2);
  root.setProperty('--b-ot-text', otT);
  root.setProperty('--b-angle', angle);

  /* 3D 预计算 (静态基准) */
  var my3 = _calc3D(myC1, myC2, inten, bevel, bdr, sdw);
  var ot3 = _calc3D(otC1, otC2, inten, bevel, bdr, sdw);
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

  /* ===== 动态气泡: 缓存 + 启停 ===== */
  var dynOn = (d.bubble_dynamic_on === '1' || d.bubble_dynamic_on === true) && style === '3d';
  if (dynOn) {
    _dynBubbleCache = _buildDynCache(myC1, myC2, otC1, otC2, inten, bevel, bdr, sdw);
    _startDynamicBubble();
  } else {
    _stopDynamicBubble();
    _dynBubbleCache = null;
  }
}

/* ===== 动态气泡引擎 (三轴姿态 + 磁力计 → 世界空间光照 → CSS 变量) ===== */

var _dynBubbleCache  = null;
var _dynBubbleActive = false;
var _dynBaseAlpha    = null;   /* 首次 alpha 读数, 作为罗盘零点 */
var _D2R = Math.PI / 180;

/**
 * 预计算颜色/倒角/描边等不随姿态变化的静态数据
 */
function _buildDynCache(myC1, myC2, otC1, otC2, t, bv, bdr, sdw) {
  function _colors(c1, c2) {
    var h1 = _hexToHSL(c1), h2 = _hexToHSL(c2);
    return {
      c1: c1, c2: c2,
      highlight: _hsl(h1.h, h1.s * (1 - 0.25 * t), h1.l + (97 - h1.l) * 0.6 * t),
      shadow:    _hsl(h2.h + 8, Math.min(h2.s * (1 + 0.2 * t), 100), h2.l - (h2.l - 5) * 0.55 * t)
    };
  }
  var sR = parseInt((sdw.color || '#000000').slice(1,3), 16) || 0;
  var sG = parseInt((sdw.color || '#000000').slice(3,5), 16) || 0;
  var sB = parseInt((sdw.color || '#000000').slice(5,7), 16) || 0;

  return {
    my: _colors(myC1, myC2),
    ot: _colors(otC1, otC2),
    t: t, bv: bv, bdr: bdr, sdw: sdw,
    sRGB: [sR, sG, sB],
    specAlpha: 0.35 * t,
    bOff:  1 + bv * 5,
    bBlur: 2 + bv * 5,
    bHiA:  (0.35 + bv * 0.35) * t,
    bShA:  (0.12 + bv * 0.18) * t
  };
}

/**
 * 根据屏幕空间光向量 (lx, ly) 重建一个气泡的 CSS
 *
 *   lx >0 光从左侧来  lx <0 光从右侧来
 *   ly <0 光从上方来  ly >0 光从下方来
 *
 * lx/ly 无上限 (三角函数组合可达 ±√2), 完全不截断
 */
function _dynBuild3D(col, C, lx, ly) {
  /* ---- 镜面高光: 跟随光源方向, 覆盖气泡全表面 ---- */
  var specX = (50 + lx * 45).toFixed(1);
  var specY = (50 + ly * 40).toFixed(1);
  var spec  = 'radial-gradient(ellipse 70% 50% at ' + specX + '% ' + specY
            + '%,rgba(255,255,255,' + C.specAlpha + ') 0%,rgba(255,255,255,'
            + (C.specAlpha * 0.15).toFixed(3) + ') 55%,transparent 80%)';

  /* ---- 主渐变: 光来的方向 → 渐变角度 ---- */
  var gAng = (Math.atan2(lx, -ly) / _D2R).toFixed(1);
  var main = 'linear-gradient(' + gAng + 'deg,' + col.highlight + ' 0%,'
           + col.c1 + ' 30%,' + col.c2 + ' 72%,' + col.shadow + ' 100%)';

  /* ---- 描边渐变 (同步偏转) ---- */
  var bg, border;
  if (C.bdr && C.bdr.on) {
    var bdrG = 'linear-gradient(' + gAng + 'deg,' + C.bdr.c1 + ',' + C.bdr.c2 + ')';
    bg = spec + ' padding-box,' + main + ' padding-box,' + bdrG + ' border-box';
    border = C.bdr.width + 'px solid transparent';
  } else {
    bg = spec + ',' + main;
    border = 'none';
  }

  /* ---- 倒角 inset: 光侧亮, 背光侧暗 ---- */
  var bo = C.bOff, bb = C.bBlur;
  /* lx, ly 直接驱动四边亮暗比例 */
  var hiT = Math.max(0, -ly);           /* 光从上方来 → 顶边亮 */
  var hiB = Math.max(0,  ly);           /* 光从下方来 → 底边亮 */
  var hiL = Math.max(0,  lx);           /* 光从左侧来 → 左边亮 */
  var hiR = Math.max(0, -lx);           /* 光从右侧来 → 右边亮 */

  var sh = 'inset 0 '  + (bo * (0.3 + hiT * 0.7)).toFixed(1) + 'px ' + bb + 'px rgba(255,255,255,' + (C.bHiA * (0.2 + hiT * 0.8)).toFixed(3) + ')'
    + ',inset 0 -' + (bo * (0.3 + hiB * 0.7)).toFixed(1) + 'px ' + bb + 'px rgba(255,255,255,' + (C.bHiA * 0.3 * hiB).toFixed(3) + ')'
    + ',inset '  + (bo * (0.3 + hiL * 0.7)).toFixed(1) + 'px 0 ' + bb + 'px rgba(255,255,255,' + (C.bHiA * 0.4 * (0.2 + hiL * 0.8)).toFixed(3) + ')'
    + ',inset -' + (bo * (0.3 + hiR * 0.7)).toFixed(1) + 'px 0 ' + bb + 'px rgba(255,255,255,' + (C.bHiA * 0.4 * (0.2 + hiR * 0.8)).toFixed(3) + ')';
  /* 暗面 (光的对侧) */
  sh += ',inset 0 '  + (bo * (0.3 + hiB * 0.7)).toFixed(1) + 'px ' + bb + 'px rgba(0,0,0,' + (C.bShA * hiB).toFixed(3) + ')';
  sh += ',inset 0 -' + (bo * (0.3 + hiT * 0.7)).toFixed(1) + 'px ' + bb + 'px rgba(0,0,0,' + (C.bShA * (0.15 + hiT * 0.85)).toFixed(3) + ')';
  sh += ',inset '  + (bo * (0.3 + hiR * 0.7)).toFixed(1) + 'px 0 ' + bb + 'px rgba(0,0,0,' + (C.bShA * 0.5 * hiR).toFixed(3) + ')';
  sh += ',inset -' + (bo * (0.3 + hiL * 0.7)).toFixed(1) + 'px 0 ' + bb + 'px rgba(0,0,0,' + (C.bShA * 0.5 * hiL).toFixed(3) + ')';

  /* ---- 外投影: 方向 = 光的对面 ---- */
  var sdw = C.sdw;
  if (sdw && sdw.opacity > 0) {
    /* 阴影落向光的反方向 */
    var sx = (-lx * sdw.offset).toFixed(1);
    var sy = (-ly * sdw.offset).toFixed(1);
    var sa = (sdw.opacity / 100).toFixed(2);
    sh += ',' + sx + 'px ' + sy + 'px ' + sdw.blur + 'px ' + sdw.spread
        + 'px rgba(' + C.sRGB[0] + ',' + C.sRGB[1] + ',' + C.sRGB[2] + ',' + sa + ')';
  }

  return { bg: bg, shadow: sh, border: border };
}

/**
 * 陀螺仪回调: 三轴姿态 → 屏幕空间光向量 → CSS
 *
 * 物理模型: 虚拟光源固定在真实世界空间 (头顶上方)
 *   beta  (俯仰) → sin/cos 映射垂直光分量, 无截断
 *   gamma (横滚) → sin 映射水平光分量, 无截断
 *   alpha (罗盘) → 旋转光向量, 模拟手机朝向不同方位时光源方向变化
 */
function _onGyroOrientation(alpha, beta, gamma) {
  var C = _dynBubbleCache;
  if (!C) return;

  /* 记录首次 alpha 作为罗盘零点 */
  if (_dynBaseAlpha === null) _dynBaseAlpha = alpha;

  var bRad = beta  * _D2R;
  var gRad = gamma * _D2R;

  /* 罗盘偏移 (处理 0↔360 环绕) */
  var aDiff = alpha - _dynBaseAlpha;
  if (aDiff > 180)  aDiff -= 360;
  if (aDiff < -180) aDiff += 360;
  var aRad = aDiff * _D2R;

  /* 屏幕空间光方向 (不截断, sin/cos 天然全值域) */
  var rawLx =  Math.sin(gRad);     /* 横滚 → 水平光 */
  var rawLy = -Math.cos(bRad);     /* 俯仰 → 垂直光 (俯=光从上, 仰=光从下) */

  /* 罗盘旋转: 世界固定光源在不同朝向下的屏幕投影 */
  var ca = Math.cos(aRad), sa = Math.sin(aRad);
  var lx =  rawLx * ca + rawLy * sa;
  var ly = -rawLx * sa + rawLy * ca;

  /* 写入 CSS */
  var root = document.documentElement.style;
  var my3 = _dynBuild3D(C.my, C, lx, ly);
  var ot3 = _dynBuild3D(C.ot, C, lx, ly);
  root.setProperty('--b-my-3d-bg',     my3.bg);
  root.setProperty('--b-my-3d-shadow', my3.shadow);
  root.setProperty('--b-my-3d-border', my3.border);
  root.setProperty('--b-ot-3d-bg',     ot3.bg);
  root.setProperty('--b-ot-3d-shadow', ot3.shadow);
  root.setProperty('--b-ot-3d-border', ot3.border);
}

function _startDynamicBubble() {
  if (_dynBubbleActive) return;
  if (!window.Gyro || !Gyro.isSupported()) return;
  _dynBaseAlpha = null;   /* 重置罗盘零点 */
  Gyro.onOrientation(_onGyroOrientation);
  Gyro.start();
  _dynBubbleActive = true;
}

function _stopDynamicBubble() {
  if (!_dynBubbleActive) return;
  Gyro.offOrientation(_onGyroOrientation);
  Gyro.stop();
  _dynBubbleActive = false;
  _dynBaseAlpha = null;
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
