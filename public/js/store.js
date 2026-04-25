/**
 * TeamChat 全局状态管理
 * Vue 3 reactive store
 */
const store = Vue.reactive({
  token: localStorage.getItem('token') || '',
  username: localStorage.getItem('username') || '',
  userId: parseInt(localStorage.getItem('userId')) || 0,
  isAdmin: localStorage.getItem('isAdmin') === 'true',
  nickname: localStorage.getItem('nickname') || '',
  avatar: localStorage.getItem('avatar') || '',
  timezone: 'Asia/Shanghai',
  appearance: {},
  regOpen: false,
  channels: [],
  currentChannelId: parseInt(localStorage.getItem('currentChannelId')) || 0,
  onlineUsers: [],
  allUsers: [],
  notice: { content: '', enabled: false },
  /* v0.5.7: AI 正在打字的状态, key=channelId_username */
  aiTyping: {},
});

/* 消息存储 (按频道) */
const msgStore = Vue.reactive({});

function saveAuth(d) {
  store.token = d.token; store.username = d.username; store.userId = d.userId;
  store.isAdmin = d.isAdmin; store.nickname = d.nickname || ''; store.avatar = d.avatar || '';
  for (const k of ['token','username','userId','isAdmin','nickname','avatar']) {
    localStorage.setItem(k, store[k]);
  }
}

function clearAuth() {
  for (const k of ['token','username','userId','isAdmin','nickname','avatar','currentChannelId']) {
    localStorage.removeItem(k);
  }
  Object.assign(store, {
    token: '', username: '', userId: 0, isAdmin: false,
    nickname: '', avatar: '', channels: [], currentChannelId: 0, aiTyping: {}
  });
}

/* v0.5.7: 统一处理 AI typing 事件 */
const _aiTypingTimers = {};
function handleAiTyping(d) {
  const key = d.channel_id + '_' + d.username;
  if (d.state === 'start') {
    store.aiTyping[key] = {
      channel_id: d.channel_id,
      username: d.username,
      nickname: d.nickname || d.username,
      avatar: d.avatar || null
    };
    if (_aiTypingTimers[key]) clearTimeout(_aiTypingTimers[key]);
    const ttl = Math.max(d.expected_duration_ms || 15000, 3000);
    _aiTypingTimers[key] = setTimeout(() => {
      delete store.aiTyping[key];
      delete _aiTypingTimers[key];
    }, ttl);
  } else if (d.state === 'stop') {
    delete store.aiTyping[key];
    if (_aiTypingTimers[key]) { clearTimeout(_aiTypingTimers[key]); delete _aiTypingTimers[key]; }
  }
}