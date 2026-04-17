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

    const currentChannel = computed(() => store.channels.find(c => c.id === store.currentChannelId) || null);
    const currentMessages = computed(() => { const ch = msgStore[store.currentChannelId]; return ch ? ch.msgs : []; });
    const onlineSet = computed(() => new Set(store.onlineUsers.map(u => u.username)));

    /* ===== Init ===== */
    onMounted(async () => {
      await initSW();
      await loadAppearance();
      try { const r = await fetch(API + '/api/settings/notice'); if (r.ok) { const d = await r.json(); store.notice = d; } } catch(e) {}
      try { const r = await fetch(API + '/api/settings/registration'); if (r.ok) { const d = await r.json(); store.regOpen = d.open; } } catch(e) {}
      if (store.token) { await enterChat(); }
      appInstance = { page };
    });

    async function enterChat() {
      page.value = 'chat';
      initSocket();
      await loadChannels();
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

    function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }

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
      doLogin, doRegister, logout, sendMsg, handleKey, insertNewline, autoGrow,
      uploadFile, sendChain, joinChain, parseChain, loadMore, showCtx, setReply,
      switchChannel: async (id) => { sidebarOpen.value = false; await switchChannel(id); },
      store, msgStore, API, esc, fmtTime, fmtSize, avatarUrl, sanitize,
      togglePush, checkPush
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
        <div v-for="m in currentMessages" :key="m.id" class="msg" :class="{my:m.username===store.username,other:m.username!==store.username}" @contextmenu="showCtx($event,m)">
          <img class="msg-avatar" :src="avatarUrl(m.avatar)" :alt="m.nickname||m.username">
          <div class="msg-body">
            <div class="msg-sender">{{m.nickname||m.username}}</div>
            <div class="msg-bubble">
              <div v-if="m.reply_to" class="reply-ref">{{getReplyPreview(m.reply_to)}}</div>
              <div v-if="m.type==='text'&&m.content&&m.content.startsWith('[CHAIN]')" v-html="renderChain(m)"></div>
              <div v-else-if="m.type==='text'" class="msg-content" v-html="sanitize(m.content)"></div>
              <img v-else-if="m.type==='image'" class="chat-image" :src="API+'/uploads/'+encodeURIComponent(m.file_path)" :alt="m.file_name" @click="currentModal='imagePreview';modalData={src:API+'/uploads/'+encodeURIComponent(m.file_path)}">
              <div v-else-if="m.type==='file'" class="file-card" @click="downloadFile(API+'/uploads/'+encodeURIComponent(m.file_path),m.file_name)">📄 {{m.file_name}} ({{fmtSize(m.file_size)}})</div>
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
      <button class="attach-btn" @click="$refs.fileInput.click()">📎</button>
      <input ref="fileInput" type="file" hidden @change="uploadFile($event.target.files[0]);$event.target.value=''">
      <textarea v-model="msgInput" placeholder="输入消息... (Shift+Enter 换行)" rows="1" enterkeyhint="send" @keydown="handleKey" @input="autoGrow"></textarea>
      <button class="newline-btn" @mousedown.prevent @click="insertNewline()">⏎</button>
      <button class="chain-btn" @click="currentModal='chainNew'" title="发起接龙">🚂</button>
      <button class="send-btn" @mousedown.prevent @click="sendMsg()">{{store.appearance.send_text||'发送'}}</button>
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
<div v-if="ctxMenu" class="msg-menu" :style="{left:ctxMenu.x+'px',top:ctxMenu.y+'px'}"><div class="menu-item" @click="setReply(ctxMenu.msg)">💬 引用回复</div></div>
<div v-if="currentModal==='imagePreview'" class="image-modal" @click="currentModal=''"><img :src="modalData.src" alt="预览"></div>
<div v-if="currentModal==='settings'" class="modal-overlay" @click.self="currentModal=''"><div class="modal"><h3>设置</h3><div class="section"><h4>🔔 推送通知</h4><p id="pushInfo" style="font-size:13px;color:#666">检测中...</p><button id="pushBtn" style="display:none" @click="doPushToggle()">开启推送</button></div><div class="section"><h4>上传头像</h4><div class="avatar-upload"><img class="avatar-preview" :src="avatarUrl(store.avatar)" alt=""><input type="file" accept="image/*" hidden ref="avatarFileInput" @change="doAvatarUpload($event)"><button @click="$refs.avatarFileInput.click()">选择图片</button><p id="avatarMsg" style="font-size:13px"></p></div></div><div class="section"><h4>修改密码</h4><input id="oldPwd" type="password" placeholder="原密码"><input id="newPwd" type="password" placeholder="新密码 (至少6位)"><button @click="doChangePwd()">确认修改</button><p id="pwdMsg" style="font-size:13px"></p></div><div v-if="store.isAdmin" class="section"><h4>管理功能</h4><div style="margin-bottom:10px"><label class="field-label">消息时区</label><select id="tzSel" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px" @change="doSaveTz()"><option v-for="tz in tzList" :key="tz.v" :value="tz.v" :selected="store.timezone===tz.v">{{tz.l}}</option></select></div><button class="success" @click="currentModal='notice'">📌 置顶通知</button><button class="success" @click="currentModal='appearance'">🎨 外观定制</button><button class="success" @click="currentModal='userMgmt';loadUsers()">👥 用户管理</button><button class="success" @click="currentModal='channelMgmt';loadAllChannels()">📺 频道管理</button><button class="success" @click="openFileMgmt()">📎 附件管理</button><button class="success" @click="openBgLibrary()">🖼️ 墙纸/视频库</button><button class="success" @click="doToggleReg()">📝 {{store.regOpen?'关闭':'开放'}}注册</button><button class="success" @click="currentModal='backup'">💾 备份/还原</button><button class="danger" @click="currentModal='deleteMsg'">🗑️ 删除记录</button></div><button class="close-btn" @click="currentModal=''">关闭</button></div></div>
<div v-if="currentModal==='channelMgmt'" class="modal-overlay" @click.self="currentModal=''"><div class="modal"><h3>📺 频道管理</h3><div class="section"><h4>新建频道</h4><input id="newChName" type="text" placeholder="频道名称"><input id="newChDesc" type="text" placeholder="频道描述 (选填)"><label style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:14px"><input type="checkbox" id="newChPrivate"> 私有频道</label><button @click="doCreateChannel()">创建频道</button><p id="chCreateMsg" style="font-size:13px"></p></div><div class="section"><h4>已有频道</h4><div v-for="ch in modalData.allChannels||[]" :key="ch.id" class="ch-mgmt-item"><div class="ch-info"><div class="ch-name">{{ch.is_private?'🔒':''}} {{ch.name}}</div><div class="ch-meta">{{ch.description||'无描述'}} · {{ch._memberCount||0}}人</div></div><button style="width:auto;padding:6px 10px;font-size:12px;margin:0;background:#667eea" @click="openChannelPerm(ch)">权限</button><button v-if="!ch.is_default" style="width:auto;padding:6px 10px;font-size:12px;margin:0;background:#dc2626" @click="doDeleteChannel(ch)">删除</button></div></div><button class="close-btn" @click="currentModal='settings'">返回</button></div></div>
<div v-if="currentModal==='channelPerm'" class="modal-overlay" @click.self="currentModal='channelMgmt'"><div class="modal"><h3>🔐 频道权限: {{modalData.permChannel?.name}}</h3><div class="section"><h4>添加成员</h4><select id="addMemberSel" style="width:70%;display:inline-block"><option v-for="u in modalData.nonMembers||[]" :key="u.username" :value="u.username">{{u.nickname||u.username}}</option></select><button style="width:28%;display:inline-block;margin-left:2%" @click="doAddMember()">添加</button></div><div class="section"><h4>当前成员</h4><div class="ch-perm-grid"><div v-for="m in modalData.permMembers||[]" :key="m.user_id" class="ch-perm-row"><span class="perm-user">{{m.nickname||m.username}}</span><select :value="m.role" @change="doChangeRole(m,$event.target.value)"><option value="owner">所有者</option><option value="admin">管理员</option><option value="member">成员</option><option value="viewer">只读</option></select><button style="width:auto;padding:4px 8px;font-size:11px;margin:0;background:#dc2626" @click="doRemoveMember(m)">移除</button></div></div></div><button class="close-btn" @click="currentModal='channelMgmt'">返回</button></div></div>
<div v-if="currentModal==='notice'" class="modal-overlay" @click.self="currentModal='settings'"><div class="modal"><h3>📌 置顶通知</h3><textarea id="noticeInput" rows="4" :value="store.notice.content||''" placeholder="输入通知内容..."></textarea><button @click="doSaveNotice()">发布</button><button class="danger" @click="doClearNotice()">撤下</button><p id="noticeMsg" style="font-size:13px;text-align:center"></p><button class="close-btn" @click="currentModal='settings'">返回</button></div></div>
<div v-if="currentModal==='appearance'" class="modal-overlay" @click.self="currentModal='settings'"><div class="modal"><h3>🎨 外观定制</h3><div class="section"><label class="field-label">登录标题</label><input id="appLT" type="text" :value="store.appearance.login_title||''" placeholder="团队聊天室" maxlength="30"><label class="field-label">聊天标题</label><input id="appCT" type="text" :value="store.appearance.chat_title||''" placeholder="团队聊天" maxlength="30"></div><div class="section"><label class="field-label">发送按钮文字</label><input id="appST" type="text" :value="store.appearance.send_text||''" placeholder="发送" maxlength="10"><label class="field-label">发送按钮颜色</label><div class="color-row"><input type="color" id="appSC" :value="store.appearance.send_color||'#667eea'"><span style="font-size:13px;color:#666">{{store.appearance.send_color||'#667eea'}}</span></div></div><div class="section"><label class="field-label">聊天背景颜色</label><div class="color-row"><input type="color" id="appBG" :value="store.appearance.bg_color||'#f0f2f5'"><span style="font-size:13px;color:#666">{{store.appearance.bg_color||'#f0f2f5'}}</span></div></div><button @click="doSaveAppearance()">💾 保存并应用</button><p id="appearMsg" style="font-size:13px;text-align:center"></p><button class="close-btn" @click="currentModal='settings'">返回</button></div></div>
<div v-if="currentModal==='userMgmt'" class="modal-overlay" @click.self="currentModal='settings'"><div class="modal"><h3>👥 用户管理</h3><div class="section"><h4>添加用户</h4><input id="newU" type="text" placeholder="用户名"><input id="newUP" type="password" placeholder="密码 (至少6位)"><input id="newUN" type="text" placeholder="昵称"><button @click="doAddUser()">添加</button><p id="addUserMsg" style="font-size:13px"></p></div><div class="section"><h4>用户列表</h4><div class="user-list"><div v-for="u in modalData.users||[]" :key="u.id" class="user-item"><div><span class="username">{{u.username}}</span><span v-if="u.is_admin" style="color:#667eea;font-size:11px;margin-left:4px">(管理员)</span><br><span class="nickname">{{u.nickname}}</span></div><div><button v-if="!u.is_admin" style="background:#dc2626" @click="doDeleteUser(u)">删除</button></div></div></div></div><button class="close-btn" @click="currentModal='settings'">返回</button></div></div>
<div v-if="currentModal==='backup'" class="modal-overlay" @click.self="currentModal='settings'"><div class="modal"><h3>💾 备份与还原</h3><div class="section"><h4>导出备份</h4><input type="date" id="bkStart"><input type="date" id="bkEnd"><button @click="doExportBackup()">下载备份</button></div><div class="section"><h4>还原备份</h4><input type="file" id="restoreFile" accept=".json"><button @click="doRestoreBackup()">还原</button></div><p id="backupMsg" style="font-size:13px;text-align:center"></p><button class="close-btn" @click="currentModal='settings'">返回</button></div></div>
<div v-if="currentModal==='deleteMsg'" class="modal-overlay" @click.self="currentModal='settings'"><div class="modal"><h3>🗑️ 删除聊天记录</h3><p style="color:#dc2626;text-align:center">⚠️ 此操作不可恢复！</p><input type="date" id="delStart"><input type="date" id="delEnd"><button class="danger" @click="doDeleteMessages()">确认删除</button><p id="delMsg" style="font-size:13px;text-align:center"></p><button class="close-btn" @click="currentModal='settings'">返回</button></div></div>

