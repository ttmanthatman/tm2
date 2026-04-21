/**
 * TeamChat Emoji Registry — Yahoo Messenger 经典 GIF 版
 * 93 个 Yahoo Messenger 动画表情
 */

var EmojiRegistry = (function() {
  'use strict';

  var _map = {};
  var _categories = [];
  var _catSet = {};
  var _codePattern = null;

  var BASE_URL = '/emojis/yahoo/';

  function _invalidatePattern() { _codePattern = null; }

  function _buildPattern() {
    var codes = Object.keys(_map);
    if (!codes.length) { _codePattern = /(?!)/; return; }
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

  function _addCat(key, icon, label) {
    if (_catSet[key]) return;
    _catSet[key] = true;
    _categories.push({ key: key, icon: icon, label: label });
  }

  function _register(e) {
    _map[e.code] = { code: e.code, src: e.src, alt: e.alt || e.code, cat: e.cat || 'face' };
    _invalidatePattern();
  }

  function _init() {
    _addCat('face',   '😊', '表情');
    _addCat('action', '👋', '动作');
    _addCat('object', '🎈', '物品');

    var emojis = [
      /* ===== 表情 (face) ===== */
      { name: 'smile',       alt: '微笑',     cat: 'face' },
      { name: 'smiley',      alt: '笑脸',     cat: 'face' },
      { name: 'grin',        alt: '大笑',     cat: 'face' },
      { name: 'joy',         alt: '喜悦',     cat: 'face' },
      { name: 'lol',         alt: '大笑',     cat: 'face' },
      { name: 'rofl',        alt: '笑翻',     cat: 'face' },
      { name: 'blush',       alt: '害羞',     cat: 'face' },
      { name: 'giggle',      alt: '偷笑',     cat: 'face' },
      { name: 'wink',        alt: '眨眼',     cat: 'face' },
      { name: 'tongue',      alt: '吐舌',     cat: 'face' },
      { name: 'relaxed',     alt: '放松',     cat: 'face' },
      { name: 'relieved',    alt: '安心',     cat: 'face' },
      { name: 'smirk',       alt: '得意',     cat: 'face' },
      { name: 'sunglasses',  alt: '墨镜',     cat: 'face' },
      { name: 'glasses',     alt: '眼镜',     cat: 'face' },
      { name: 'innocent',    alt: '天使',     cat: 'face' },
      { name: 'kiss',        alt: '亲亲',     cat: 'face' },
      { name: 'hushed',      alt: '惊讶',     cat: 'face' },
      { name: 'open_mouth',  alt: '张嘴',     cat: 'face' },
      { name: 'flushed',     alt: '脸红',     cat: 'face' },
      { name: 'neutral',     alt: '无语',     cat: 'face' },
      { name: 'no_mouth',    alt: '沉默',     cat: 'face' },
      { name: 'confused',    alt: '困惑',     cat: 'face' },
      { name: 'confounded',  alt: '纠结',     cat: 'face' },
      { name: 'worried',     alt: '担忧',     cat: 'face' },
      { name: 'disappointed',alt: '失望',     cat: 'face' },
      { name: 'frowning',    alt: '皱眉',     cat: 'face' },
      { name: 'pensive',     alt: '沉思',     cat: 'face' },
      { name: 'perturbed',   alt: '烦躁',     cat: 'face' },
      { name: 'anguished',   alt: '痛苦',     cat: 'face' },
      { name: 'grimacing',   alt: '龇牙',     cat: 'face' },
      { name: 'cry',         alt: '哭泣',     cat: 'face' },
      { name: 'bawling',     alt: '大哭',     cat: 'face' },
      { name: 'angry',       alt: '生气',     cat: 'face' },
      { name: 'rage',        alt: '愤怒',     cat: 'face' },
      { name: 'triumph',     alt: '哼',       cat: 'face' },
      { name: 'unamused',    alt: '不高兴',   cat: 'face' },
      { name: 'weary',       alt: '疲惫',     cat: 'face' },
      { name: 'tired_face',  alt: '累了',     cat: 'face' },
      { name: 'fearful',     alt: '害怕',     cat: 'face' },
      { name: 'scream',      alt: '尖叫',     cat: 'face' },
      { name: 'dizzy',       alt: '头晕',     cat: 'face' },
      { name: 'sick',        alt: '生病',     cat: 'face' },
      { name: 'sleepy',      alt: '困了',     cat: 'face' },
      { name: 'sleeping',    alt: '睡觉',     cat: 'face' },
      { name: 'naughty',     alt: '调皮',     cat: 'face' },
      { name: 'mrgreen',     alt: '坏笑',     cat: 'face' },
      { name: 'joker',       alt: '小丑',     cat: 'face' },
      { name: 'pirate',      alt: '海盗',     cat: 'face' },
      { name: 'cowboy',      alt: '牛仔',     cat: 'face' },
      { name: 'liar',        alt: '说谎',     cat: 'face' },
      { name: 'skull',       alt: '骷髅',     cat: 'face' },

      /* ===== 动作 (action) ===== */
      { name: 'clap',            alt: '鼓掌',     cat: 'action' },
      { name: 'bow',             alt: '鞠躬',     cat: 'action' },
      { name: 'hug',             alt: '拥抱',     cat: 'action' },
      { name: 'prayer',          alt: '祈祷',     cat: 'action' },
      { name: 'punch',           alt: '拳头',     cat: 'action' },
      { name: 'peace',           alt: '和平',     cat: 'action' },
      { name: 'rock_on',         alt: '摇滚',     cat: 'action' },
      { name: 'hang_loose',      alt: '放松',     cat: 'action' },
      { name: 'plus_one',        alt: '赞',       cat: 'action' },
      { name: 'minus_one',       alt: '踩',       cat: 'action' },
      { name: 'one_finger',      alt: '一指',     cat: 'action' },
      { name: 'whistle',         alt: '吹口哨',   cat: 'action' },
      { name: 'ohstop',          alt: '别闹',     cat: 'action' },
      { name: 'bring_it',        alt: '来吧',     cat: 'action' },
      { name: 'get_outta_here',  alt: '滚开',     cat: 'action' },
      { name: 'not_listening',   alt: '不听',     cat: 'action' },
      { name: 'nuh_uh',          alt: '不行',     cat: 'action' },
      { name: 'i_dunno',         alt: '不知道',   cat: 'action' },
      { name: 'who_me',          alt: '我吗',     cat: 'action' },
      { name: 'how_interesting',  alt: '有趣',    cat: 'action' },
      { name: 'look_at_the_time', alt: '看时间',  cat: 'action' },
      { name: 'time_out',        alt: '暂停',     cat: 'action' },
      { name: 'loser',           alt: '失败者',   cat: 'action' },
      { name: 'transformer',     alt: '变形',     cat: 'action' },

      /* ===== 物品 (object) ===== */
      { name: 'heart',           alt: '爱心',     cat: 'object' },
      { name: 'heartbreak',      alt: '心碎',     cat: 'object' },
      { name: 'rose',            alt: '玫瑰',     cat: 'object' },
      { name: 'star',            alt: '星星',     cat: 'object' },
      { name: 'coffee',          alt: '咖啡',     cat: 'object' },
      { name: 'lightbulb',       alt: '灯泡',     cat: 'object' },
      { name: 'money',           alt: '钱',       cat: 'object' },
      { name: 'lucky',           alt: '幸运',     cat: 'object' },
      { name: 'murica',          alt: '美国',     cat: 'object' },
      { name: 'yin_yang',        alt: '阴阳',     cat: 'object' },
      { name: 'jack_o_lantern',  alt: '南瓜灯',   cat: 'object' },
      { name: 'bee',             alt: '蜜蜂',     cat: 'object' },
      { name: 'chicken',         alt: '小鸡',     cat: 'object' },
      { name: 'cow',             alt: '奶牛',     cat: 'object' },
      { name: 'dog',             alt: '小狗',     cat: 'object' },
      { name: 'monkey',          alt: '猴子',     cat: 'object' },
      { name: 'pig',             alt: '小猪',     cat: 'object' },
    ];

    emojis.forEach(function(e) {
      _register({
        code: ':' + e.name + ':',
        src: BASE_URL + e.name + '.gif',
        alt: e.alt,
        cat: e.cat
      });
    });
  }

  var api = {
    register: function(e) {
      if (!e || !e.code || !e.src) return;
      if (e.cat && !_catSet[e.cat]) _addCat(e.cat, e.code, e.cat);
      _register(e);
    },
    registerBatch: function(list) {
      if (!Array.isArray(list)) return;
      list.forEach(function(e) { api.register(e); });
    },
    addCategory: function(key, icon, label) { _addCat(key, icon, label || key); },
    get categories() { return _categories.slice(); },
    byCategory: function(catKey) {
      var result = [];
      Object.keys(_map).forEach(function(code) {
        if (_map[code].cat === catKey) result.push(_map[code]);
      });
      return result;
    },
    get: function(code) { return _map[code] || null; },
    allCodes: function() { return Object.keys(_map); },
    replaceInHtml: function(html) {
      if (!html || !Object.keys(_map).length) return html;
      var pat = _getPattern();
      /* 用 DOM 方式只替换文本节点,避免破坏 href 等属性 */
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      var walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, null, false);
      var textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(function(node) {
        if (!pat.test(node.textContent)) return;
        pat.lastIndex = 0;
        var frag = document.createDocumentFragment();
        var last = 0;
        node.textContent.replace(pat, function(match, offset) {
          if (offset > last) frag.appendChild(document.createTextNode(node.textContent.slice(last, offset)));
          var e = _map[match];
          if (e) {
            var img = document.createElement('img');
            img.className = 'tc-emoji';
            img.src = e.src;
            img.alt = e.alt;
            img.title = match + ' ' + e.alt;
            frag.appendChild(img);
          } else {
            frag.appendChild(document.createTextNode(match));
          }
          last = offset + match.length;
        });
        if (last < node.textContent.length) frag.appendChild(document.createTextNode(node.textContent.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
      return tmp.innerHTML;
    },
    get map() { return _map; }
  };

  _init();
  return api;
})();
