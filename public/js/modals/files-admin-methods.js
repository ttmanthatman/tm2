/**
 * TeamChat 管理员 - 附件 & 墙纸库 方法集
 * 混入到主 Vue 组件 methods
 *
 * 期望 modalData 上的字段:
 *   files            列表 (来自 /api/admin/uploads)
 *   filesTotalSize   占用总大小
 *   filesFilter      { type, q }
 *   filesSelected    Set of message id
 *   bgItems          列表 (来自 /api/admin/backgrounds)
 *   bgSlots          槽位定义
 *   bgCurrent        当前各槽位引用 {bg_image:'xxx',...}
 *   bgSelected       Set of filename
 *   bgMsg / filesMsg 提示信息
 *
 * 本文件相对仓库版本的改动:
 *   openBgLibrary() 在 currentModal 切换之前预先把所有相关键写进 modalData,
 *   让 Vue 响应式 proxy 登记这些 key. 否则模板首渲染时 bgItems 是未知键,
 *   后续 loadBgLibrary 写入时不会触发重渲染, 造成"库里看不到素材"的 bug.
 *   (对照 openAppearance() 里同款防御性写法.)
 */
const FilesAdminMethods = {

  /* ============== 附件管理 ============== */

  async openFileMgmt() {
    this.modalData.filesFilter = this.modalData.filesFilter || { type: '', q: '' };
    this.modalData.filesSelected = new Set();
    this.modalData.filesMsg = '';
    this.currentModal = 'fileMgmt';
    await this.loadFiles();
  },

  async loadFiles() {
    const f = this.modalData.filesFilter || {};
    const qs = new URLSearchParams();
    if (f.type) qs.set('type', f.type);
    if (f.q) qs.set('q', f.q);
    try {
      const r = await fetch(API + '/api/admin/uploads?' + qs.toString(), { headers: authH() });
      if (!r.ok) { this.modalData.filesMsg = '加载失败'; return; }
      const d = await r.json();
      this.modalData.files = d.items || [];
      this.modalData.filesTotalSize = d.total_size || 0;
      /* 选择集合里清掉已不存在的 id */
      const ids = new Set(this.modalData.files.map(x => x.id));
      const sel = this.modalData.filesSelected || new Set();
      [...sel].forEach(id => { if (!ids.has(id)) sel.delete(id); });
      this.modalData.filesSelected = new Set(sel); /* 触发响应 */
    } catch (e) { this.modalData.filesMsg = '加载失败'; }
  },

  toggleFileSel(id) {
    const sel = this.modalData.filesSelected || new Set();
    if (sel.has(id)) sel.delete(id); else sel.add(id);
    this.modalData.filesSelected = new Set(sel);
  },

  isFileSel(id) {
    return !!(this.modalData.filesSelected && this.modalData.filesSelected.has(id));
  },

  toggleFileSelAll() {
    const list = this.modalData.files || [];
    const sel = this.modalData.filesSelected || new Set();
    if (sel.size === list.length && list.length > 0) {
      this.modalData.filesSelected = new Set();
    } else {
      this.modalData.filesSelected = new Set(list.map(x => x.id));
    }
  },

  async doDeleteFiles() {
    const sel = this.modalData.filesSelected || new Set();
    if (!sel.size) { this.modalData.filesMsg = '请先选择文件'; return; }
    if (!confirm('确认删除选中的 ' + sel.size + ' 个文件? 同时会从聊天记录中移除,不可恢复。')) return;
    try {
      const r = await fetch(API + '/api/admin/uploads/delete', {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ids: [...sel] })
      });
      const d = await r.json();
      if (d.success) {
        this.modalData.filesMsg = '✅ 已删除 ' + d.db_deleted + ' 条记录,清理 ' + d.disk_removed + ' 个文件';
        this.modalData.filesSelected = new Set();
        await this.loadFiles();
      } else {
        this.modalData.filesMsg = d.message || '删除失败';
      }
    } catch (e) { this.modalData.filesMsg = '删除失败'; }
  },

  doDownloadFiles() {
    const sel = this.modalData.filesSelected || new Set();
    if (!sel.size) { this.modalData.filesMsg = '请先选择文件'; return; }
    if (sel.size === 1) {
      /* 单个: 直接下载原文件 */
      const f = (this.modalData.files || []).find(x => x.id === [...sel][0]);
      if (f) {
        const base = f.type === 'voice' ? API + '/voices/' : API + '/uploads/';
        const a = document.createElement('a');
        a.href = base + encodeURIComponent(f.file_path);
        a.download = f.file_name || f.file_path;
        document.body.appendChild(a); a.click(); a.remove();
      }
      return;
    }
    /* 多个: zip 打包 */
    const url = API + '/api/admin/uploads/download-zip?ids='
      + [...sel].join(',')
      + '&token=' + encodeURIComponent(store.token);
    const a = document.createElement('a');
    a.href = url; a.download = '';
    document.body.appendChild(a); a.click(); a.remove();
  },

  fileIcon(f) {
    if (f.type === 'image') return '🖼️';
    if (f.type === 'voice') return '🎤';
    const ext = (f.file_name || '').split('.').pop().toLowerCase();
    if (['mp4','mov','webm','m4v'].includes(ext)) return '🎬';
    if (['mp3','wav','m4a'].includes(ext)) return '🎵';
    if (['pdf'].includes(ext)) return '📕';
    if (['doc','docx'].includes(ext)) return '📘';
    if (['xls','xlsx','csv'].includes(ext)) return '📗';
    if (['ppt','pptx'].includes(ext)) return '📙';
    if (['zip','rar','7z'].includes(ext)) return '🗜️';
    return '📄';
  },

  /* ============== 墙纸 / 视频库 ============== */

  async openBgLibrary() {
    /* 关键: 必须在切换 currentModal 之前, 先把所有相关键写进 modalData,
     * 让 Vue 响应式 proxy 登记这些 key.
     * 否则模板首次渲染时 bgItems / bgSlots / bgCurrent 都是未知键,
     * 后续 loadBgLibrary 写入时 Vue 不触发重渲染 -> 永远显示"墙纸库为空".
     * (对照 openAppearance() 里的同款防御性写法.) */
    this.modalData.bgItems     = [];
    this.modalData.bgTotalSize = 0;
    this.modalData.bgSlots     = [];
    this.modalData.bgCurrent   = {};
    this.modalData.bgSelected  = new Set();
    this.modalData.bgMsg       = '';
    this.currentModal = 'bgLibrary';
    await this.loadBgLibrary();
  },

  async loadBgLibrary() {
    try {
      const r = await fetch(API + '/api/admin/backgrounds', { headers: authH() });
      if (!r.ok) { this.modalData.bgMsg = '加载失败'; return; }
      const d = await r.json();
      /* 用全新的数组/对象实例, 避免某些情况下 Vue 没识别到引用变更 */
      this.modalData.bgItems     = (d.items || []).slice();
      this.modalData.bgTotalSize = d.total_size || 0;
      this.modalData.bgSlots     = (d.slots || []).slice();
      this.modalData.bgCurrent   = Object.assign({}, d.current || {});
      const names = new Set((d.items || []).map(x => x.filename));
      const sel = this.modalData.bgSelected || new Set();
      [...sel].forEach(n => { if (!names.has(n)) sel.delete(n); });
      this.modalData.bgSelected = new Set(sel);
    } catch (e) { this.modalData.bgMsg = '加载失败'; }
  },

  toggleBgSel(name) {
    const sel = this.modalData.bgSelected || new Set();
    if (sel.has(name)) sel.delete(name); else sel.add(name);
    this.modalData.bgSelected = new Set(sel);
  },

  isBgSel(name) {
    return !!(this.modalData.bgSelected && this.modalData.bgSelected.has(name));
  },

  toggleBgSelAll() {
    const list = this.modalData.bgItems || [];
    const sel = this.modalData.bgSelected || new Set();
    if (sel.size === list.length && list.length > 0) {
      this.modalData.bgSelected = new Set();
    } else {
      this.modalData.bgSelected = new Set(list.map(x => x.filename));
    }
  },

  async doApplyBg(slot, filename) {
    try {
      const r = await fetch(API + '/api/admin/backgrounds/apply', {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ slot, filename })
      });
      const d = await r.json();
      if (d.success) {
        this.modalData.bgMsg = filename ? '✅ 已应用到「' + this.bgSlotLabel(slot) + '」' : '✅ 已清空「' + this.bgSlotLabel(slot) + '」';
        await this.loadBgLibrary();
      } else {
        this.modalData.bgMsg = d.message || '应用失败';
      }
    } catch (e) { this.modalData.bgMsg = '应用失败'; }
  },

  async doDeleteBg(force) {
    const sel = this.modalData.bgSelected || new Set();
    if (!sel.size) { this.modalData.bgMsg = '请先选择文件'; return; }
    const filenames = [...sel];
    if (!force && !confirm('确认删除选中的 ' + sel.size + ' 个文件?')) return;
    try {
      const r = await fetch(API + '/api/admin/backgrounds/delete', {
        method: 'POST',
        headers: authH({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ filenames, force: !!force })
      });
      const d = await r.json();
      if (d.success) {
        this.modalData.bgMsg = '✅ 已删除 ' + d.removed + ' 个'
          + (d.cleared_slots ? ',并清空了 ' + d.cleared_slots + ' 处引用' : '');
        this.modalData.bgSelected = new Set();
        await this.loadBgLibrary();
      } else if (d.in_use && d.in_use.length) {
        const lines = d.in_use.map(u => '  · ' + u.filename + '  →  ' + u.refs.join('、')).join('\n');
        if (confirm('以下文件正被使用:\n\n' + lines + '\n\n仍要强制删除?对应槽位会被清空。')) {
          await this.doDeleteBg(true);
        } else {
          this.modalData.bgMsg = '已取消';
        }
      } else {
        this.modalData.bgMsg = d.message || '删除失败';
      }
    } catch (e) { this.modalData.bgMsg = '删除失败'; }
  },

  bgSlotLabel(key) {
    const s = (this.modalData.bgSlots || []).find(s => s.key === key);
    return s ? s.label : key;
  },

  bgPreviewUrl(name) { return API + '/backgrounds/' + encodeURIComponent(name); }
};
