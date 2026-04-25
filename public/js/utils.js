/**
 * TeamChat 前端工具函数
 * HTML 转义、时间格式化、消息清理
 */
const API = '';

function esc(t) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(t));
  return d.innerHTML;
}

function escAttr(t) {
  return String(t).replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function authH(extra) {
  const h = { 'Authorization': 'Bearer ' + (store.token || '') };
  return Object.assign(h, extra || {});
}

function parseUTC(ts) {
  if (!ts) return new Date();
  if (ts.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(ts)) return new Date(ts);
  return new Date(ts.replace(' ', 'T') + 'Z');
}

function fmtTime(ts) {
  return parseUTC(ts).toLocaleString('zh-CN', {
    timeZone: store.timezone,
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function fmtSize(b) {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function avatarUrl(a) {
  return a ? API + '/avatars/' + encodeURIComponent(a) : '/images/default-avatar.svg';
}

/* ========== URL 自动识别 (v0.5.9 重写) ==========
 * 老版本两个 bug:
 *  1) 纯文本分支用 [^\s&lt;] 作字符类 — 实际被解析为
 *     "非空白/&/l/t/;", URL 在第一个 l 或 t 就被截断
 *     (例: https://github.com → https://gi)
 *  2) 末尾的句末标点 (中英文) 会被吞进链接
 *
 * 新方案: 两条分支统一用 DOM TreeWalker, 链接识别走 _linkifyTextNode
 * - URL 字符集: 排除空白 / 尖括号 / 引号 / 中文句末标点 / 全角空格
 *   (半角括号 () 仍允许在 URL 内, 用括号配对剥离尾部不平衡的 ")")
 * - 末尾标点剥离: 中英文逗号/句号/分号/冒号/感叹号/问号/省略号 + 引号
 */
const URL_AUTOLINK_RE = /https?:\/\/[^\s<>"'`，。；：！？（）【】《》「」『』、…\u3000]+/g;
const URL_TRAILING_PUNCT_RE = /[.,;:!?'"`，。；：！？、…]+$/;

function _stripTrailingPunct(url) {
  let trail = '';
  /* 1) 通用末尾句末标点 */
  const m = url.match(URL_TRAILING_PUNCT_RE);
  if (m) { trail = m[0]; url = url.slice(0, -trail.length); }
  /* 2) 不平衡的右括号/方括号 (例: "见 (https://x.com/foo)" 应剥离尾部 ")") */
  while (url.length) {
    const last = url[url.length - 1];
    if (last === ')') {
      const opens  = (url.match(/\(/g) || []).length;
      const closes = (url.match(/\)/g) || []).length;
      if (closes > opens) { trail = last + trail; url = url.slice(0, -1); continue; }
    } else if (last === ']') {
      const opens  = (url.match(/\[/g) || []).length;
      const closes = (url.match(/\]/g) || []).length;
      if (closes > opens) { trail = last + trail; url = url.slice(0, -1); continue; }
    }
    break;
  }
  return { url, trail };
}

function _linkifyTextNode(textNode) {
  const text = textNode.textContent;
  if (!/https?:\/\//.test(text)) return false;
  URL_AUTOLINK_RE.lastIndex = 0;
  const frag = document.createDocumentFragment();
  let li = 0, replaced = false, m;
  while ((m = URL_AUTOLINK_RE.exec(text)) !== null) {
    const start = m.index;
    const { url, trail } = _stripTrailingPunct(m[0]);
    if (!url) continue;
    if (start > li) frag.appendChild(document.createTextNode(text.slice(li, start)));
    const a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = url;
    frag.appendChild(a);
    if (trail) frag.appendChild(document.createTextNode(trail));
    li = start + m[0].length;
    replaced = true;
  }
  if (!replaced) return false;
  if (li < text.length) frag.appendChild(document.createTextNode(text.slice(li)));
  textNode.parentNode.replaceChild(frag, textNode);
  return true;
}

function sanitize(html) {
  if (!html) return '';
  const t = document.createElement('div');
  if (!/<[a-zA-Z]/.test(html)) {
    /* 纯文本: 安全塞进文本节点, 由 TreeWalker 统一识别 URL */
    t.appendChild(document.createTextNode(html));
  } else {
    /* 含 HTML: 按白名单清洗 */
    t.innerHTML = html;
    t.querySelectorAll('script,style,link,meta,iframe,object,embed').forEach(e => e.remove());
    const ok  = { B:1, STRONG:1, I:1, EM:1, U:1, S:1, STRIKE:1, SPAN:1, FONT:1, BR:1, A:1 };
    const okA = { color:1, href:1, target:1, rel:1 };
    (function w(n) {
      [...n.childNodes].forEach(c => {
        if (c.nodeType === 1) {
          if (!ok[c.tagName]) {
            while (c.firstChild) c.parentNode.insertBefore(c.firstChild, c);
            c.remove();
          } else {
            [...c.attributes].forEach(a => { if (!okA[a.name]) c.removeAttribute(a.name); });
            if (c.tagName === 'A') { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); }
            w(c);
          }
        }
      });
    })(t);
  }
  /* 在所有非 <a> 文本节点上做 URL 自动识别 */
  const tw = document.createTreeWalker(t, NodeFilter.SHOW_TEXT, null, false);
  const tn = [];
  while (tw.nextNode()) tn.push(tw.currentNode);
  tn.forEach(n => {
    if (n.parentNode && n.parentNode.tagName === 'A') return;
    _linkifyTextNode(n);
  });
  let result = t.innerHTML;
  /* Emoji: 把 shortcode 替换成 <img> */
  if (typeof EmojiRegistry !== 'undefined') {
    result = EmojiRegistry.replaceInHtml(result);
  }
  return result;
}