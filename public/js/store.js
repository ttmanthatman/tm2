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
    nickname: '', avatar: '', channels: [], currentChannelId: 0
  });
}
