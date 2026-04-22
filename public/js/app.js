/**
 * TeamChat v9 — Vue 3 SPA 主入口
 * 引用: utils.js, store.js, socket-client.js, api.js, push-client.js, admin-methods.js
 */
let appInstance = null;

const App = {
  setup() {
    const { ref, computed, onMounted, nextTick } = Vue;

    const page = ref(store.token ? 'chat' : 'login');
    const loginErr = ref('');
    const showReg = ref(false);
    const sidebarOpen = ref(false);
    const showMembers = ref(true);
    const currentModal = ref('');
    const modalData = ref({});
    const replyTo = ref(null);
    const noticeExpanded = ref(false);
    const msgInput = ref('');
    const loginUser = ref('');
    const loginPass = ref('');
    const regUser = ref('');
    const regNick = ref('');
    const regPass = ref('');
    const regPass2 = ref('');
    const chainTopic = ref('');
    const chainDesc = ref('');
    const msgListKey = ref(0);

    /* ===== Animation & Effects ===== */
    const animOn = ref(localStorage.getItem('tc_anim') !== '0');
    const showEmojiPicker = ref(false);
    const showPlusMenu = ref(false);
    const emojiTab = ref('face');

    function applyEffectClasses() {
      document.body.classList.toggle('anim-on', animOn.value);
    }
    function toggleAnim(v) { animOn.value = v; localStorage.setItem('tc_anim', v ? '1' : '0'); applyEffectClasses(); }
    function insertEmoji(code) { msgInput.value += code; showEmojiPicker.value = false; const ta = document.querySelector('.input-area textarea'); if (ta) ta.focus(); }

    /* Emoji picker 数据来自 EmojiRegistry */
    const emojiCategories = Vue.computed(function() { return EmojiRegistry.categories; });
    function emojiByCategory(key) { return EmojiRegistry.byCategory(key); }

    /* ===== @-Mention Autocomplete ===== */
    const mentionShow = ref(false);
    const mentionList = ref([]);
    const mentionIdx = ref(0);
    let _mentionAtPos = -1; /* @符号在 textarea value 中的位置 */

    function onMsgInput(e) {
      autoGrow(e);
      var ta = e.target;
      var val = ta.value;
      var cur = ta.selectionStart;
      /* 从光标往前找最近的 @ */
      var atPos = -1;
      for (var i = cur - 1; i >= 0; i--) {
        if (val[i] === '@') { if (i === 0 || /\s/.test(val[i - 1])) atPos = i; break; }
        if (/\s/.test(val[i])) break;
      }
      if (atPos >= 0) {
        var query = val.substring(atPos + 1, cur).toLowerCase();
        var filtered = store.allUsers.filter(function(u) {
          if (u.username === store.username) return false;
          var nick = (u.nickname || '').toLowerCase();
          var uname = u.username.toLowerCase();
          return nick.indexOf(query) >= 0 || uname.indexOf(query) >= 0;
        }).slice(0, 20);
        if (filtered.length) {
          mentionList.value = filtered;
          mentionIdx.value = 0;
          _mentionAtPos = atPos;
          mentionShow.value = true;
          return;
        }
      }
      mentionShow.value = false;
    }

    function selectMention(user) {
      var ta = document.querySelector('.input-area textarea');
      if (!ta) return;
      var name = user.nickname || user.username;
      var before = msgInput.value.substring(0, _mentionAtPos);
      var afterCur = msgInput.value.substring(ta.selectionStart);
      msgInput.value = before + '@' + name + ' ' + afterCur;
      mentionShow.value = false;
      var newPos = before.length + 1 + name.length + 1;
      nextTick(function() { ta.selectionStart = ta.selectionEnd = newPos; ta.focus(); });
    }

    /* ===== Voice Recording ===== */
    const isRecording = ref(false);
    const recordSec = ref(0);
    let _mediaRecorder = null;
    let _recordChunks = [];
    let _recordTimer = null;
    let _recordStart = 0;
    const VOICE_MAX_SEC = 60;

    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        /* 优先 Opus/webm 低码率; 回退到浏览器默认 */
        const mimeOpts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
        let mime = '';
        for (const m of mimeOpts) { if (MediaRecorder.isTypeSupported(m)) { mime = m; break; } }
        const opts = { audioBitsPerSecond: 24000 };
        if (mime) opts.mimeType = mime;
        _mediaRecorder = new MediaRecorder(stream, opts);
        _recordChunks = [];
        _mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) _recordChunks.push(e.data); };
        _mediaRecorder.onstop = function() {
          stream.getTracks().forEach(function(t) { t.stop(); });
          var dur = (Date.now() - _recordStart) / 1000;
          if (_recordChunks.length && dur >= 0.5) {
            var blob = new Blob(_recordChunks, { type: mime || 'audio/webm' });
            uploadVoice(blob, Math.round(dur));
          }
          _recordChunks = [];
        };
        _recordStart = Date.now();
        _mediaRecorder.start(500); /* 每 500ms 收集一次 */
        isRecording.value = true;
        recordSec.value = 0;
        _recordTimer = setInterval(function() {
          recordSec.value = Math.floor((Date.now() - _recordStart) / 1000);
          if (recordSec.value >= VOICE_MAX_SEC) stopRecording();
        }, 300);
      } catch (e) {
        alert('无法访问麦克风，请检查浏览器权限。');
      }
    }

    function stopRecording() {
      if (_recordTimer) { clearInterval(_recordTimer); _recordTimer = null; }
      if (_mediaRecorder && _mediaRecorder.state !== 'inactive') _mediaRecorder.stop();
      isRecording.value = false;
    }

    function cancelRecording() {
      if (_recordTimer) { clearInterval(_recordTimer); _recordTimer = null; }
      if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
        _recordChunks = []; /* 清空使 onstop 不上传 */
        _mediaRecorder.stop();
      }
      isRecording.value = false;
    }

    async function uploadVoice(blob, duration) {
      var fd = new FormData();
      fd.append('voice', blob, 'voice.webm');
      fd.append('channelId', store.currentChannelId);
      fd.append('duration', duration);
      try {
        var r = await fetch(API + '/api/upload-voice', { method: 'POST', headers: { 'Authorization': 'Bearer ' + store.token }, body: fd });
        var d = await r.json();
        if (!d.success) alert(d.message || '发送语音失败');
      } catch (e) { alert('发送语音失败'); }
    }

    function fmtDuration(s) {
      if (!s && s !== 0) return '0:00';
      var sec = Math.round(s);
      var m = Math.floor(sec / 60);
      var ss = sec % 60;
      return m + ':' + (ss < 10 ? '0' : '') + ss;
    }

    const currentChannel = computed(() => store.channels.find(c => c.id === store.currentChannelId) || null);
    const currentMessages = computed(() => { const ch = msgStore[store.currentChannelId]; return ch ? ch.msgs : []; });
    const onlineSet = computed(() => new Set(store.onlineUsers.map(u => u.username)));

    /* ===== Init ===== */
    onMounted(async () => {
      initSW(); /* 不 await — SW 注册不应阻塞 UI */
      await loadAppearance();
      try { const r = await fetch(API + '/api/settings/notice'); if (r.ok) { const d = await r.json(); store.notice = d; } } catch(e) {}
      try { const r = await fetch(API + '/api/settings/registration'); if (r.ok) { const d = await r.json(); store.regOpen = d.open; } } catch(e) {}
      if (store.token) { await enterChat(); }
      appInstance = { page };
    });

    async function enterChat() {
      page.value = 'chat';
      /* 等 Vue 渲染出 .messages-wrapper 后重新应用壁纸 */
      await Vue.nextTick();
      if (store.appearance && Object.keys(store.appearance).length) {
        applyAppearance(store.appearance);
      }
      initSocket();
      await loadChannels();
      loadAllUsers(); /* 不阻塞，后台加载全员列表供 @提及 */
      if (!store.currentChannelId && store.channels.length) store.currentChannelId = store.channels[0].id;
      if (store.currentChannelId) await switchChannel(store.currentChannelId);
    }

    /* ===== Auth ===== */
    async function doLogin(u, p) {
      loginErr.value = '';
      try {
        const r = await fetch(API + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
        const d = await r.json();
        if (d.success) { saveAuth(d); await enterChat(); }
        else loginErr.value = d.message || '登录失败';
      } catch(e) { loginErr.value = '登录失败'; }
    }

    async function doRegister(u, p, p2, n) {
      loginErr.value = '';
      if (p !== p2) return loginErr.value = '两次密码不一致';
      if (p.length < 6) return loginErr.value = '密码至少6位';
      try {
        const r = await fetch(API + '/api/public-register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p, nickname: n || u }) });
        const d = await r.json();
        if (d.success) { loginErr.value = '✅ 注册成功，请登录'; showReg.value = false; }
        else loginErr.value = d.message || '注册失败';
      } catch(e) { loginErr.value = '注册失败'; }
    }

    function logout() {
      if (socket) { socket.disconnect(); socket = null; }
      clearAuth();
      page.value = 'login';
    }

    /* ===== Send ===== */
    function sendMsg() {
      showEmojiPicker.value = false;
      const text = msgInput.value.trim();
      if (!text || !socket) return;
      const d = { content: esc(text), channelId: store.currentChannelId };
      if (replyTo.value) d.replyTo = replyTo.value.id;
      socket.emit('sendMessage', d);
      replyTo.value = null;
      msgInput.value = '';
      const ta = document.querySelector('.input-area textarea');
      if (ta) { ta.style.height = 'auto'; }
    }

    function handleKey(e) {
      if (mentionShow.value) {
        if (e.key === 'ArrowDown') { e.preventDefault(); mentionIdx.value = (mentionIdx.value + 1) % mentionList.value.length; return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); mentionIdx.value = (mentionIdx.value - 1 + mentionList.value.length) % mentionList.value.length; return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMention(mentionList.value[mentionIdx.value]); return; }
        if (e.key === 'Escape') { e.preventDefault(); mentionShow.value = false; return; }
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    }

    function insertNewline() {
      const ta = document.querySelector('.input-area textarea');
      if (!ta) return;
      const s = ta.selectionStart, e = ta.selectionEnd;
      msgInput.value = msgInput.value.substring(0, s) + '\n' + msgInput.value.substring(e);
      nextTick(() => { ta.selectionStart = ta.selectionEnd = s + 1; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; ta.focus(); });
    }

    function autoGrow(e) { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }

    /* ===== File upload ===== */
    async function uploadFile(file) {
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('channelId', store.currentChannelId);
      try {
        const r = await fetch(API + '/api/upload', { method: 'POST', headers: { 'Authorization': 'Bearer ' + store.token }, body: fd });
        const d = await r.json();
        if (!d.success) alert(d.message || '上传失败');
      } catch(e) { alert('上传失败'); }
    }

    /* ===== Chain ===== */
    function sendChain(topic, desc) {
      if (!topic || !socket) return;
      const myName = store.nickname || store.username;
      const chainData = { type: 'chain', topic, desc, participants: [{ seq: 1, username: store.username, name: myName, text: '' }] };
      socket.emit('sendMessage', { content: '[CHAIN]' + JSON.stringify(chainData), channelId: store.currentChannelId });
      currentModal.value = '';
    }

    function joinChain(msg) {
      if (!socket) return;
      const cd = parseChain(msg.content);
      if (!cd) return;
      if (cd.participants.some(p => p.username === store.username)) { alert('你已参与此接龙'); return; }
      socket.emit('updateChain', { messageId: msg.id, content: '[CHAIN]' + JSON.stringify(cd), channelId: msg.channel_id || store.currentChannelId });
    }

    function parseChain(c) {
      if (!c || !c.startsWith('[CHAIN]')) return null;
      try { return JSON.parse(c.substring(7)); } catch(e) { return null; }
    }

    async function loadMore() { await loadMessages(store.currentChannelId, true); msgListKey.value++; }

    /* ===== Context menu ===== */
    const ctxMenu = ref(null);
    function showCtx(e, msg) {
      e.preventDefault();
      ctxMenu.value = { x: Math.min(e.clientX, window.innerWidth - 160), y: Math.min(e.clientY, window.innerHeight - 80), msg };
      setTimeout(() => document.addEventListener('click', hideCtx, { once: true }), 50);
    }
    function hideCtx() { ctxMenu.value = null; }
    function setReply(msg) {
      replyTo.value = msg; ctxMenu.value = null;
      document.querySelector('.input-area textarea')?.focus();
    }

    return {
      page, loginErr, showReg, sidebarOpen, showMembers, currentModal, modalData,
      replyTo, noticeExpanded, msgInput, msgListKey,
      loginUser, loginPass, regUser, regNick, regPass, regPass2, chainTopic, chainDesc,
      currentChannel, currentMessages, onlineSet, ctxMenu,
      doLogin, doRegister, logout, sendMsg, handleKey, insertNewline, autoGrow, onMsgInput,
      uploadFile, sendChain, joinChain, parseChain, loadMore, showCtx, setReply,
      switchChannel: async (id) => { sidebarOpen.value = false; await switchChannel(id); },
      store, msgStore, API, esc, fmtTime, fmtSize, avatarUrl, sanitize,
      togglePush, checkPush,
      mentionShow, mentionList, mentionIdx, selectMention,
      animOn, showEmojiPicker, showPlusMenu, emojiTab,
      toggleAnim, insertEmoji, applyEffectClasses,
      emojiCategories, emojiByCategory,
      isRecording, recordSec, startRecording, stopRecording, cancelRecording, fmtDuration, VOICE_MAX_SEC
    };
  },

  /* ===== HTML 模板在外部文件: components/template.html (通过 index.html 内联) ===== */
  template: `
<div v-if="page==='login'" class="login-page" id="loginPage">
  <div class="login-card">
    <h1 id="loginTitle">{{store.appearance.login_title||'团队聊天室'}}</h1>
    <div v-if="!showReg">
      <input v-model="loginUser" type="text" placeholder="用户名" @keyup.enter="$refs.lp?.focus()">
      <input ref="lp" v-model="loginPass" type="password" placeholder="密码" @keyup.enter="doLogin(loginUser,loginPass)">
      <button @click="doLogin(loginUser,loginPass)">登录</button>
    </div>
    <div v-else>
      <input v-model="regUser" type="text" placeholder="用户名"><input v-model="regNick" type="text" placeholder="昵称 (选填)">
      <input v-model="regPass" type="password" placeholder="密码 (至少6位)"><input v-model="regPass2" type="password" placeholder="确认密码">
      <button @click="doRegister(regUser,regPass,regPass2,regNick)">注册</button>
    </div>
    <p v-if="loginErr" class="error" :style="{color:loginErr.startsWith('✅')?'#10b981':'#dc2626'}">{{loginErr}}</p>
    <p v-if="store.regOpen" class="reg-toggle"><a href="#" @click.prevent="showReg=!showReg;loginErr=''">{{showReg?'已有账号？去登录':'还没有账号？注册一个'}}</a></p>
  </div>
</div>
<div v-else class="app-layout">
  <div class="sidebar-overlay" :class="{show:sidebarOpen}" @click="sidebarOpen=false"></div>
  <div class="sidebar" :class="{open:sidebarOpen}">
    <div class="sidebar-header">
      <h2>{{store.appearance.chat_title||'TeamChat'}}</h2>
      <button v-if="store.isAdmin" class="btn-icon" title="管理频道" @click="currentModal='channelMgmt'">⚙️</button>
    </div>
    <div class="channel-list">
      <div v-for="ch in store.channels" :key="ch.id" class="channel-item" :class="{active:ch.id===store.currentChannelId}" @click="switchChannel(ch.id)">
        <span class="ch-icon">{{ch.is_private?'🔒':'#'}}</span>
        <span class="ch-name">{{ch.name}}</span>
        <span v-if="ch._unread>0" class="ch-badge">{{ch._unread>99?'99+':ch._unread}}</span>
      </div>
    </div>
    <div class="sidebar-footer">
      <img :src="avatarUrl(store.avatar)" alt="">
      <span class="user-name">{{store.nickname||store.username}}</span>
      <button class="btn-icon" title="设置" @click="currentModal='settings'">⚙</button>
      <button class="btn-icon" title="退出" @click="logout()">🚪</button>
    </div>
  </div>
  <div class="main-area">
    <div class="chat-header">
      <div class="chat-header-left">
        <button class="menu-btn" @click="sidebarOpen=!sidebarOpen">☰</button>
        <div><h3>{{currentChannel?currentChannel.name:'TeamChat'}}</h3><div v-if="currentChannel&&currentChannel.description" class="ch-desc">{{currentChannel.description}}</div></div>
      </div>
      <div class="chat-header-right">
        <span class="online-tag">{{store.onlineUsers.length}}人在线</span>
        <button class="btn-icon" title="成员" @click="showMembers=!showMembers">👥</button>
      </div>
    </div>
    <div v-if="store.notice.enabled&&store.notice.content" class="notice-bar" @click="noticeExpanded=!noticeExpanded">
      <span class="notice-icon">📌</span><span class="notice-text">{{store.notice.content.substring(0,60)}}</span><span>{{noticeExpanded?'▲':'▼'}}</span>
    </div>
    <div v-if="noticeExpanded&&store.notice.enabled" class="notice-expanded">{{store.notice.content}}</div>
    <div class="messages-wrapper">
      <div class="messages" :key="msgListKey">
        <div v-if="!(msgStore[store.currentChannelId]||{}).allLoaded" class="load-more" @click="loadMore()">加载更多</div>
        <div v-for="m in currentMessages" :key="m.id" class="msg" :class="{my:m.username===store.username,other:m.username!==store.username,'is-online':onlineSet.has(m.username)}" @contextmenu="showCtx($event,m)">
          <img class="msg-avatar" :src="avatarUrl(m.avatar)" :alt="m.nickname||m.username">
          <div class="msg-body">
            <div class="msg-sender">{{m.nickname||m.username}}</div>
            <div class="msg-bubble" :class="{mentioned:isMentioned(m)}">
              <div v-if="m.reply_to" class="reply-ref">{{getReplyPreview(m.reply_to)}}</div>
              <div v-if="m.type==='text'&&m.content&&m.content.startsWith('[CHAIN]')" v-html="renderChain(m)"></div>
              <div v-else-if="m.type==='text'" class="msg-content" v-html="sanitize(m.content)"></div>
              <img v-else-if="m.type==='image'" class="chat-image" :src="API+'/uploads/'+encodeURIComponent(m.file_path)" :alt="m.file_name" @click="currentModal='imagePreview';modalData={src:API+'/uploads/'+encodeURIComponent(m.file_path)}">
              <div v-else-if="m.type==='file'" class="file-card" @click="downloadFile(API+'/uploads/'+encodeURIComponent(m.file_path),m.file_name)">📄 {{m.file_name}} ({{fmtSize(m.file_size)}})</div>
              <div v-else-if="m.type==='voice'" class="voice-card">
                <button class="voice-play-btn" @click.stop="$event.target.closest('.voice-card').querySelector('audio').paused?$event.target.closest('.voice-card').querySelector('audio').play():$event.target.closest('.voice-card').querySelector('audio').pause()">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <audio :src="API+'/voices/'+encodeURIComponent(m.file_path)" preload="metadata" @play="$event.target.closest('.voice-card').classList.add('playing')" @pause="$event.target.closest('.voice-card').classList.remove('playing')" @ended="$event.target.closest('.voice-card').classList.remove('playing')"></audio>
                <div class="voice-wave"><span></span><span></span><span></span><span></span><span></span></div>
                <span class="voice-dur">{{fmtDuration(m.duration)}}</span>
              </div>
              <div class="msg-time">{{fmtTime(m.created_at)}}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="replyTo" class="reply-bar">
      <span style="font-weight:600;color:#667eea">引用 {{replyTo.nickname||replyTo.username}}:</span>
      <span class="reply-text">{{(replyTo.content||'').replace(/<[^>]*>/g,'').substring(0,40)}}</span>
      <button @click="replyTo=null">✕</button>
    </div>
    <div class="input-area">
      <div v-if="isRecording" class="voice-recording-bar">
        <button class="voice-cancel-btn" @click="cancelRecording()" title="取消">✕</button>
        <div class="voice-rec-indicator"><span class="rec-dot"></span> {{fmtDuration(recordSec)}} / {{fmtDuration(VOICE_MAX_SEC)}}</div>
        <button class="voice-send-btn" @click="stopRecording()" title="发送语音">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <template v-else>
      <div v-if="mentionShow" class="mention-popup" @click.stop>
        <div v-for="(u,i) in mentionList" :key="u.username" class="mention-item" :class="{active:i===mentionIdx}" @mousedown.prevent="selectMention(u)">
          <img :src="avatarUrl(u.avatar)" alt="" class="mention-avatar">
          <span class="mention-nick">{{u.nickname||u.username}}</span>
          <span v-if="u.nickname&&u.nickname!==u.username" class="mention-uname">@{{u.username}}</span>
        </div>
      </div>
      <button class="voice-btn" title="语音消息" @click="startRecording()"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></button>
      <input ref="fileInput" type="file" hidden @change="uploadFile($event.target.files[0]);$event.target.value=''">
      <textarea v-model="msgInput" placeholder="输入消息..." rows="1" enterkeyhint="send" @keydown="handleKey" @input="onMsgInput"></textarea>
      <div style="position:relative">
        <button class="emoji-btn" @click.stop="showEmojiPicker=!showEmojiPicker;showPlusMenu=false" title="表情">😊</button>
        <div v-if="showEmojiPicker" class="emoji-picker" @click.stop>
          <div class="emoji-picker-tabs">
            <button v-for="t in emojiCategories" :key="t.key" :class="{active:emojiTab===t.key}" @click="emojiTab=t.key">{{t.icon}}</button>
          </div>
          <div class="emoji-picker-grid">
            <span v-for="em in emojiByCategory(emojiTab)" :key="em.code" @click="insertEmoji(em.code)" :title="em.code+' '+em.alt"><img :src="em.src" :alt="em.alt" class="emoji-picker-img"></span>
          </div>
        </div>
      </div>
      <div style="position:relative">
        <button class="plus-btn" @click.stop="showPlusMenu=!showPlusMenu;showEmojiPicker=false" title="更多"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
        <div v-if="showPlusMenu" class="plus-menu" @click.stop>
          <div class="plus-menu-item" @click="insertNewline();showPlusMenu=false"><span class="plus-menu-icon">⏎</span><span>换行</span></div>
          <div class="plus-menu-item" @click="currentModal='chainNew';showPlusMenu=false"><span class="plus-menu-icon">🚂</span><span>接龙</span></div>
          <div class="plus-menu-item" @click="$refs.fileInput.click();showPlusMenu=false"><span class="plus-menu-icon">📎</span><span>文件</span></div>
        </div>
      </div>
      <button class="send-btn" :disabled="!msgInput.trim()" @mousedown.prevent @click="sendMsg()">{{store.appearance.send_text||'发送'}}</button>
      </template>
    </div>
  </div>
  <div v-if="showMembers" class="members-panel">
    <div class="members-panel-header">在线成员 ({{store.onlineUsers.length}})</div>
    <div class="members-list">
      <div v-for="u in store.onlineUsers" :key="u.username" class="member-item">
        <img :src="avatarUrl(u.avatar)" alt=""><span class="member-name">{{u.nickname||u.username}}</span><span class="online-dot on"></span>
      </div>
    </div>
  </div>
</div>
<div v-if="ctxMenu" class="msg-menu" :style="{left:ctxMenu.x+'px',top:ctxMenu.y+'px'}"><div class="menu-item" @click="setReply(ctxMenu.msg)">💬 引用回复</div><div v-if="store.isAdmin" class="menu-item menu-item-danger" @click="doDeleteSingleMsg(ctxMenu.msg)">🗑️ 删除此消息</div></div>
<div v-if="currentModal==='imagePreview'" class="image-modal" @click="currentModal=''"><img :src="modalData.src" alt="预览"></div>
<div v-if="currentModal==='settings'" class="modal-overlay" @click.self="currentModal=''"><div class="modal"><h3>设置</h3><div class="section"><h4>🔔 推送通知</h4><p id="pushInfo" style="font-size:13px;color:#666">检测中...</p><button id="pushBtn" style="display:none" @click="doPushToggle()">开启推送</button></div><div class="section"><h4>上传头像</h4><div class="avatar-upload"><img class="avatar-preview" :src="avatarUrl(store.avatar)" alt=""><input type="file" accept="image/*" hidden ref="avatarFileInput" @change="doAvatarUpload($event)"><button @click="$refs.avatarFileInput.click()">选择图片</button><p id="avatarMsg" style="font-size:13px"></p></div></div><div class="section"><h4>修改密码</h4><input id="oldPwd" type="password" placeholder="原密码"><input id="newPwd" type="password" placeholder="新密码 (至少6位)"><button @click="doChangePwd()">确认修改</button><p id="pwdMsg" style="font-size:13px"></p></div><div class="section"><h4>✨ 动画效果</h4><div class="anim-toggles"><div class="anim-toggle-row"><span>消息动画 (果冻滑入 & 水波)</span><label class="toggle-switch"><input type="checkbox" :checked="animOn" @change="toggleAnim($event.target.checked)"><span class="slider"></span></label></div></div></div><div v-if="store.isAdmin" class="section"><h4>管理功能</h4><div style="margin-bottom:10px"><label class="field-label">消息时区</label><select id="tzSel" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px" @change="doSaveTz()"><option v-for="tz in tzList" :key="tz.v" :value="tz.v" :selected="store.timezone===tz.v">{{tz.l}}</option></select></div><button class="success" @click="currentModal='notice'">📌 置顶通知</button><button class="success" @click="openAppearance()">🎨 外观定制</button><button class="success" @click="currentModal='userMgmt';loadUsers()">👥 用户管理</button><button class="success" @click="currentModal='channelMgmt';loadAllChannels()">📺 频道管理</button><button class="success" @click="openFileMgmt()">📎 附件管理</button><button class="success" @click="openBgLibrary()">🖼️ 墙纸/视频库</button><button class="success" @click="doToggleReg()">📝 {{store.regOpen?'关闭':'开放'}}注册</button><button class="success" @click="currentModal='backup'">💾 备份/还原</button><button class="danger" @click="currentModal='deleteMsg'">🗑️ 删除记录</button></div><button class="close-btn" @click="currentModal=''">关闭</button></div></div>
<div v-if="currentModal==='channelMgmt'" class="modal-overlay" @click.self="currentModal=''"><div class="modal"><h3>📺 频道管理</h3><div class="section"><h4>新建频道</h4><input id="newChName" type="text" placeholder="频道名称"><input id="newChDesc" type="text" placeholder="频道描述 (选填)"><label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:14px"><input type="checkbox" id="newChPrivate"> 私有频道</label><button @click="doCreateChannel()">创建频道</button><p id="chCreateMsg" style="font-size:13px"></p></div><div class="section"><h4>已有频道</h4><div v-for="ch in modalData.allChannels||[]" :key="ch.id" class="ch-mgmt-item"><div class="ch-info"><div class="ch-name">{{ch.is_private?'🔒':''}} {{ch.name}}</div><div class="ch-meta">{{ch.description||'无描述'}} · {{ch._memberCount||0}}人</div></div><button style="width:auto;padding:6px 10px;font-size:12px;margin:0;background:#667eea" @click="openChannelPerm(ch)">权限</button><button v-if="!ch.is_default" style="width:auto;padding:6px 10px;font-size:12px;margin:0;background:#dc2626" @click="doDeleteChannel(ch)">删除</button></div></div><button class="close-btn" @click="currentModal='settings'">返回</button></div></div>
<div v-if="currentModal==='channelPerm'" class="modal-overlay" @click.self="currentModal='channelMgmt'"><div class="modal"><h3>🔐 频道权限: {{modalData.permChannel?.name}}</h3><div class="section"><h4>添加成员</h4><select id="addMemberSel" style="width:70%;display:inline-block"><option v-for="u in modalData.nonMembers||[]" :key="u.username" :value="u.username">{{u.nickname||u.username}}</option></select><button style="width:28%;display:inline-block;margin-left:2%" @click="doAddMember()">添加</button></div><div class="section"><h4>当前成员</h4><div class="ch-perm-grid"><div v-for="m in modalData.permMembers||[]" :key="m.user_id" class="ch-perm-row"><span class="perm-user">{{m.nickname||m.username}}</span><select :value="m.role" @change="doChangeRole(m,$event.target.value)"><option value="owner">所有者</option><option value="admin">管理员</option><option value="member">成员</option><option value="viewer">只读</option></select><button style="width:auto;padding:4px 8px;font-size:11px;margin:0;background:#dc2626" @click="doRemoveMember(m)">移除</button></div></div></div><button class="close-btn" @click="currentModal='channelMgmt'">返回</button></div></div>
<div v-if="currentModal==='notice'" class="modal-overlay" @click.self="currentModal='settings'"><div class="modal"><h3>📌 置顶通知</h3><textarea id="noticeInput" rows="4" :value="store.notice.content||''" placeholder="输入通知内容..."></textarea><button @click="doSaveNotice()">发布</button><button class="danger" @click="doClearNotice()">撤下</button><p id="noticeMsg" style="font-size:13px;text-align:center"></p><button class="close-btn" @click="currentModal='settings'">返回</button></div></div>
<div v-if="currentModal==='appearance'" class="modal-overlay" @click.self="currentModal='settings'">
  <div class="modal modal-wide">
    <h3>🎨 外观定制</h3>

    <!-- ===== 实时预览 ===== -->
    <div class="section appear-preview-section">
      <h4>👁️ 实时预览 <span class="preview-hint">(下面调整时此处同步更新)</span></h4>

      <div class="appear-preview-row">
        <!-- 登录页迷你预览 -->
        <div class="appear-preview-card">
          <div class="appear-preview-label">登录页</div>
          <div class="appear-preview-stage">
            <!-- 背景层 -->
            <div v-if="modalData.appDraft.login_bg_type==='gradient'"
                 class="appear-preview-bg"
                 :style="{background:'linear-gradient(135deg,'+(modalData.appDraft.login_bg_color1||'#667eea')+','+(modalData.appDraft.login_bg_color2||'#764ba2')+')'}"></div>
            <div v-else-if="modalData.appDraft.login_bg_type==='color'"
                 class="appear-preview-bg"
                 :style="{background:modalData.appDraft.login_bg_color1||'#667eea'}"></div>
            <img v-else-if="modalData.appDraft.login_bg_type==='image' && modalData.appDraft.login_bg_image"
                 class="appear-preview-bg"
                 :src="appBgPreviewUrl(modalData.appDraft.login_bg_image)"
                 :style="bgFitStyle(modalData.appDraft.login_bg_mode)">
            <video v-else-if="modalData.appDraft.login_bg_type==='video' && modalData.appDraft.login_bg_video"
                   class="appear-preview-bg"
                   :src="appBgPreviewUrl(modalData.appDraft.login_bg_video)"
                   :style="bgFitStyle(modalData.appDraft.login_bg_video_mode)"
                   muted autoplay loop playsinline></video>
            <div v-else class="appear-preview-bg appear-preview-empty">未设置</div>
            <!-- 登录卡片占位 -->
            <div class="appear-preview-card-fake">
              <div class="appear-preview-title">{{modalData.appDraft.login_title||'团队聊天室'}}</div>
              <div class="appear-preview-input"></div>
              <div class="appear-preview-input"></div>
              <div class="appear-preview-btn"
                   :style="{background:modalData.appDraft.send_color||'#667eea'}">登录</div>
            </div>
          </div>
        </div>

        <!-- 聊天页迷你预览 -->
        <div class="appear-preview-card">
          <div class="appear-preview-label">聊天页</div>
          <div class="appear-preview-stage">
            <div v-if="modalData.appDraft.bg_type==='color'"
                 class="appear-preview-bg"
                 :style="{background:modalData.appDraft.bg_color||'#f0f2f5'}"></div>
            <img v-else-if="modalData.appDraft.bg_type==='image' && modalData.appDraft.bg_image"
                 class="appear-preview-bg"
                 :src="appBgPreviewUrl(modalData.appDraft.bg_image)"
                 :style="bgFitStyle(modalData.appDraft.bg_mode)">
            <video v-else-if="modalData.appDraft.bg_type==='video' && modalData.appDraft.bg_video"
                   class="appear-preview-bg"
                   :src="appBgPreviewUrl(modalData.appDraft.bg_video)"
                   :style="bgFitStyle(modalData.appDraft.bg_video_mode)"
                   muted autoplay loop playsinline></video>
            <div v-else class="appear-preview-bg appear-preview-empty"
                 :style="{background:modalData.appDraft.bg_color||'#f0f2f5'}"></div>
            <!-- 聊天气泡占位 -->
            <div class="appear-preview-chat">
              <div class="appear-preview-bubble other">{{modalData.appDraft.chat_title||'TeamChat'}}</div>
              <div class="appear-preview-bubble my"
                   :style="{background:modalData.appDraft.send_color||'#667eea'}">你好 👋</div>
            </div>
            <!-- 输入栏占位 -->
            <div class="appear-preview-inputbar">
              <div class="appear-preview-textfield"></div>
              <div class="appear-preview-sendbtn"
                   :style="{background:modalData.appDraft.send_color||'#667eea'}">{{modalData.appDraft.send_text||'发送'}}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 文字 / 按钮 ===== -->
    <div class="section">
      <h4>📝 文字</h4>
      <label class="field-label">登录页标题</label>
      <input type="text" v-model="modalData.appDraft.login_title" placeholder="团队聊天室" maxlength="30">
      <label class="field-label">侧栏 / 聊天标题</label>
      <input type="text" v-model="modalData.appDraft.chat_title" placeholder="TeamChat" maxlength="30">
      <label class="field-label">发送按钮文字</label>
      <input type="text" v-model="modalData.appDraft.send_text" placeholder="发送" maxlength="10">
      <label class="field-label">发送按钮颜色</label>
      <div class="color-row">
        <input type="color" v-model="modalData.appDraft.send_color">
        <span style="font-size:13px;color:#666">{{modalData.appDraft.send_color}}</span>
      </div>
    </div>

    <!-- ===== 聊天背景 ===== -->
    <div class="section">
      <h4>💬 聊天背景</h4>
      <label class="field-label">类型</label>
      <div class="radio-group">
        <label><input type="radio" value="color" v-model="modalData.appDraft.bg_type"> 纯色</label>
        <label><input type="radio" value="image" v-model="modalData.appDraft.bg_type"> 图片</label>
        <label><input type="radio" value="video" v-model="modalData.appDraft.bg_type"> 视频</label>
      </div>

      <!-- 颜色 (任意类型下都可作为兜底底色) -->
      <label class="field-label">底色 {{modalData.appDraft.bg_type==='color'?'':' (兜底, 图片/视频透明区域显示)'}}</label>
      <div class="color-row">
        <input type="color" v-model="modalData.appDraft.bg_color">
        <span style="font-size:13px;color:#666">{{modalData.appDraft.bg_color}}</span>
      </div>

      <!-- 图片 -->
      <div v-if="modalData.appDraft.bg_type==='image'" class="bg-config-block">
        <label class="field-label">已选: <span class="bg-current-name">{{modalData.appDraft.bg_image||'(未选择)'}}</span></label>
        <div class="bg-current-preview" v-if="modalData.appDraft.bg_image">
          <img :src="appBgPreviewUrl(modalData.appDraft.bg_image)" alt="">
          <button class="bg-current-clear" @click="pickAppBg('bg_image','')" type="button">清除</button>
        </div>

        <label class="field-label">从已上传素材中选择</label>
        <div v-if="!appBgImages().length" class="bg-picker-empty">素材库暂无图片, 点下面「上传新图片」即可添加。</div>
        <div v-else class="bg-picker-grid">
          <div v-for="b in appBgImages()" :key="b.filename"
               class="bg-picker-item"
               :class="{sel:modalData.appDraft.bg_image===b.filename}"
               @click="pickAppBg('bg_image',b.filename)"
               :title="b.filename+' ('+fmtSize(b.size)+')'">
            <img :src="appBgPreviewUrl(b.filename)" alt="">
            <span v-if="modalData.appDraft.bg_image===b.filename" class="bg-picker-tick">✓</span>
          </div>
        </div>

        <input type="file" accept="image/*" hidden ref="bgImgFile" @change="doAppBgUpload($event,'bg_image')">
        <button class="secondary" @click="$refs.bgImgFile.click()" :disabled="modalData.appUploading==='bg_image'">
          {{modalData.appUploading==='bg_image'?'⏳ 上传中…':'📤 上传新图片'}}
        </button>
        <label class="field-label">适配方式</label>
        <div class="radio-group">
          <label><input type="radio" value="fill"    v-model="modalData.appDraft.bg_mode"> 填充 (cover)</label>
          <label><input type="radio" value="fit"     v-model="modalData.appDraft.bg_mode"> 适应 (contain)</label>
          <label><input type="radio" value="stretch" v-model="modalData.appDraft.bg_mode"> 拉伸 (100%×100%)</label>
          <label><input type="radio" value="tile"    v-model="modalData.appDraft.bg_mode"> 平铺</label>
        </div>
      </div>

      <!-- 视频 -->
      <div v-if="modalData.appDraft.bg_type==='video'" class="bg-config-block">
        <label class="field-label">已选: <span class="bg-current-name">{{modalData.appDraft.bg_video||'(未选择)'}}</span></label>
        <div class="bg-current-preview" v-if="modalData.appDraft.bg_video">
          <video :src="appBgPreviewUrl(modalData.appDraft.bg_video)" muted autoplay loop playsinline></video>
          <button class="bg-current-clear" @click="pickAppBg('bg_video','')" type="button">清除</button>
        </div>

        <label class="field-label">从已上传素材中选择</label>
        <div v-if="!appBgVideos().length" class="bg-picker-empty">素材库暂无视频, 点下面「上传新视频」即可添加。</div>
        <div v-else class="bg-picker-grid">
          <div v-for="b in appBgVideos()" :key="b.filename"
               class="bg-picker-item"
               :class="{sel:modalData.appDraft.bg_video===b.filename}"
               @click="pickAppBg('bg_video',b.filename)"
               :title="b.filename+' ('+fmtSize(b.size)+')'">
            <video :src="appBgPreviewUrl(b.filename)" muted preload="metadata"></video>
            <span class="bg-picker-kind">视频</span>
            <span v-if="modalData.appDraft.bg_video===b.filename" class="bg-picker-tick">✓</span>
          </div>
        </div>

        <input type="file" accept="video/*" hidden ref="bgVidFile" @change="doAppBgUpload($event,'bg_video')">
        <button class="secondary" @click="$refs.bgVidFile.click()" :disabled="modalData.appUploading==='bg_video'">
          {{modalData.appUploading==='bg_video'?'⏳ 上传中…':'📤 上传新视频'}}
        </button>
        <label class="field-label">适配方式</label>
        <div class="radio-group">
          <label><input type="radio" value="fill"    v-model="modalData.appDraft.bg_video_mode"> 填充 (cover)</label>
          <label><input type="radio" value="fit"     v-model="modalData.appDraft.bg_video_mode"> 适应 (contain)</label>
          <label><input type="radio" value="stretch" v-model="modalData.appDraft.bg_video_mode"> 拉伸 (fill)</label>
        </div>
        <p class="hint">视频背景将自动 muted + loop + autoplay; iOS 需 muted 才能自动播放。</p>
      </div>
    </div>

    <!-- ===== 登录背景 ===== -->
    <div class="section">
      <h4>🔐 登录背景</h4>
      <label class="field-label">类型</label>
      <div class="radio-group">
        <label><input type="radio" value="gradient" v-model="modalData.appDraft.login_bg_type"> 渐变</label>
        <label><input type="radio" value="color"    v-model="modalData.appDraft.login_bg_type"> 纯色</label>
        <label><input type="radio" value="image"    v-model="modalData.appDraft.login_bg_type"> 图片</label>
        <label><input type="radio" value="video"    v-model="modalData.appDraft.login_bg_type"> 视频</label>
      </div>

      <div v-if="modalData.appDraft.login_bg_type==='gradient'">
        <label class="field-label">渐变起始色</label>
        <div class="color-row"><input type="color" v-model="modalData.appDraft.login_bg_color1"><span style="font-size:13px;color:#666">{{modalData.appDraft.login_bg_color1}}</span></div>
        <label class="field-label">渐变结束色</label>
        <div class="color-row"><input type="color" v-model="modalData.appDraft.login_bg_color2"><span style="font-size:13px;color:#666">{{modalData.appDraft.login_bg_color2}}</span></div>
      </div>

      <div v-if="modalData.appDraft.login_bg_type==='color'">
        <label class="field-label">颜色</label>
        <div class="color-row"><input type="color" v-model="modalData.appDraft.login_bg_color1"><span style="font-size:13px;color:#666">{{modalData.appDraft.login_bg_color1}}</span></div>
      </div>

      <div v-if="modalData.appDraft.login_bg_type==='image'" class="bg-config-block">
        <label class="field-label">已选: <span class="bg-current-name">{{modalData.appDraft.login_bg_image||'(未选择)'}}</span></label>
        <div class="bg-current-preview" v-if="modalData.appDraft.login_bg_image">
          <img :src="appBgPreviewUrl(modalData.appDraft.login_bg_image)" alt="">
          <button class="bg-current-clear" @click="pickAppBg('login_bg_image','')" type="button">清除</button>
        </div>

        <label class="field-label">从已上传素材中选择</label>
        <div v-if="!appBgImages().length" class="bg-picker-empty">素材库暂无图片, 点下面「上传新图片」即可添加。</div>
        <div v-else class="bg-picker-grid">
          <div v-for="b in appBgImages()" :key="b.filename"
               class="bg-picker-item"
               :class="{sel:modalData.appDraft.login_bg_image===b.filename}"
               @click="pickAppBg('login_bg_image',b.filename)"
               :title="b.filename+' ('+fmtSize(b.size)+')'">
            <img :src="appBgPreviewUrl(b.filename)" alt="">
            <span v-if="modalData.appDraft.login_bg_image===b.filename" class="bg-picker-tick">✓</span>
          </div>
        </div>

        <input type="file" accept="image/*" hidden ref="loginImgFile" @change="doAppBgUpload($event,'login_bg_image')">
        <button class="secondary" @click="$refs.loginImgFile.click()" :disabled="modalData.appUploading==='login_bg_image'">
          {{modalData.appUploading==='login_bg_image'?'⏳ 上传中…':'📤 上传新图片'}}
        </button>
        <label class="field-label">适配方式</label>
        <div class="radio-group">
          <label><input type="radio" value="fill"    v-model="modalData.appDraft.login_bg_mode"> 填充</label>
          <label><input type="radio" value="fit"     v-model="modalData.appDraft.login_bg_mode"> 适应</label>
          <label><input type="radio" value="stretch" v-model="modalData.appDraft.login_bg_mode"> 拉伸</label>
          <label><input type="radio" value="tile"    v-model="modalData.appDraft.login_bg_mode"> 平铺</label>
        </div>
      </div>

      <div v-if="modalData.appDraft.login_bg_type==='video'" class="bg-config-block">
        <label class="field-label">已选: <span class="bg-current-name">{{modalData.appDraft.login_bg_video||'(未选择)'}}</span></label>
        <div class="bg-current-preview" v-if="modalData.appDraft.login_bg_video">
          <video :src="appBgPreviewUrl(modalData.appDraft.login_bg_video)" muted autoplay loop playsinline></video>
          <button class="bg-current-clear" @click="pickAppBg('login_bg_video','')" type="button">清除</button>
        </div>

        <label class="field-label">从已上传素材中选择</label>
        <div v-if="!appBgVideos().length" class="bg-picker-empty">素材库暂无视频, 点下面「上传新视频」即可添加。</div>
        <div v-else class="bg-picker-grid">
          <div v-for="b in appBgVideos()" :key="b.filename"
               class="bg-picker-item"
               :class="{sel:modalData.appDraft.login_bg_video===b.filename}"
               @click="pickAppBg('login_bg_video',b.filename)"
               :title="b.filename+' ('+fmtSize(b.size)+')'">
            <video :src="appBgPreviewUrl(b.filename)" muted preload="metadata"></video>
            <span class="bg-picker-kind">视频</span>
            <span v-if="modalData.appDraft.login_bg_video===b.filename" class="bg-picker-tick">✓</span>
          </div>
        </div>

        <input type="file" accept="video/*" hidden ref="loginVidFile" @change="doAppBgUpload($event,'login_bg_video')">
        <button class="secondary" @click="$refs.loginVidFile.click()" :disabled="modalData.appUploading==='login_bg_video'">
          {{modalData.appUploading==='login_bg_video'?'⏳ 上传中…':'📤 上传新视频'}}
        </button>
        <label class="field-label">适配方式</label>
        <div class="radio-group">
          <label><input type="radio" value="fill"    v-model="modalData.appDraft.login_bg_video_mode"> 填充</label>
          <label><input type="radio" value="fit"     v-model="modalData.appDraft.login_bg_video_mode"> 适应</label>
          <label><input type="radio" value="stretch" v-model="modalData.appDraft.login_bg_video_mode"> 拉伸</label>
        </div>
      </div>
    </div>

    <!-- ===== 视差壁纸 (实验性 - 接口预留) ===== -->
    <div class="section parallax-section">
      <h4>📱 视差壁纸 (Parallax / Perspective) <span class="exp-tag">实验性</span></h4>
      <p class="hint">
        启用后, 上方设置的图片/视频背景会随手机姿态轻微位移, 模拟透视景深。
        此功能后期会扩展为多图层穿透视差; 当前为接口预留, 同时已可工作于单层背景。
      </p>

      <label class="parallax-toggle">
        <input type="checkbox" v-model="modalData.appDraft.parallax_enabled">
        <span>启用陀螺仪视差</span>
      </label>

      <label class="field-label">视差强度: {{modalData.appDraft.parallax_strength}}</label>
      <input type="range" min="0" max="100" step="1" v-model.number="modalData.appDraft.parallax_strength" style="width:100%">

      <div class="gyro-box">
        <div class="gyro-status" :class="{warn:!modalData.gyroState.supported}">
          {{modalData.gyroState.msg}}
        </div>

        <div v-if="modalData.gyroState.live" class="gyro-live">
          实时姿态: β={{modalData.gyroState.live.beta?.toFixed(1)}}°
          γ={{modalData.gyroState.live.gamma?.toFixed(1)}}°
          α={{modalData.gyroState.live.alpha?.toFixed(1)}}°
        </div>

        <div v-if="modalData.gyroState.baselineLocal" class="gyro-baseline">
          已采基线: β={{modalData.gyroState.baselineLocal.beta.toFixed(2)}}°
          γ={{modalData.gyroState.baselineLocal.gamma.toFixed(2)}}°
          ({{modalData.gyroState.baselineLocal.samples}} 样本)
        </div>

        <div class="gyro-actions">
          <button v-if="modalData.gyroState.needsPerm && !modalData.gyroState.permGranted"
                  class="secondary" @click="doRequestGyroPerm()">🔓 授权陀螺仪</button>
          <button :disabled="!modalData.gyroState.supported || modalData.gyroState.capturing"
                  @click="doStartGyroCapture()">
            {{modalData.gyroState.capturing?'📡 采集中…':'📍 校准 (放平 2 秒)'}}
          </button>
          <button v-if="modalData.gyroState.baselineLocal" class="success" @click="doSaveGyroBaseline()">
            💾 仅保存基线
          </button>
        </div>
      </div>
    </div>

    <!-- ===== 底部操作 ===== -->
    <button @click="doSaveAppearance()">💾 保存并应用</button>
    <p style="font-size:13px;text-align:center;min-height:18px">{{modalData.appearMsg}}</p>
    <button class="close-btn" @click="currentModal='settings'">返回</button>
  </div>
</div>
<div v-if="currentModal==='userMgmt'" class="modal-overlay" @click.self="currentModal='settings'"><div class="modal"><h3>👥 用户管理</h3><div class="section" style="display:flex;gap:8px;flex-wrap:wrap"><button class="success" style="flex:1;min-width:120px" @click="$refs.importFileInput.click()">📥 导入用户</button><input type="file" accept=".json" hidden ref="importFileInput" @change="doImportUsersFile($event)"><button class="success" style="flex:1;min-width:120px" @click="doExportUsers()">📤 导出用户</button></div><div class="section"><h4>添加用户</h4><input id="newU" type="text" placeholder="用户名"><input id="newUP" type="password" placeholder="密码 (至少6位)"><input id="newUN" type="text" placeholder="昵称"><button @click="doAddUser()">添加</button><p id="addUserMsg" style="font-size:13px"></p></div><div class="section"><h4>用户列表</h4><div class="user-list"><div v-for="u in modalData.users||[]" :key="u.id" class="user-item"><div><span class="username">{{u.username}}</span><span v-if="u.is_admin" style="color:#667eea;font-size:11px;margin-left:4px">(管理员)</span><br><span class="nickname">{{u.nickname}}</span></div><div><button v-if="!u.is_admin" style="background:#dc2626" @click="doDeleteUser(u)">删除</button></div></div></div></div><button class="close-btn" @click="currentModal='settings'">返回</button></div></div>
<div v-if="currentModal==='userImport'" class="modal-overlay" @click.self="currentModal='userMgmt'"><div class="modal" style="max-width:600px"><h3>📥 导入用户预览</h3><div class="section"><div style="display:flex;gap:8px;margin-bottom:10px"><button style="font-size:12px;padding:6px 12px;width:auto" @click="doImportToggleAll(true)">全选</button><button style="font-size:12px;padding:6px 12px;width:auto" @click="doImportToggleAll(false)">全不选</button><span style="font-size:13px;color:#666;line-height:32px">共 {{(modalData.importPreview||[]).length}} 人，已勾选 {{(modalData.importPreview||[]).filter(u=>u.checked).length}} 人</span></div><div class="import-preview-list"><div v-for="(u,i) in modalData.importPreview||[]" :key="i" class="import-preview-row" :class="{'import-exists':u.exists}"><label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer"><input type="checkbox" v-model="u.checked"><span class="username">{{u.username}}</span><span class="nickname" style="color:#888">{{u.nickname}}</span><span v-if="u.exists" class="import-tag-exists">已存在</span></label></div></div></div><div class="section"><button class="success" @click="doConfirmImport()" :disabled="!(modalData.importPreview||[]).some(u=>u.checked)">确认导入</button><p style="font-size:13px;margin-top:8px;min-height:20px">{{modalData.importMsg}}</p></div><button class="close-btn" @click="currentModal='userMgmt';loadUsers()">返回</button></div></div>
<div v-if="currentModal==='backup'" class="modal-overlay" @click.self="currentModal='settings'"><div class="modal"><h3>💾 备份与还原</h3><div class="section"><h4>导出备份</h4><input type="date" id="bkStart"><input type="date" id="bkEnd"><button @click="doExportBackup()">下载备份</button></div><div class="section"><h4>还原备份</h4><input type="file" id="restoreFile" accept=".json"><button @click="doRestoreBackup()">还原</button></div><p id="backupMsg" style="font-size:13px;text-align:center"></p><button class="close-btn" @click="currentModal='settings'">返回</button></div></div>
<div v-if="currentModal==='deleteMsg'" class="modal-overlay" @click.self="currentModal='settings'"><div class="modal"><h3>🗑️ 删除聊天记录</h3><p style="color:#dc2626;text-align:center">⚠️ 此操作不可恢复！</p><input type="date" id="delStart"><input type="date" id="delEnd"><button class="danger" @click="doDeleteMessages()">确认删除</button><p id="delMsg" style="font-size:13px;text-align:center"></p><button class="close-btn" @click="currentModal='settings'">返回</button></div></div>

<div v-if="currentModal==='fileMgmt'" class="modal-overlay" @click.self="currentModal='settings'">
  <div class="modal modal-wide">
    <h3>📎 附件管理</h3>
    <p class="hint" style="margin:0 0 10px">
      此处仅显示<b>聊天发送</b>的图片/文件。
      管理员在「外观定制」上传的墙纸/视频不在这里, 请到
      <a href="#" @click.prevent="openBgLibrary()" style="color:#667eea;font-weight:600">🖼️ 墙纸/视频库</a> 查看。
    </p>
    <div class="fm-toolbar">
      <select v-model="modalData.filesFilter.type" @change="loadFiles()">
        <option value="">全部类型</option>
        <option value="image">仅图片</option>
        <option value="file">仅文件</option>
        <option value="voice">仅语音</option>
      </select>
      <input type="text" v-model="modalData.filesFilter.q" placeholder="按文件名搜索…" @keyup.enter="loadFiles()">
      <button @click="loadFiles()" style="width:auto!important;margin:0!important;padding:8px 14px!important;font-size:13px!important">搜索</button>
      <span class="fm-stat">{{(modalData.files||[]).length}} 项 · 共 {{fmtSize(modalData.filesTotalSize||0)}}</span>
    </div>
    <div class="fm-bulkbar">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:#3730a3;font-weight:500">
        <input type="checkbox" :checked="(modalData.filesSelected||new Set()).size===(modalData.files||[]).length && (modalData.files||[]).length>0" @change="toggleFileSelAll()">
        全选
      </label>
      <span class="fm-bulkinfo">已选 {{(modalData.filesSelected||new Set()).size}} 项</span>
      <button class="success" @click="doDownloadFiles()">⬇️ 下载</button>
      <button class="danger" @click="doDeleteFiles()">🗑️ 删除</button>
    </div>
    <div class="fm-list">
      <div v-if="!(modalData.files||[]).length" class="fm-empty">暂无附件</div>
      <div v-for="f in modalData.files||[]" :key="f.id" class="fm-row" :class="{sel:isFileSel(f.id),missing:!f.exists}" @click="toggleFileSel(f.id)">
        <input type="checkbox" :checked="isFileSel(f.id)" @click.stop="toggleFileSel(f.id)">
        <img v-if="f.type==='image' && f.exists" class="fm-thumb is-img" :src="API+'/uploads/'+encodeURIComponent(f.file_path)" alt="">
        <div v-else class="fm-thumb">{{fileIcon(f)}}</div>
        <div class="fm-info">
          <div class="fm-name" :title="f.file_name">{{f.type==='voice'?'🎤 语音消息 ('+fmtDuration(f.duration)+')':f.file_name}}</div>
          <div class="fm-meta">{{fmtSize(f.file_size)}} · {{f.nickname||f.username}} · #{{f.channel_name||f.channel_id}} · {{fmtTime(f.created_at)}}</div>
        </div>
        <a v-if="f.exists" class="fm-action" :href="(f.type==='voice'?API+'/voices/':API+'/uploads/')+encodeURIComponent(f.file_path)" :download="f.file_name" @click.stop="">下载</a>
      </div>
    </div>
    <p v-if="modalData.filesMsg" style="font-size:13px;text-align:center;margin-top:10px">{{modalData.filesMsg}}</p>
    <button class="close-btn" @click="currentModal='settings'">返回</button>
  </div>
</div>

<div v-if="currentModal==='bgLibrary'" class="modal-overlay" @click.self="currentModal='settings'">
  <div class="modal modal-wide">
    <h3>🖼️ 墙纸 / 视频库</h3>
    <div class="section" style="padding-bottom:10px">
      <h4 style="margin-top:0">当前使用中</h4>
      <div class="slot-status">
        <div v-for="s in modalData.bgSlots||[]" :key="s.key" class="slot-row">
          <span class="slot-label">{{s.label}}:</span>
          <span class="slot-val" :class="{empty:!(modalData.bgCurrent||{})[s.key]}" :title="(modalData.bgCurrent||{})[s.key]||'未设置'">{{(modalData.bgCurrent||{})[s.key]||'未设置'}}</span>
          <button v-if="(modalData.bgCurrent||{})[s.key]" class="slot-clear" @click="doApplyBg(s.key,'')">清空</button>
        </div>
      </div>
    </div>
    <div class="fm-toolbar">
      <span class="fm-stat" style="margin-left:0">{{(modalData.bgItems||[]).length}} 个文件 · 共 {{fmtSize(modalData.bgTotalSize||0)}}</span>
    </div>
    <div class="fm-bulkbar">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;color:#3730a3;font-weight:500">
        <input type="checkbox" :checked="(modalData.bgSelected||new Set()).size===(modalData.bgItems||[]).length && (modalData.bgItems||[]).length>0" @change="toggleBgSelAll()">
        全选
      </label>
      <span class="fm-bulkinfo">已选 {{(modalData.bgSelected||new Set()).size}} 个</span>
      <button class="danger" @click="doDeleteBg(false)">🗑️ 删除</button>
    </div>
    <div v-if="!(modalData.bgItems||[]).length" class="fm-empty" style="border:1px solid #eee;border-radius:8px">墙纸库为空。可在「外观定制」上传后,这里会显示已上传的素材以便复用。</div>
    <div v-else class="bg-grid">
      <div v-for="b in modalData.bgItems||[]" :key="b.filename" class="bg-card" :class="{sel:isBgSel(b.filename)}">
        <div class="bg-check" @click="toggleBgSel(b.filename)">✓</div>
        <span class="bg-kind">{{b.kind==='image'?'图':b.kind==='video'?'视频':'?'}}</span>
        <img v-if="b.kind==='image'" class="bg-thumb" :src="bgPreviewUrl(b.filename)" :alt="b.filename" @click="toggleBgSel(b.filename)">
        <video v-else-if="b.kind==='video'" class="bg-thumb" :src="bgPreviewUrl(b.filename)" muted preload="metadata" @click="toggleBgSel(b.filename)"></video>
        <div v-else class="bg-thumb placeholder" @click="toggleBgSel(b.filename)">📄</div>
        <div class="bg-foot">
          <div class="bg-fname" :title="b.filename">{{b.filename}}</div>
          <div class="bg-fmeta">{{fmtSize(b.size)}}</div>
          <div v-if="b.used_by && b.used_by.length" class="bg-used">
            <span v-for="u in b.used_by" :key="u.key" class="bg-used-tag">{{u.label}}</span>
          </div>
          <select class="bg-apply" @change="doApplyBg($event.target.value,b.filename);$event.target.value=''">
            <option value="">应用到 ▾</option>
            <option v-for="s in modalData.bgSlots||[]" :key="s.key" :value="s.key" :disabled="s.kind!==b.kind">{{s.label}}{{s.kind!==b.kind?' (类型不符)':''}}</option>
          </select>
        </div>
      </div>
    </div>
    <p v-if="modalData.bgMsg" style="font-size:13px;text-align:center;margin-top:10px">{{modalData.bgMsg}}</p>
    <button class="close-btn" @click="currentModal='settings'">返回</button>
  </div>
</div>

<div v-if="currentModal==='chainNew'" class="modal-overlay" @click.self="currentModal=''"><div class="modal" style="max-width:400px"><h3>🚂 发起接龙</h3><label class="field-label">接龙话题</label><input v-model="chainTopic" type="text" placeholder="例如：明天团建午餐吃什么？"><label class="field-label">补充说明 (选填)</label><textarea v-model="chainDesc" rows="2" placeholder="规则、选项等..."></textarea><div style="display:flex;gap:10px;margin-top:10px"><button class="secondary" style="flex:1" @click="currentModal=''">取消</button><button style="flex:1" @click="sendChain(chainTopic.trim(),chainDesc.trim())">发起</button></div></div></div>
`,

  methods: {
    ...AdminMethods,
    ...FilesAdminMethods,

    getReplyPreview(replyId) {
      const ch = msgStore[store.currentChannelId]; if (!ch) return '';
      const m = ch.msgs.find(m => m.id === replyId); if (!m) return '';
      const name = m.nickname || m.username;
      if (m.type === 'image') return name + ': [图片]';
      if (m.type === 'file') return name + ': [文件]';
      if (m.type === 'voice') return name + ': [语音消息]';
      return name + ': ' + (m.content || '').replace(/<[^>]*>/g, '').substring(0, 40);
    },

    isMentioned(msg) {
      if (!msg.content || msg.type !== 'text') return false;
      if (msg.username === store.username) return false;
      if (msg.content.startsWith('[CHAIN]')) return false;
      var c = msg.content.toLowerCase();
      var nick = (store.nickname || '').toLowerCase();
      var uname = store.username.toLowerCase();
      return (nick && c.indexOf('@' + nick) >= 0) || c.indexOf('@' + uname) >= 0;
    },

    renderChain(msg) {
      const d = this.parseChain(msg.content); if (!d) return '';
      let h = '<div class="chain-card"><div class="chain-header">🚂 接龙</div>';
      h += '<div class="chain-topic">' + esc(d.topic) + '</div>';
      if (d.desc) h += '<div class="chain-desc">' + esc(d.desc) + '</div>';
      if (d.participants && d.participants.length) {
        h += '<div class="chain-list">';
        d.participants.forEach(p => {
          h += '<div><span class="chain-seq">' + p.seq + '</span><span class="chain-name">' + esc(p.name) + '</span>' + (p.text ? ' ' + esc(p.text) : '') + '</div>';
        });
        h += '</div>';
      }
      const joined = d.participants && d.participants.some(p => p.username === store.username);
      if (joined) h += '<button class="chain-join-btn joined" disabled>✅ 已参与</button>';
      else h += '<button class="chain-join-btn" onclick="document.querySelector(\'#app\').__vue_app__.config.globalProperties.$root.joinChainById(' + msg.id + ')">🙋 参与接龙</button>';
      return h + '</div>';
    },

    downloadFile(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); },

    /* 把 fill/fit/stretch/tile 翻译成预览图/视频用的 CSS */
    bgFitStyle(mode) {
      switch (mode) {
        case 'fit':     return { objectFit: 'contain', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' };
        case 'stretch': return { objectFit: 'fill',    backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' };
        case 'tile':    return { objectFit: 'none',    backgroundSize: 'auto',     backgroundRepeat: 'repeat',    backgroundPosition: 'center' };
        case 'fill':
        default:        return { objectFit: 'cover',   backgroundSize: 'cover',    backgroundRepeat: 'no-repeat', backgroundPosition: 'center' };
      }
    },

    joinChainById(id) {
      const ch = msgStore[store.currentChannelId]; if (!ch) return;
      const m = ch.msgs.find(m => m.id === id); if (m) this.joinChain(m);
    },

    async doDeleteSingleMsg(msg) {
      this.ctxMenu = null;
      if (!msg || !msg.id) return;
      if (!confirm('确认删除这条消息？此操作不可恢复。')) return;
      try {
        const r = await fetch(API + '/api/messages/' + msg.id, {
          method: 'DELETE',
          headers: authH()
        });
        const d = await r.json();
        if (!d.success) alert(d.message || '删除失败');
      } catch(e) { alert('删除失败'); }
    },
  },

  async mounted() {
    this.applyEffectClasses();
    this.$watch(() => this.currentModal, async (v) => {
      if (v === 'settings') {
        await Vue.nextTick();
        const st = await checkPush();
        document.getElementById('pushInfo').textContent = st.subscribed ? '✅ 推送已开启' : st.reason || '推送未开启';
        const btn = document.getElementById('pushBtn');
        if (st.supported) {
          btn.style.display = 'block';
          btn.textContent = st.subscribed ? '关闭推送' : '开启推送';
          btn.style.background = st.subscribed ? '#dc2626' : '#667eea';
        }
      }
    });
  }
};

/* ===== iOS PWA keyboard fix ===== */
(function() {
  if (!/iPad|iPhone|iPod/.test(navigator.userAgent)) return;
  document.addEventListener('focusout', function(e) { setTimeout(function() { window.scrollTo(0, 0); }, 100); });
  if (window.visualViewport) {
    var lh = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', function() {
      var nh = window.visualViewport.height;
      if (nh > lh) { setTimeout(function() { window.scrollTo(0, 0); }, 50); }
      lh = nh;
    });
  }
})();

/* ===== Close emoji picker on outside click ===== */
document.addEventListener('click', function() {
  var app = document.querySelector('#app');
  if (app && app.__vue_app__) {
    try {
      var vm = app.__vue_app__._instance.proxy;
      if (vm && vm.showEmojiPicker) vm.showEmojiPicker = false;
      if (vm && vm.showPlusMenu) vm.showPlusMenu = false;
    } catch(e) {}
  }
});

/* ===== 挂载 ===== */
(function() {
  const app = Vue.createApp(App);
  app.config.globalProperties.$root = app._instance?.proxy;
  app.mount('#app');
})();
