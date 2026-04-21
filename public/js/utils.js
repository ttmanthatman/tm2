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

function sanitize(html) {
  if (!html) return '';
  var result;
  if (!/<[a-zA-Z]/.test(html)) {
    const s = esc(html);
    result = s.replace(/(https?:\/\/[^\s&lt;]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  } else {
    const t = document.createElement('div');
    t.innerHTML = html;
    t.querySelectorAll('script,style,link,meta,iframe,object,embed').forEach(e => e.remove());
    const ok = { B:1, STRONG:1, I:1, EM:1, U:1, S:1, STRIKE:1, SPAN:1, FONT:1, BR:1, A:1 };
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
    const tw = document.createTreeWalker(t, NodeFilter.SHOW_TEXT, null, false);
    const tn = [];
    while (tw.nextNode()) tn.push(tw.currentNode);
    tn.forEach(n => {
      if (n.parentNode && n.parentNode.tagName === 'A') return;
      const re = /(https?:\/\/[^\s<]+)/g;
      if (re.test(n.textContent)) {
        const f = document.createDocumentFragment();
        let li = 0;
        n.textContent.replace(re, (m, _, o) => {
          if (o > li) f.appendChild(document.createTextNode(n.textContent.slice(li, o)));
          const a = document.createElement('a');
          a.href = m; a.target = '_blank'; a.rel = 'noopener'; a.textContent = m;
          f.appendChild(a);
          li = o + m.length;
        });
        if (li < n.textContent.length) f.appendChild(document.createTextNode(n.textContent.slice(li)));
        n.parentNode.replaceChild(f, n);
      }
    });
    result = t.innerHTML;
  }
  /* Emoji: 把 shortcode 替换成 <img> */
  if (typeof EmojiRegistry !== 'undefined') {
    result = EmojiRegistry.replaceInHtml(result);
  }
  return result;
}
