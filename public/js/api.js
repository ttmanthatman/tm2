/**
 * TeamChat API 客户端
 * 频道/消息加载、外观配置
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
  try {
    const r = await fetch(API + '/api/settings/appearance');
    if (r.ok) {
      const d = await r.json();
      store.appearance = d;
      applyAppearance(d);
    }
  } catch(e) {}
}

function applyAppearance(d) {
  if (!d) return;
  if (d.timezone) store.timezone = d.timezone;

  const sb = document.querySelector('.input-area .send-btn');
  if (sb) {
    if (d.send_text) sb.textContent = d.send_text;
    if (d.send_color) sb.style.background = d.send_color;
  }

  const ml = document.querySelector('.messages');
  if (ml) {
    if (d.bg_type === 'image' && d.bg_image) {
      ml.style.backgroundImage = 'url(' + API + '/backgrounds/' + encodeURIComponent(d.bg_image) + ')';
      ml.style.backgroundSize = d.bg_mode === 'tile' ? 'auto' : 'cover';
      ml.style.backgroundPosition = 'center';
      ml.style.backgroundRepeat = d.bg_mode === 'tile' ? 'repeat' : 'no-repeat';
      ml.style.backgroundColor = d.bg_color || '#f0f2f5';
    } else {
      ml.style.backgroundImage = 'none';
      ml.style.backgroundColor = d.bg_color || '#f0f2f5';
    }
  }

  const lp = document.querySelector('.login-page');
  if (lp) {
    const lbt = d.login_bg_type || 'gradient';
    if (lbt === 'color') lp.style.background = d.login_bg_color1 || '#667eea';
    else if (lbt === 'image' && d.login_bg_image) {
      lp.style.background = 'url(' + API + '/backgrounds/' + encodeURIComponent(d.login_bg_image) + ') center/cover no-repeat';
    } else {
      lp.style.background = 'linear-gradient(135deg,' + (d.login_bg_color1 || '#667eea') + ' 0%,' + (d.login_bg_color2 || '#764ba2') + ' 100%)';
    }
  }
}
