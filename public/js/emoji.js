/**
 * TeamChat Emoji Registry
 * ========================
 * 可扩展的 emoji 注册表。每个 emoji 由 shortcode → 元数据 (图片/Unicode/标签) 组成。
 *
 * 扩展方法:
 *   EmojiRegistry.register({ code:':xxx:', src:'/emojis/xxx.gif', alt:'xxx', cat:'自定义' })
 *   EmojiRegistry.registerBatch([ ... ])
 *   EmojiRegistry.addCategory('自定义', 'icon', [ ... ])
 *
 * 消息渲染:
 *   EmojiRegistry.replaceInHtml(text) — 把 :code: 替换成 <img>
 *
 * Picker 数据:
 *   EmojiRegistry.categories  — 分类列表 [{key,icon,label}]
 *   EmojiRegistry.byCategory(key)  — 某分类下所有 emoji
 *
 * 初始内容: Yahoo Messenger 经典表情 (使用内联 SVG data URI,
 * 后续可替换为 /emojis/*.gif 等自定义路径)
 */

var EmojiRegistry = (function() {
  'use strict';

  /* ---------- 内部存储 ---------- */
  var _map = {};          // code -> { code, src, alt, cat, unicode }
  var _categories = [];   // [{ key, icon, label }]
  var _catSet = {};       // key -> true (去重)
  var _codePattern = null; // 正则缓存, 每次 register 后失效

  /* ---------- 工具 ---------- */
  function _invalidatePattern() { _codePattern = null; }

  function _buildPattern() {
    var codes = Object.keys(_map);
    if (!codes.length) { _codePattern = /(?!)/; return; }
    // 按长度降序, 确保长 code 优先匹配
    codes.sort(function(a, b) { return b.length - a.length; });
    var escaped = codes.map(function(c) {
      return c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    _codePattern = new RegExp('(' + escaped.join('|') + ')', 'g');
  }

  function _getPattern() {
    if (!_codePattern) _buildPattern();
    return _codePattern;
  }

  /* ---------- Yahoo Messenger 经典 SVG ----------
   * 用极简 SVG 内联 data URI 来表示经典表情。
   * 每个 SVG 是一个 20x20 的小黄脸, 尽量还原 YM 的经典风格。
   * 后期只需把 src 换成 /emojis/smile.gif 即可替换为真实图片。
   */
  function _ymSvg(face) {
    // 基础黄脸模板
    var h = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20">'
      + '<circle cx="10" cy="10" r="9.5" fill="#FFD700" stroke="#C8A000" stroke-width="0.5"/>';
    h += face;
    h += '</svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(h);
  }

  // 眼睛通用片段
  var _eyeL = '<ellipse cx="7" cy="8" rx="1.2" ry="1.6" fill="#333"/>';
  var _eyeR = '<ellipse cx="13" cy="8" rx="1.2" ry="1.6" fill="#333"/>';
  var _eyes = _eyeL + _eyeR;

  var _ymEmojis = {
    /* ===== 笑脸 & 开心 ===== */
    ':)':    { face: _eyes + '<path d="M6 12.5 Q10 16 14 12.5" stroke="#333" stroke-width="0.8" fill="none"/>', alt: '微笑' },
    ':D':    { face: _eyes + '<path d="M5.5 12 Q10 17 14.5 12" stroke="#333" stroke-width="0.8" fill="#fff"/>', alt: '大笑' },
    ';)':    { face: _eyeR + '<path d="M5.5 7.5 L8.5 8.5" stroke="#333" stroke-width="1" stroke-linecap="round"/>' + '<path d="M6 12.5 Q10 15.5 14 12.5" stroke="#333" stroke-width="0.8" fill="none"/>', alt: '眨眼' },
    ':P':    { face: _eyes + '<path d="M7 13 Q10 15 13 13" stroke="#333" stroke-width="0.7" fill="none"/><ellipse cx="10" cy="14.5" rx="2" ry="1.5" fill="#E74C3C"/>', alt: '吐舌' },
    ':>':    { face: _eyes + '<path d="M6 12 Q10 16.5 14 12" stroke="#333" stroke-width="0.8" fill="none"/><circle cx="5.5" cy="12" r="1.5" fill="#FF9999" opacity="0.5"/><circle cx="14.5" cy="12" r="1.5" fill="#FF9999" opacity="0.5"/>', alt: '得意' },
    'B-)':  { face: '<rect x="4" y="6" width="12" height="4" rx="2" fill="#333" opacity="0.7"/><rect x="4.5" y="6.5" width="5" height="3" rx="1.5" fill="#555"/><rect x="10.5" y="6.5" width="5" height="3" rx="1.5" fill="#555"/>' + '<path d="M6 13 Q10 16 14 13" stroke="#333" stroke-width="0.8" fill="none"/>', alt: '墨镜' },
    '=))':  { face: _eyes + '<path d="M5 12 Q10 18 15 12" stroke="#333" stroke-width="0.8" fill="#fff"/>' + '<line x1="16" y1="10" x2="18" y2="8" stroke="#48C" stroke-width="0.6"/><line x1="16.5" y1="11" x2="18.5" y2="10" stroke="#48C" stroke-width="0.6"/>', alt: '笑哭' },

    /* ===== 悲伤 & 难过 ===== */
    ':(':    { face: _eyes + '<path d="M6 14.5 Q10 11 14 14.5" stroke="#333" stroke-width="0.8" fill="none"/>', alt: '难过' },
    ':\'(':  { face: _eyes + '<path d="M6 14 Q10 11 14 14" stroke="#333" stroke-width="0.8" fill="none"/><path d="M13.5 9.5 Q14 12 13 13.5" stroke="#48C" stroke-width="0.8" fill="none"/>', alt: '哭泣' },
    ':((':   { face: _eyes + '<path d="M6 15 Q10 10.5 14 15" stroke="#333" stroke-width="0.9" fill="none"/>', alt: '非常难过' },
    ':-S':  { face: _eyes + '<path d="M6 13 Q8 11 10 13 Q12 15 14 13" stroke="#333" stroke-width="0.8" fill="none"/>', alt: '困惑' },

    /* ===== 生气 & 吃惊 ===== */
    ':@':   { face: '<line x1="5" y1="6" x2="8" y2="7.5" stroke="#333" stroke-width="0.8"/><line x1="15" y1="6" x2="12" y2="7.5" stroke="#333" stroke-width="0.8"/>' + _eyes + '<path d="M7 13 L10 11 L13 13" stroke="#C0392B" stroke-width="1" fill="#C0392B"/>', alt: '生气' },
    ':O':   { face: _eyes + '<ellipse cx="10" cy="13.5" rx="2.5" ry="2" fill="#333"/>', alt: '吃惊' },
    'X(':   { face: '<line x1="5" y1="6" x2="9" y2="10" stroke="#333" stroke-width="1"/><line x1="9" y1="6" x2="5" y2="10" stroke="#333" stroke-width="1"/><line x1="11" y1="6" x2="15" y2="10" stroke="#333" stroke-width="1"/><line x1="15" y1="6" x2="11" y2="10" stroke="#333" stroke-width="1"/>' + '<path d="M6 14.5 Q10 11 14 14.5" stroke="#333" stroke-width="0.8" fill="none"/>', alt: '崩溃' },

    /* ===== 特殊表情 ===== */
    ':-*':  { face: _eyes + '<circle cx="10" cy="13" r="2" fill="#E74C3C"/>', alt: '亲亲' },
    ':x':   { face: _eyes + '<line x1="7" y1="12" x2="13" y2="12" stroke="#333" stroke-width="1.2" stroke-linecap="round"/>', alt: '闭嘴' },
    ':|':   { face: _eyes + '<line x1="7" y1="13" x2="13" y2="13" stroke="#333" stroke-width="0.8" stroke-linecap="round"/>', alt: '无语' },
    '/:)':  { face: _eyes + '<path d="M6 12.5 Q10 15 14 12.5" stroke="#333" stroke-width="0.7" fill="none"/><line x1="4" y1="5" x2="9" y2="7" stroke="#333" stroke-width="0.7"/><line x1="16" y1="5" x2="11" y2="7" stroke="#333" stroke-width="0.7"/>', alt: '尴尬' },
    'O:)':  { face: _eyes + '<path d="M6 12.5 Q10 16 14 12.5" stroke="#333" stroke-width="0.8" fill="none"/><ellipse cx="10" cy="2" rx="5" ry="1.5" fill="none" stroke="#FFD700" stroke-width="1.2"/>', alt: '天使' },
    '>:)':  { face: _eyes + '<path d="M6 12 Q10 16 14 12" stroke="#333" stroke-width="0.8" fill="none"/><line x1="4" y1="3" x2="8" y2="6" stroke="#C0392B" stroke-width="1"/><line x1="16" y1="3" x2="12" y2="6" stroke="#C0392B" stroke-width="1"/>', alt: '恶魔' },
    ':-?':  { face: _eyes + '<path d="M8 13 Q10 11 12 13 Q10 15 8 13" stroke="#333" stroke-width="0.7" fill="none"/>', alt: '思考' },
    '=;':   { face: _eyes + '<path d="M6 13 Q10 16 14 13" stroke="#333" stroke-width="0.7" fill="none"/><line x1="9" y1="4" x2="8" y2="0" stroke="#888" stroke-width="0.6"/><circle cx="8" cy="0" r="1" fill="#888" opacity="0.4"/>', alt: '谈话' },

    /* ===== 动作 ===== */
    ':))':  { face: _eyes + '<path d="M5 12 Q10 18 15 12" stroke="#333" stroke-width="0.8" fill="#fff"/>', alt: '大笑不止' },
    ';;)':  { face: _eyeR + '<path d="M5 7 Q6 9 8 8" stroke="#333" stroke-width="0.8" fill="none"/><path d="M5 8 Q6 10 8 9" stroke="#333" stroke-width="0.6" fill="none"/>' + '<path d="M6 13 Q10 16 14 13" stroke="#333" stroke-width="0.8" fill="none"/>', alt: '抛媚眼' },
    ':-h':  { face: _eyes + '<path d="M8 12 L12 12 L12 15 L8 15 Z" stroke="#333" stroke-width="0.6" fill="none"/><path d="M9 12 L9 15" stroke="#333" stroke-width="0.4"/>', alt: '挥手' },
    ':-c':  { face: _eyes + '<path d="M7 14 Q10 11 13 14" stroke="#333" stroke-width="0.8" fill="none"/><line x1="5" y1="3" x2="10" y2="1" stroke="#888" stroke-width="0.8"/>', alt: '打电话' },
    '[-O<': { face: _eyes + '<line x1="7" y1="13" x2="13" y2="13" stroke="#333" stroke-width="0.8"/><line x1="10" y1="13" x2="10" y2="17" stroke="#333" stroke-width="0.6"/><line x1="8" y1="16" x2="10" y2="17" stroke="#333" stroke-width="0.6"/><line x1="12" y1="16" x2="10" y2="17" stroke="#333" stroke-width="0.6"/>', alt: '祈祷' },

    /* ===== 物品 & 符号 ===== */
    '<3':   { face: '', alt: '爱心', customSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><path d="M10 17 Q3 12 3 7 Q3 3 7 3 Q10 3 10 6 Q10 3 13 3 Q17 3 17 7 Q17 12 10 17Z" fill="#E74C3C" stroke="#C0392B" stroke-width="0.5"/></svg>' },
    '(*)':  { face: '', alt: '星星', customSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><polygon points="10,1 12.5,7.5 19,8 14,12.5 15.5,19 10,15.5 4.5,19 6,12.5 1,8 7.5,7.5" fill="#FFD700" stroke="#C8A000" stroke-width="0.5"/></svg>' },
    '(}':   { face: '', alt: '拥抱', customSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="8" r="5" fill="#FFD700" stroke="#C8A000" stroke-width="0.5"/><ellipse cx="7" cy="7" rx="1" ry="1.3" fill="#333"/><ellipse cx="13" cy="7" rx="1" ry="1.3" fill="#333"/><path d="M7.5 10 Q10 13 12.5 10" stroke="#333" stroke-width="0.7" fill="none"/><path d="M3 10 Q1 14 5 16" stroke="#C8A000" stroke-width="1.2" fill="none"/><path d="M17 10 Q19 14 15 16" stroke="#C8A000" stroke-width="1.2" fill="none"/></svg>' },
    ':brokenheart:': { face: '', alt: '心碎', customSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><path d="M10 17 Q3 12 3 7 Q3 3 7 3 Q10 3 10 6 Q10 3 13 3 Q17 3 17 7 Q17 12 10 17Z" fill="#E74C3C" stroke="#C0392B" stroke-width="0.5"/><path d="M10 5 L8.5 9 L11.5 11 L10 17" stroke="#fff" stroke-width="1" fill="none"/></svg>' },

    /* ===== 经典 YM 扩展表情 ===== */
    ':sleep:':   { face: _eyes + '<path d="M7 13 Q10 15 13 13" stroke="#333" stroke-width="0.6" fill="none"/><text x="14" y="5" font-size="5" fill="#48C" font-weight="bold">Z</text><text x="16" y="3" font-size="4" fill="#48C" font-weight="bold">z</text>', alt: '睡觉' },
    ':coffee:':  { face: '', alt: '咖啡', customSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><rect x="4" y="8" width="10" height="9" rx="1" fill="#fff" stroke="#888" stroke-width="0.8"/><path d="M14 10 Q17 10 17 13 Q17 16 14 16" stroke="#888" stroke-width="0.8" fill="none"/><path d="M7 6 Q7 4 8 4" stroke="#888" stroke-width="0.6" fill="none"/><path d="M10 5 Q10 3 11 3" stroke="#888" stroke-width="0.6" fill="none"/><rect x="5" y="9" width="8" height="7" rx="0.5" fill="#8B4513" opacity="0.7"/></svg>' },
    ':music:':   { face: '', alt: '音乐', customSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><circle cx="6" cy="15" r="2.5" fill="#333"/><circle cx="14" cy="13" r="2.5" fill="#333"/><line x1="8.5" y1="15" x2="8.5" y2="4" stroke="#333" stroke-width="1"/><line x1="16.5" y1="13" x2="16.5" y2="2" stroke="#333" stroke-width="1"/><path d="M8.5 4 L16.5 2 L16.5 5 L8.5 7 Z" fill="#333"/></svg>' },
    ':thumb:':   { face: '', alt: '赞', customSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><path d="M5 9 L5 17 L8 17 L8 9 Z" fill="#FFD700" stroke="#C8A000" stroke-width="0.5"/><path d="M8 10 L8 9 Q8 5 11 4 L12 4 L11 8 L16 8 Q17 8 17 9 L16 14 Q16 17 13 17 L8 17" fill="#FFD700" stroke="#C8A000" stroke-width="0.5"/></svg>' },
    ':down:':    { face: '', alt: '踩', customSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><path d="M5 11 L5 3 L8 3 L8 11 Z" fill="#FFD700" stroke="#C8A000" stroke-width="0.5"/><path d="M8 10 L8 11 Q8 15 11 16 L12 16 L11 12 L16 12 Q17 12 17 11 L16 6 Q16 3 13 3 L8 3" fill="#FFD700" stroke="#C8A000" stroke-width="0.5"/></svg>' },
    ':flag:':    { face: '', alt: '旗帜', customSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><line x1="4" y1="2" x2="4" y2="18" stroke="#888" stroke-width="1"/><path d="M4 3 L16 3 L14 7 L16 11 L4 11 Z" fill="#E74C3C"/></svg>' },
    ':cake:':    { face: '', alt: '蛋糕', customSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><rect x="3" y="10" width="14" height="7" rx="2" fill="#F5CBA7" stroke="#C8A000" stroke-width="0.5"/><rect x="3" y="10" width="14" height="3" rx="1" fill="#E74C3C" opacity="0.6"/><rect x="9" y="5" width="2" height="5" fill="#FFD700"/><circle cx="10" cy="4" r="1.5" fill="#E74C3C"/><ellipse cx="10" cy="3" rx="0.5" ry="1" fill="#FF6"/></svg>' },
    ':clap:':    { face: '', alt: '鼓掌', customSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><path d="M6 8 Q6 5 8 5 L8 12" stroke="#C8A000" stroke-width="0.5" fill="#FFD700"/><path d="M14 8 Q14 5 12 5 L12 12" stroke="#C8A000" stroke-width="0.5" fill="#FFD700"/><path d="M8 12 Q10 14 12 12" stroke="#C8A000" stroke-width="0.5" fill="#FFD700"/><line x1="4" y1="5" x2="6" y2="7" stroke="#FF6" stroke-width="0.8"/><line x1="16" y1="5" x2="14" y2="7" stroke="#FF6" stroke-width="0.8"/><line x1="10" y1="2" x2="10" y2="4" stroke="#FF6" stroke-width="0.8"/></svg>' },
  };


  /* ---------- 初始化 ---------- */
  function _init() {
    // 分类
    _addCat('classic', '😀', '经典');
    _addCat('action', '👋', '动作');
    _addCat('symbol', '❤️', '符号');

    // 分类映射
    var catMap = {
      ':)': 'classic', ':D': 'classic', ';)': 'classic', ':P': 'classic',
      ':>': 'classic', 'B-)': 'classic', '=))': 'classic',
      ':(': 'classic', ':\'(': 'classic', ':((':  'classic', ':-S': 'classic',
      ':@': 'classic', ':O': 'classic', 'X(': 'classic',
      ':-*': 'classic', ':x': 'classic', ':|': 'classic',
      '/:)': 'classic', 'O:)': 'classic', '>:)': 'classic', ':-?': 'classic',

      '=;': 'action', ':))': 'action', ';;)': 'action', ':-h': 'action',
      ':-c': 'action', '[-O<': 'action', ':sleep:': 'action', ':clap:': 'action',

      '<3': 'symbol', '(*)': 'symbol', '(}': 'symbol', ':brokenheart:': 'symbol',
      ':coffee:': 'symbol', ':music:': 'symbol', ':thumb:': 'symbol',
      ':down:': 'symbol', ':flag:': 'symbol', ':cake:': 'symbol'
    };

    Object.keys(_ymEmojis).forEach(function(code) {
      var e = _ymEmojis[code];
      var src;
      if (e.customSvg) {
        src = 'data:image/svg+xml,' + encodeURIComponent(e.customSvg);
      } else {
        src = _ymSvg(e.face);
      }
      _register({ code: code, src: src, alt: e.alt, cat: catMap[code] || 'classic' });
    });
  }

  function _addCat(key, icon, label) {
    if (_catSet[key]) return;
    _catSet[key] = true;
    _categories.push({ key: key, icon: icon, label: label });
  }

  function _register(e) {
    _map[e.code] = { code: e.code, src: e.src, alt: e.alt || e.code, cat: e.cat || 'custom' };
    _invalidatePattern();
  }

  /* ---------- Public API ---------- */

  var api = {
    /**
     * 注册单个 emoji
     * @param {{ code:string, src:string, alt?:string, cat?:string }} e
     */
    register: function(e) {
      if (!e || !e.code || !e.src) return;
      if (e.cat && !_catSet[e.cat]) _addCat(e.cat, e.code, e.cat);
      _register(e);
    },

    /**
     * 批量注册
     * @param {Array} list
     */
    registerBatch: function(list) {
      if (!Array.isArray(list)) return;
      list.forEach(function(e) { api.register(e); });
    },

    /**
     * 添加分类 (不含 emoji, 配合 register 使用)
     */
    addCategory: function(key, icon, label) {
      _addCat(key, icon, label || key);
    },

    /**
     * 获取所有分类
     */
    get categories() { return _categories.slice(); },

    /**
     * 获取某分类下的所有 emoji
     * @param {string} catKey
     * @returns {Array<{ code, src, alt, cat }>}
     */
    byCategory: function(catKey) {
      var result = [];
      Object.keys(_map).forEach(function(code) {
        if (_map[code].cat === catKey) result.push(_map[code]);
      });
      return result;
    },

    /**
     * 通过 code 获取 emoji
     */
    get: function(code) { return _map[code] || null; },

    /**
     * 获取所有 emoji 的 code 列表
     */
    allCodes: function() { return Object.keys(_map); },

    /**
     * 把文本中的 emoji shortcode 替换为 <img> 标签
     * 用于消息渲染
     * @param {string} html — 已经 sanitize 过的 HTML
     * @returns {string}
     */
    replaceInHtml: function(html) {
      if (!html || !Object.keys(_map).length) return html;
      var pat = _getPattern();
      return html.replace(pat, function(match) {
        var e = _map[match];
        if (!e) return match;
        return '<img class="tc-emoji" src="' + e.src + '" alt="' + e.alt + '" title="' + match + ' ' + e.alt + '">';
      });
    },

    /**
     * 获取内部 map (只读用途, 勿直接修改)
     */
    get map() { return _map; }
  };

  // 执行初始化
  _init();

  return api;
})();
