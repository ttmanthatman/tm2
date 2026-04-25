/**
 * TeamChat Socket 客户端
 * 实时通信管理
 */
let socket = null;

function initSocket() {
  if (socket) { socket.disconnect(); socket = null; }

  socket = io({ auth: { token: store.token } });

  socket.on('connect_error', e => {
    if (e.message === '认证失败' || e.message === '未提供认证信息') {
      alert('登录已过期');
      clearAuth();
    }
  });

  socket.on('newMessage', msg => {
    if (!msgStore[msg.channel_id]) {
      msgStore[msg.channel_id] = { msgs: [], oldest: null, allLoaded: false };
    }
    const ch = msgStore[msg.channel_id];
    if (!ch.msgs.find(m => m.id === msg.id)) {
      ch.msgs.push(msg);
      if (msg.channel_id === store.currentChannelId) {
        Vue.nextTick(() => scrollBottom());
      }
    }
    if (msg.channel_id !== store.currentChannelId && msg.username !== store.username) {
      const c = store.channels.find(c => c.id === msg.channel_id);
      if (c) c._unread = (c._unread || 0) + 1;
    }
  });

  socket.on('onlineUsers', users => { store.onlineUsers = users; });

  socket.on('kicked', d => {
    showKicked(d.message || '您的账号已在其他设备登录');
  });

  socket.on('timezoneChanged', d => { if (d.timezone) store.timezone = d.timezone; });
  socket.on('appearanceChanged', d => { store.appearance = d; applyAppearance(d); });
  socket.on('registrationChanged', d => { store.regOpen = d.open; });
  socket.on('noticeChanged', d => { store.notice = d; });

  socket.on('chainUpdated', data => {
    const ch = msgStore[data.channelId || store.currentChannelId];
    if (!ch) return;
    const m = ch.msgs.find(m => m.id === data.messageId);
    if (m) m.content = data.content;
  });

  socket.on('channelCreated', ch => {
    if (!store.channels.find(c => c.id === ch.id)) {
      store.channels.push({ ...ch, _unread: 0 });
    }
  });

  socket.on('channelDeleted', d => {
    store.channels = store.channels.filter(c => c.id !== d.channelId);
    if (store.currentChannelId === d.channelId && store.channels.length) {
      switchChannel(store.channels[0].id);
    }
  });

  socket.on('channelUpdated', d => {
    const c = store.channels.find(c => c.id === d.id);
    if (c) Object.assign(c, d);
  });

  socket.on('membershipChanged', async () => { await loadChannels(); });

  /* 管理员从附件管理删除了消息: 把每个频道里对应 id 移除 */
  socket.on('messagesDeleted', d => {
    const ids = new Set((d && d.ids) || []);
    if (!ids.size) return;
    Object.keys(msgStore).forEach(cid => {
      const ch = msgStore[cid];
      if (ch && ch.msgs) ch.msgs = ch.msgs.filter(m => !ids.has(m.id));
    });
  });

  /* v0.5.6: AI 角色增删改 -> 重新加载全员列表 */
  socket.on('usersChanged', () => { if (typeof loadAllUsers === 'function') loadAllUsers(); });
  /* v0.5.6: 每分钟 tick, 更新 AI 在线状态 */
  socket.on('aiStatusTick', () => { if (typeof loadAllUsers === 'function') loadAllUsers(); });

  /* v0.5.7: AI 打字状态 */
  socket.on('aiTyping', d => {
    if (!d || !d.channel_id || !d.username) return;
    if (typeof handleAiTyping === 'function') handleAiTyping(d);
  });
}

function showKicked(msg) {
  if (socket) { socket.disconnect(); socket = null; }
  const o = document.createElement('div');
  o.className = 'kicked-overlay';
  o.innerHTML = '<div class="kicked-card"><h3>⚠️ 账号已下线</h3><p>' + esc(msg)
    + '</p><button onclick="this.closest(\'.kicked-overlay\').remove();clearAuth();appInstance.page=\'login\'">重新登录</button></div>';
  document.body.appendChild(o);
}

function scrollBottom() {
  const el = document.querySelector('.messages');
  if (el) el.scrollTop = el.scrollHeight;
}