<div v-if="currentModal==='fileMgmt'" class="modal-overlay" @click.self="currentModal='settings'">
  <div class="modal modal-wide">
    <h3>📎 附件管理</h3>
    <div class="fm-toolbar">
      <select v-model="modalData.filesFilter.type" @change="loadFiles()">
        <option value="">全部类型</option>
        <option value="image">仅图片</option>
        <option value="file">仅文件</option>
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
          <div class="fm-name" :title="f.file_name">{{f.file_name}}</div>
          <div class="fm-meta">{{fmtSize(f.file_size)}} · {{f.nickname||f.username}} · #{{f.channel_name||f.channel_id}} · {{fmtTime(f.created_at)}}</div>
        </div>
        <a v-if="f.exists" class="fm-action" :href="API+'/uploads/'+encodeURIComponent(f.file_path)" :download="f.file_name" @click.stop="">下载</a>
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
      return name + ': ' + (m.content || '').replace(/<[^>]*>/g, '').substring(0, 40);
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

    joinChainById(id) {
      const ch = msgStore[store.currentChannelId]; if (!ch) return;
      const m = ch.msgs.find(m => m.id === id); if (m) this.joinChain(m);
    },
  },

  async mounted() {
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

/* ===== 挂载 ===== */
(function() {
  const app = Vue.createApp(App);
  app.config.globalProperties.$root = app._instance?.proxy;
  app.mount('#app');
  Vue.nextTick(() => applyAppearance(store.appearance));
})();
