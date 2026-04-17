/**
 * TeamChat 管理功能方法
 * 供 Vue 组件 methods 混入使用
 */
const AdminMethods = {
  async loadUsers() {
    try {
      const r = await fetch(API + '/api/users', { headers: authH() });
      if (r.ok) this.modalData.users = await r.json();
    } catch(e) {}
  },

  async doAddUser() {
    const u = document.getElementById('newU').value.trim();
    const p = document.getElementById('newUP').value;
    const n = document.getElementById('newUN').value.trim();
    const m = document.getElementById('addUserMsg');
    if (!u || !p) { m.textContent = '请填写完整'; return; }
    try {
      const r = await fetch(API + '/api/users', { method: 'POST', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ username: u, password: p, nickname: n || u }) });
      const d = await r.json();
      m.textContent = d.success ? '✅ 已添加' : d.message || '失败';
      if (d.success) this.loadUsers();
    } catch(e) { m.textContent = '失败'; }
  },

  async doDeleteUser(u) {
    if (!confirm('确认删除 ' + u.username + '?')) return;
    try { await fetch(API + '/api/users/' + u.username, { method: 'DELETE', headers: authH() }); this.loadUsers(); } catch(e) {}
  },

  async doChangePwd() {
    const o = document.getElementById('oldPwd').value;
    const n = document.getElementById('newPwd').value;
    const m = document.getElementById('pwdMsg');
    if (!o || !n || n.length < 6) { m.textContent = '请填写完整(新密码至少6位)'; return; }
    try {
      const r = await fetch(API + '/api/change-password', { method: 'POST', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ oldPassword: o, newPassword: n }) });
      const d = await r.json();
      m.textContent = d.success ? '✅ 已修改' : d.message || '失败';
    } catch(e) { m.textContent = '失败'; }
  },

  async doAvatarUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    const fd = new FormData(); fd.append('avatar', f);
    try {
      const r = await fetch(API + '/api/upload-avatar', { method: 'POST', headers: { 'Authorization': 'Bearer ' + store.token }, body: fd });
      const d = await r.json();
      if (d.success) { store.avatar = d.avatar; localStorage.setItem('avatar', d.avatar); document.getElementById('avatarMsg').textContent = '✅ 已更新'; }
      else document.getElementById('avatarMsg').textContent = d.message || '失败';
    } catch(e) { document.getElementById('avatarMsg').textContent = '失败'; }
  },

  async doSaveTz() {
    const tz = document.getElementById('tzSel').value;
    try { await fetch(API + '/api/settings/timezone', { method: 'POST', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ timezone: tz }) }); store.timezone = tz; } catch(e) {}
  },

  async doToggleReg() {
    try {
      const r = await fetch(API + '/api/settings/registration', { method: 'POST', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ open: !store.regOpen }) });
      const d = await r.json();
      if (d.success) store.regOpen = d.open;
    } catch(e) {}
  },

  async doSaveNotice() {
    const c = document.getElementById('noticeInput').value.trim();
    const m = document.getElementById('noticeMsg');
    if (!c) { m.textContent = '请输入内容'; return; }
    try {
      const r = await fetch(API + '/api/settings/notice', { method: 'POST', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ content: c, enabled: true }) });
      const d = await r.json();
      m.textContent = d.success ? '✅ 已发布' : '失败';
    } catch(e) { m.textContent = '失败'; }
  },

  async doClearNotice() {
    try {
      await fetch(API + '/api/settings/notice', { method: 'POST', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ content: '', enabled: false }) });
      document.getElementById('noticeMsg').textContent = '✅ 已撤下';
    } catch(e) {}
  },

  async doSaveAppearance() {
    const b = {
      login_title: document.getElementById('appLT').value,
      chat_title: document.getElementById('appCT').value,
      send_text: document.getElementById('appST').value,
      send_color: document.getElementById('appSC').value,
      bg_color: document.getElementById('appBG').value,
    };
    try {
      const r = await fetch(API + '/api/settings/appearance', { method: 'POST', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify(b) });
      const d = await r.json();
      document.getElementById('appearMsg').textContent = d.success ? '✅ 已保存' : '失败';
    } catch(e) { document.getElementById('appearMsg').textContent = '失败'; }
  },

  async doExportBackup() {
    const s = document.getElementById('bkStart').value, e = document.getElementById('bkEnd').value;
    let url = API + '/api/backup?';
    if (s && e) url += 'startDate=' + s + '&endDate=' + e;
    try {
      const r = await fetch(url, { headers: authH() });
      const d = await r.json();
      const bl = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(bl); a.download = 'teamchat-backup.json'; a.click();
    } catch(e) { document.getElementById('backupMsg').textContent = '导出失败'; }
  },

  async doRestoreBackup() {
    const f = document.getElementById('restoreFile').files[0]; if (!f) return;
    const t = await f.text();
    try {
      const d = JSON.parse(t);
      const r = await fetch(API + '/api/restore', { method: 'POST', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify(d) });
      const res = await r.json();
      document.getElementById('backupMsg').textContent = res.success ? '✅ 还原 ' + res.count + ' 条' : '失败';
    } catch(e) { document.getElementById('backupMsg').textContent = '格式错误'; }
  },

  async doDeleteMessages() {
    const s = document.getElementById('delStart').value, e = document.getElementById('delEnd').value;
    if (!s || !e) return;
    if (!confirm('确认删除 ' + s + ' 到 ' + e + ' 的记录?')) return;
    try {
      const r = await fetch(API + '/api/messages', { method: 'DELETE', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ startDate: s, endDate: e }) });
      const d = await r.json();
      document.getElementById('delMsg').textContent = d.success ? '✅ 已删除 ' + d.deleted + ' 条' : '失败';
    } catch(e) { document.getElementById('delMsg').textContent = '失败'; }
  },

  /* ===== 频道管理 ===== */
  async loadAllChannels() {
    try {
      const r = await fetch(API + '/api/admin/channels', { headers: authH() });
      if (r.ok) this.modalData.allChannels = await r.json();
    } catch(e) {}
  },

  async doCreateChannel() {
    const n = document.getElementById('newChName').value.trim();
    const d = document.getElementById('newChDesc').value.trim();
    const p = document.getElementById('newChPrivate').checked;
    const m = document.getElementById('chCreateMsg');
    if (!n) { m.textContent = '请输入频道名'; return; }
    try {
      const r = await fetch(API + '/api/channels', { method: 'POST', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name: n, description: d, is_private: p }) });
      const res = await r.json();
      m.textContent = res.success ? '✅ 已创建' : '失败: ' + (res.message || '');
      if (res.success) { this.loadAllChannels(); await loadChannels(); }
    } catch(e) { m.textContent = '失败'; }
  },

  async doDeleteChannel(ch) {
    if (!confirm('确认删除频道 ' + ch.name + '? 频道内的消息也会被删除。')) return;
    try { await fetch(API + '/api/channels/' + ch.id, { method: 'DELETE', headers: authH() }); this.loadAllChannels(); await loadChannels(); } catch(e) {}
  },

  async openChannelPerm(ch) {
    this.modalData.permChannel = ch;
    this.currentModal = 'channelPerm';
    try { const r = await fetch(API + '/api/channels/' + ch.id + '/members', { headers: authH() }); if (r.ok) this.modalData.permMembers = await r.json(); } catch(e) {}
    try {
      const r = await fetch(API + '/api/users', { headers: authH() });
      if (r.ok) {
        const all = await r.json();
        const memNames = new Set((this.modalData.permMembers || []).map(m => m.username));
        this.modalData.nonMembers = all.filter(u => !memNames.has(u.username));
      }
    } catch(e) {}
  },

  async doAddMember() {
    const u = document.getElementById('addMemberSel').value; if (!u) return;
    const ch = this.modalData.permChannel;
    try { await fetch(API + '/api/channels/' + ch.id + '/members', { method: 'POST', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ username: u, role: 'member' }) }); this.openChannelPerm(ch); } catch(e) {}
  },

  async doRemoveMember(m) {
    const ch = this.modalData.permChannel;
    try { await fetch(API + '/api/channels/' + ch.id + '/members/' + m.user_id, { method: 'DELETE', headers: authH() }); this.openChannelPerm(ch); } catch(e) {}
  },

  async doChangeRole(m, role) {
    const ch = this.modalData.permChannel;
    try { await fetch(API + '/api/channels/' + ch.id + '/members/' + m.user_id, { method: 'PUT', headers: authH({ 'Content-Type': 'application/json' }), body: JSON.stringify({ role }) }); this.openChannelPerm(ch); } catch(e) {}
  },

  async doPushToggle() {
    await togglePush();
    const st = await checkPush();
    document.getElementById('pushInfo').textContent = st.subscribed ? '✅ 推送已开启' : st.reason || '推送未开启';
    const btn = document.getElementById('pushBtn');
    if (st.supported) {
      btn.style.display = 'block';
      btn.textContent = st.subscribed ? '关闭推送' : '开启推送';
      btn.style.background = st.subscribed ? '#dc2626' : '#667eea';
    }
  },

  tzList: [
    { v: 'Asia/Shanghai', l: '中国标准时间 (UTC+8)' },
    { v: 'Asia/Tokyo', l: '日本标准时间 (UTC+9)' },
    { v: 'Asia/Singapore', l: '新加坡时间 (UTC+8)' },
    { v: 'Asia/Kolkata', l: '印度标准时间 (UTC+5:30)' },
    { v: 'Asia/Dubai', l: '海湾标准时间 (UTC+4)' },
    { v: 'Europe/London', l: '英国时间 (UTC+0/+1)' },
    { v: 'Europe/Paris', l: '中欧时间 (UTC+1/+2)' },
    { v: 'Europe/Moscow', l: '莫斯科时间 (UTC+3)' },
    { v: 'America/New_York', l: '美国东部时间' },
    { v: 'America/Chicago', l: '美国中部时间' },
    { v: 'America/Denver', l: '美国山地时间' },
    { v: 'America/Los_Angeles', l: '美国太平洋时间' },
    { v: 'Pacific/Auckland', l: '新西兰时间' },
    { v: 'Australia/Sydney', l: '悉尼时间' },
  ],
};
