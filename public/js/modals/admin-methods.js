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

  /* ====== 外观: 打开面板, 把后端最新值复制到草稿 ====== */
  async openAppearance() {
    const a = store.appearance || {};
    /* 兼容老库里的 mode = 'cover'/'auto'/'' -> 映射到新四态 */
    const fixMode = m => {
      if (m === 'fill' || m === 'fit' || m === 'stretch' || m === 'tile') return m;
      if (m === 'auto' || m === 'repeat') return 'tile';
      return 'fill'; /* 'cover' / '' / undefined / 其它老值 */
    };
    /* 重要: 先把 appBgList 占位放进去, 再设 currentModal,
     * 否则模板首次渲染时 modalData.appBgList 还没在响应式 proxy 里登记键,
     * 后续 loadAppBgList 写入时 Vue 不会触发 <select> 重渲染。 */
    this.modalData.appBgList    = [];   /* 库内可选文件 */
    this.modalData.appUploading = '';   /* 当前正在上传的槽位 key */
    this.modalData.appearMsg    = '';
    this.modalData.appDraft = {
      login_title:  a.login_title  || '',
      chat_title:   a.chat_title   || '',
      send_text:    a.send_text    || '',
      send_color:   a.send_color   || '#667eea',

      bg_type:        a.bg_type        || 'color',
      bg_color:       a.bg_color       || '#f0f2f5',
      bg_image:       a.bg_image       || '',
      bg_mode:        fixMode(a.bg_mode),
      bg_video:       a.bg_video       || '',
      bg_video_mode:  fixMode(a.bg_video_mode),

      login_bg_type:        a.login_bg_type        || 'gradient',
      login_bg_color1:      a.login_bg_color1      || '#667eea',
      login_bg_color2:      a.login_bg_color2      || '#764ba2',
      login_bg_image:       a.login_bg_image       || '',
      login_bg_mode:        fixMode(a.login_bg_mode),
      login_bg_video:       a.login_bg_video       || '',
      login_bg_video_mode:  fixMode(a.login_bg_video_mode),

      parallax_enabled:  a.parallax_enabled === '1',
      parallax_strength: parseInt(a.parallax_strength) || 30
    };
    this.modalData.gyroState = this._gyroInitState();
    this.currentModal = 'appearance';
    /* 必须 await: 早期不 await, 一旦请求慢一点点用户就以为列表空 */
    await this.loadAppBgList();
  },

  async loadAppBgList() {
    try {
      const r = await fetch(API + '/api/admin/backgrounds', { headers: authH() });
      if (!r.ok) {
        this.modalData.appearMsg = '⚠️ 素材库加载失败 (HTTP ' + r.status + ')';
        return;
      }
      const d = await r.json();
      /* 用全新的数组实例, 避免某些情况下 Vue 没识别到引用变更 */
      this.modalData.appBgList = (d.items || []).slice();
    } catch (e) {
      this.modalData.appearMsg = '⚠️ 素材库加载失败';
    }
  },

  _appBgListByKind(kind) {
    return (this.modalData.appBgList || []).filter(x => x.kind === kind);
  },
  appBgImages() { return this._appBgListByKind('image'); },
  appBgVideos() { return this._appBgListByKind('video'); },

  /* 渲染预览用的 URL (静态目录由 server.js 挂载: /backgrounds) */
  appBgPreviewUrl(filename) {
    if (!filename) return '';
    return API + '/backgrounds/' + encodeURIComponent(filename);
  },

  /* 文件名 -> 'image' | 'video' | 'other' (不依赖列表是否已加载) */
  bgKindOfFilename(filename) {
    if (!filename) return 'other';
    const m = String(filename).toLowerCase().match(/\.([a-z0-9]+)$/);
    const ext = m ? '.' + m[1] : '';
    if (['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg'].includes(ext)) return 'image';
    if (['.mp4','.mov','.webm','.m4v'].includes(ext)) return 'video';
    return 'other';
  },

  /* 在缩略图网格里点选: 等价于在 <select> 里改值 */
  pickAppBg(slotKey, filename) {
    if (!this.modalData.appDraft) return;
    this.modalData.appDraft[slotKey] = filename || '';
  },

  /* 直接在外观面板里上传一个背景图/视频, 上传完写入对应槽位
   * slotKey: 'bg_image' | 'bg_video' | 'login_bg_image' | 'login_bg_video'
   */
  async doAppBgUpload(ev, slotKey) {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    const fd = new FormData(); fd.append('bg', f);
    this.modalData.appUploading = slotKey;
    this.modalData.appearMsg = '⏳ 上传中…';
    try {
      const r = await fetch(API + '/api/upload-bg', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + store.token },
        body: fd
      });
      let d = null;
      try { d = await r.json(); } catch (e) { d = null; }
      if (r.ok && d && d.success && d.filename) {
        /* 先写选中值, 这样即便列表刷新失败, 用户也能看到自己刚上传的项被选上 */
        this.modalData.appDraft[slotKey] = d.filename;
        /* 乐观插入到本地 appBgList 顶部, UI 立刻可见 */
        const exists = (this.modalData.appBgList || []).some(x => x.filename === d.filename);
        if (!exists) {
          const item = {
            filename: d.filename,
            kind: d.kind || this.bgKindOfFilename(d.filename),
            size: d.size || (f.size || 0),
            mtime: d.mtime || new Date().toISOString(),
            used_by: []
          };
          this.modalData.appBgList = [item, ...(this.modalData.appBgList || [])];
        }
        this.modalData.appearMsg = '✅ 已上传, 记得点底部「保存并应用」';
        /* 后台再拉一次, 顺便修正 used_by 等字段 (即使失败也不影响显示) */
        this.loadAppBgList();
      } else {
        const msg = (d && d.message) || ('上传失败 (HTTP ' + r.status + ')');
        this.modalData.appearMsg = msg;
      }
    } catch (e) { this.modalData.appearMsg = '上传失败: ' + (e.message || e); }
    this.modalData.appUploading = '';
  },

  async doSaveAppearance() {
    const a = this.modalData.appDraft || {};
    const b = {
      login_title: a.login_title,
      chat_title:  a.chat_title,
      send_text:   a.send_text,
      send_color:  a.send_color,

      bg_type:        a.bg_type,
      bg_color:       a.bg_color,
      bg_image:       a.bg_image,
      bg_mode:        a.bg_mode,
      bg_video:       a.bg_video,
      bg_video_mode:  a.bg_video_mode,

      login_bg_type:        a.login_bg_type,
      login_bg_color1:      a.login_bg_color1,
      login_bg_color2:      a.login_bg_color2,
      login_bg_image:       a.login_bg_image,
      login_bg_mode:        a.login_bg_mode,
      login_bg_video:       a.login_bg_video,
      login_bg_video_mode:  a.login_bg_video_mode,

      parallax_enabled:  a.parallax_enabled ? '1' : '0',
      parallax_strength: String(a.parallax_strength || 30)
    };
    try {
      const r = await fetch(API + '/api/settings/appearance', {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(b)
      });
      const d = await r.json();
      this.modalData.appearMsg = d.success ? '✅ 已保存' : '失败';
    } catch (e) { this.modalData.appearMsg = '失败'; }
  },

  /* ====== 视差 / 陀螺仪姿态采集 ====== */
  _gyroInitState() {
    const supported = !!(window.Parallax && Parallax.isSupported());
    const needsPerm = !!(window.Parallax && Parallax.isIOSPermissionRequired());
    return {
      supported,
      needsPerm,
      permGranted: !needsPerm,        /* 非 iOS 默认已授权 */
      capturing: false,
      live: null,                     /* 实时姿态 {beta, gamma, alpha} */
      baselineLocal: null,            /* 本次刚采到的基线 */
      msg: supported
        ? (needsPerm ? '此设备需要授权 (iOS 13+), 请点击 "授权陀螺仪"' : '可以开始校准')
        : '⚠️ 当前设备/浏览器不支持 DeviceOrientation API'
    };
  },

  async doRequestGyroPerm() {
    if (!window.Parallax) return;
    const ok = await Parallax.requestPermission();
    const g = this.modalData.gyroState;
    g.permGranted = !!ok;
    g.msg = ok ? '✅ 已授权, 可以开始校准' : '❌ 授权被拒绝, 可以稍后重试';
  },

  async doStartGyroCapture() {
    if (!window.Parallax) return;
    const g = this.modalData.gyroState;
    if (!g.supported) return;
    if (!g.permGranted) { await this.doRequestGyroPerm(); if (!g.permGranted) return; }
    g.capturing = true; g.msg = '📡 采集中, 请保持设备水平 2 秒…';
    /* 一边校准一边把实时数据回写 UI */
    const stopLive = Parallax.startCapture(s => {
      g.live = { beta: s.beta, gamma: s.gamma, alpha: s.alpha };
    }, {});
    try {
      const baseline = await Parallax.calibrate(2000);
      g.baselineLocal = baseline;
      /* 写入草稿; 真正落库要等用户点保存 */
      this.modalData.appDraft.parallax_baseline_pending = JSON.stringify(baseline);
      g.msg = '✅ 校准完成 (β=' + baseline.beta.toFixed(2)
            + '°, γ=' + baseline.gamma.toFixed(2) + '°), 记得点保存';
    } catch (e) {
      g.msg = '❌ 采集失败: ' + (e.message || e);
    }
    g.capturing = false;
    stopLive();
  },

  /* 把刚采到的基线一起送到后端 (单独按钮, 也可以随保存一起) */
  async doSaveGyroBaseline() {
    const pending = this.modalData.appDraft && this.modalData.appDraft.parallax_baseline_pending;
    if (!pending) { this.modalData.gyroState.msg = '请先校准一次'; return; }
    try {
      const r = await fetch(API + '/api/settings/appearance', {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ parallax_baseline: pending })
      });
      const d = await r.json();
      this.modalData.gyroState.msg = d.success ? '✅ 基线已保存' : '保存失败';
    } catch (e) { this.modalData.gyroState.msg = '保存失败'; }
  },

  async doSaveAppearanceLegacy_REMOVED() { /* 占位, 防止旧调用报错 */ },


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

  /* ===== 用户导出 ===== */
  async doExportUsers() {
    try {
      const data = await exportUsers();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0, 10);
      a.href = URL.createObjectURL(blob);
      a.download = 'users_' + ts + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert('导出失败: ' + e.message);
    }
  },

  /* ===== 用户导入: 读取文件 + 预览 ===== */
  async doImportUsersFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;

    let data;
    try {
      data = JSON.parse(await f.text());
    } catch (err) {
      alert('文件格式错误，请选择有效的 JSON 文件');
      return;
    }

    const users = data.users;
    if (!Array.isArray(users) || !users.length) {
      alert('文件中没有找到用户数据');
      return;
    }

    let existingNames = new Set();
    try {
      const r = await fetch(API + '/api/users', { headers: authH() });
      if (r.ok) {
        const list = await r.json();
        existingNames = new Set(list.map(u => u.username));
      }
    } catch (err) {}

    const preview = users.map(u => ({
      username: u.username || '',
      nickname: u.nickname || '',
      created_at: u.created_at || '',
      password_hash: u.password_hash || '',
      exists: existingNames.has(u.username),
      checked: !existingNames.has(u.username)
    }));

    this.modalData.importPreview = preview;
    this.modalData.importMsg = '';
    this.currentModal = 'userImport';
  },

  doImportToggleAll(val) {
    (this.modalData.importPreview || []).forEach(u => { u.checked = val; });
  },

  async doConfirmImport() {
    const preview = this.modalData.importPreview || [];
    const selected = preview.filter(u => u.checked);
    if (!selected.length) {
      this.modalData.importMsg = '请至少勾选一个用户';
      return;
    }

    this.modalData.importMsg = '⏳ 导入中…';
    try {
      const payload = selected.map(u => ({
        username: u.username,
        password_hash: u.password_hash,
        nickname: u.nickname,
        created_at: u.created_at
      }));
      const res = await importUsers(payload);
      if (res.success) {
        let msg = '✅ 成功导入 ' + res.added.length + ' 人';
        if (res.skipped.length) {
          msg += '，跳过 ' + res.skipped.length + ' 人 ('
            + res.skipped.map(s => s.username).join(', ') + ')';
        }
        this.modalData.importMsg = msg;
        this.loadUsers();
      } else {
        this.modalData.importMsg = '❌ ' + (res.message || '导入失败');
      }
    } catch (e) {
      this.modalData.importMsg = '❌ 导入失败: ' + e.message;
    }
  },
};
