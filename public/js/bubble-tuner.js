/* =============================================================
 * TeamChat — Glass Bubble Tuner
 * 玻璃气泡模式的实时调节面板
 * =============================================================
 * 作用:
 *   1) 启用/关闭 body.bubble-glass (玻璃气泡模式总开关)
 *   2) 实时把 32+ 参数写入 :root 上的 CSS 变量 (驱动 bubble-glass.css)
 *   3) 动态给每个 .msg-bubble 挂 SVG 尾部 (CSS 变量无法表达 SVG fill)
 *   4) localStorage 持久化, 刷新不丢
 *   5) 导入/导出 JSON, 导出 CSS, 重置
 *
 * 依赖: bubble-glass.css (必须先加载)
 * API: window.TmBubble = { enable, disable, toggle, reset, open, close, probe, params }
 * ============================================================= */
(function () {
  'use strict';

  /* ========== 配置 ========== */
  const STORAGE_KEY = 'tm_bubble_glass_v1';
  const BODY_CLASS = 'bubble-glass';

  /* ========== 默认参数 (必须和 bubble-glass.css :root 保持同步) ========== */
  const DEFAULTS_SIDE = {
    // 形状
    bb_radius: 20, bb_tail_r: 6, bb_px: 18, bb_py: 12,
    bb_persp: 800, bb_rotx: 1,
    // 填充
    bb_bg_alpha: 40, bb_border_alpha: 70, bb_border_w: 15,
    bb_blur: 12, bb_sat: 140, bb_show_tail: true,
    // 顶部高光
    hl_top: 3, hl_left: 12, hl_right: 8, hl_height: 40,
    hl_opacity_top: 50, hl_opacity_mid: 12, hl_stop: 55,
    hl_rx: 18, hl_ry: 14,
    // 底部散焦光
    ca_bottom: 4, ca_height: 30, ca_opacity: 20,
    // 外阴影
    sh_y: 6, sh_blur: 20, sh_alpha: 30,
    // 内发光
    ig_top_alpha: 55, ig_top_y: 2, ig_top_blur: 4,
    ig_bot_alpha: 15, ig_bot_y: -3,
    ig_glow: 20, ig_glow_alpha: 40,
  };
  const DEFAULTS_RIGHT = Object.assign({}, DEFAULTS_SIDE);
  const DEFAULTS_LEFT = Object.assign({}, DEFAULTS_SIDE, { hl_left: 8, hl_right: 20 });

  const DEFAULTS_GLOBAL = {
    cl_r_main: '#aa96e6', cl_r_border: '#beaaf0', cl_r_text: '#3a2a5a',
    cl_l_main: '#a0beff', cl_l_border: '#b4d2ff', cl_l_text: '#1e2a5a',
    gl_fs: 15, gl_lh: 16,
    enabled: false,
  };

  const PARAM_IDS = Object.keys(DEFAULTS_SIDE);
  const GLOBAL_COLOR_IDS = ['cl_r_main', 'cl_r_border', 'cl_r_text', 'cl_l_main', 'cl_l_border', 'cl_l_text'];
  const GLOBAL_NUM_IDS = ['gl_fs', 'gl_lh'];

  /* ========== 状态 ========== */
  let params = {
    right: clone(DEFAULTS_RIGHT),
    left: clone(DEFAULTS_LEFT),
  };
  let globalParams = clone(DEFAULTS_GLOBAL);
  let currentSide = 'right';
  let panelShadow = null;
  let panelOpen = false;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ========== 持久化 ========== */
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.right) params.right = Object.assign(clone(DEFAULTS_RIGHT), saved.right);
      if (saved.left) params.left = Object.assign(clone(DEFAULTS_LEFT), saved.left);
      if (saved.global) globalParams = Object.assign(clone(DEFAULTS_GLOBAL), saved.global);
    } catch (e) { console.warn('[TmBubble] load state failed:', e); }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        right: params.right, left: params.left, global: globalParams,
      }));
    } catch (e) { /* ignore quota */ }
  }

  /* ========== 颜色工具 ========== */
  function hexToRgb(hex) {
    const h = String(hex || '').replace('#', '');
    if (h.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
      r: parseInt(h.slice(0, 2), 16) || 0,
      g: parseInt(h.slice(2, 4), 16) || 0,
      b: parseInt(h.slice(4, 6), 16) || 0,
    };
  }

  /* ========== 把参数写入 :root CSS 变量 ========== */
  function applyVars() {
    const root = document.documentElement.style;
    const gp = globalParams;

    root.setProperty('--gb-fs', gp.gl_fs + 'px');
    root.setProperty('--gb-lh', (gp.gl_lh / 10).toFixed(1));

    ['right', 'left'].forEach(side => {
      const p = params[side];
      const pfx = side === 'right' ? '--gb-r-' : '--gb-l-';
      const isRight = side === 'right';
      const mainColor = isRight ? gp.cl_r_main : gp.cl_l_main;
      const borderColor = isRight ? gp.cl_r_border : gp.cl_l_border;
      const textColor = isRight ? gp.cl_r_text : gp.cl_l_text;
      const mc = hexToRgb(mainColor);
      const bc = hexToRgb(borderColor);

      root.setProperty(pfx + 'radius', p.bb_radius + 'px');
      root.setProperty(pfx + 'tail-r', p.bb_tail_r + 'px');
      root.setProperty(pfx + 'px', p.bb_px + 'px');
      root.setProperty(pfx + 'py', p.bb_py + 'px');
      root.setProperty(pfx + 'persp', p.bb_persp + 'px');
      root.setProperty(pfx + 'rotx', p.bb_rotx + 'deg');
      root.setProperty(pfx + 'bg-alpha', (p.bb_bg_alpha / 100).toFixed(2));
      root.setProperty(pfx + 'border-alpha', (p.bb_border_alpha / 100).toFixed(2));
      root.setProperty(pfx + 'border-w', (p.bb_border_w / 10).toFixed(1) + 'px');
      root.setProperty(pfx + 'blur', p.bb_blur + 'px');
      root.setProperty(pfx + 'sat', (p.bb_sat / 100).toFixed(2));
      root.setProperty(pfx + 'show-tail', p.bb_show_tail ? '1' : '0');
      root.setProperty(pfx + 'cr', mc.r);
      root.setProperty(pfx + 'cg', mc.g);
      root.setProperty(pfx + 'cb', mc.b);
      root.setProperty(pfx + 'br', bc.r);
      root.setProperty(pfx + 'bg', bc.g);
      root.setProperty(pfx + 'bb', bc.b);
      root.setProperty(pfx + 'text', textColor);
      root.setProperty(pfx + 'hl-top', p.hl_top + 'px');
      root.setProperty(pfx + 'hl-left', isRight ? (p.hl_left + '%') : (p.hl_left + 'px'));
      root.setProperty(pfx + 'hl-right', isRight ? (p.hl_right + 'px') : (p.hl_right + '%'));
      root.setProperty(pfx + 'hl-height', p.hl_height + '%');
      root.setProperty(pfx + 'hl-op-top', (p.hl_opacity_top / 100).toFixed(2));
      root.setProperty(pfx + 'hl-op-mid', (p.hl_opacity_mid / 100).toFixed(2));
      root.setProperty(pfx + 'hl-stop', p.hl_stop + '%');
      root.setProperty(pfx + 'hl-rx', p.hl_rx + 'px');
      root.setProperty(pfx + 'hl-ry', p.hl_ry + 'px');
      root.setProperty(pfx + 'ca-bottom', p.ca_bottom + 'px');
      root.setProperty(pfx + 'ca-height', p.ca_height + '%');
      root.setProperty(pfx + 'ca-op', (p.ca_opacity / 100).toFixed(2));
      root.setProperty(pfx + 'sh-y', p.sh_y + 'px');
      root.setProperty(pfx + 'sh-blur', p.sh_blur + 'px');
      root.setProperty(pfx + 'sh-alpha', (p.sh_alpha / 100).toFixed(2));
      root.setProperty(pfx + 'ig-top-alpha', (p.ig_top_alpha / 100).toFixed(2));
      root.setProperty(pfx + 'ig-top-y', p.ig_top_y + 'px');
      root.setProperty(pfx + 'ig-top-blur', p.ig_top_blur + 'px');
      root.setProperty(pfx + 'ig-bot-alpha', (p.ig_bot_alpha / 100).toFixed(2));
      root.setProperty(pfx + 'ig-bot-y', p.ig_bot_y + 'px');
      root.setProperty(pfx + 'ig-glow', p.ig_glow + 'px');
      root.setProperty(pfx + 'ig-glow-alpha', (p.ig_glow_alpha / 100).toFixed(2));
    });
  }

  /* ========== SVG 尾部 ========== */
  function renderTails() {
    if (!document.body.classList.contains(BODY_CLASS)) {
      document.querySelectorAll('.tm-glass-tail').forEach(t => t.remove());
      return;
    }
    ['my', 'other'].forEach(side => {
      const isRight = side === 'my';
      const p = isRight ? params.right : params.left;
      const gp = globalParams;
      const mainColor = isRight ? gp.cl_r_main : gp.cl_l_main;
      const borderColor = isRight ? gp.cl_r_border : gp.cl_l_border;
      const mc = hexToRgb(mainColor);
      const bc = hexToRgb(borderColor);
      const bgA = (p.bb_bg_alpha / 100).toFixed(2);
      const bdA = (p.bb_border_alpha / 100).toFixed(2);
      const bw = (p.bb_border_w / 10).toFixed(1);
      const fill = `rgba(${mc.r},${mc.g},${mc.b},${bgA})`;
      const stroke = `rgba(${bc.r},${bc.g},${bc.b},${bdA})`;
      const d = isRight
        ? 'M0 0 C0 0 2 12 14 14 L0 14 Z'
        : 'M14 0 C14 0 12 12 0 14 L14 14 Z';

      document.querySelectorAll(`.msg.${side} .msg-bubble`).forEach(bubble => {
        let tail = bubble.querySelector(':scope > .tm-glass-tail');
        if (!p.bb_show_tail) {
          if (tail) tail.remove();
          return;
        }
        if (!tail) {
          tail = document.createElement('div');
          tail.className = 'tm-glass-tail';
          bubble.appendChild(tail);
        }
        tail.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${bw}" stroke-linejoin="round"/></svg>`;
      });
    });
  }

  /* ========== 新消息监听 ========== */
  let mo = null;
  let pendingRaf = 0;
  function scheduleRender() {
    if (pendingRaf) return;
    pendingRaf = requestAnimationFrame(() => {
      pendingRaf = 0;
      renderTails();
    });
  }
  function startObserver() {
    if (mo) mo.disconnect();
    mo = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.addedNodes && m.addedNodes.length) {
          for (const n of m.addedNodes) {
            if (n.nodeType === 1 && (n.classList?.contains('msg') || n.querySelector?.('.msg-bubble'))) {
              scheduleRender();
              return;
            }
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ========== 启用 / 关闭 玻璃模式 ========== */
  function enable() {
    document.body.classList.add(BODY_CLASS);
    globalParams.enabled = true;
    applyVars();
    scheduleRender();
    saveState();
    updateEnableSwitchUI();
  }
  function disable() {
    document.body.classList.remove(BODY_CLASS);
    globalParams.enabled = false;
    renderTails();
    saveState();
    updateEnableSwitchUI();
  }
  function toggle() { globalParams.enabled ? disable() : enable(); }

  /* ========== 调节面板 (Shadow DOM) ========== */
  const PANEL_CSS = `
:host {
  --ui-bg: #1a1625;
  --ui-surface: #231e30;
  --ui-surface2: #2c2640;
  --ui-border: #3a3350;
  --ui-text: #c8c0da;
  --ui-text-dim: #8880a0;
  --ui-accent: #a08ce0;
  --ui-accent2: #7c6cb8;
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: var(--ui-text);
}
* { box-sizing: border-box; margin: 0; padding: 0; }

.trigger {
  position: fixed;
  bottom: 96px; right: 16px;
  width: 48px; height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a08ce0, #7c6cb8);
  color: #fff; border: none; cursor: pointer;
  font-size: 22px;
  box-shadow: 0 6px 20px rgba(124,108,184,0.45), inset 0 1px 2px rgba(255,255,255,0.3);
  z-index: 9998;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex; align-items: center; justify-content: center;
}
.trigger:hover { transform: scale(1.08); box-shadow: 0 8px 28px rgba(124,108,184,0.6); }
.trigger:active { transform: scale(0.95); }

.backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.3);
  z-index: 9998; opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}
.backdrop.show { opacity: 1; pointer-events: auto; }

.panel {
  position: fixed;
  top: 0; right: 0;
  width: 420px; max-width: 100vw; height: 100vh;
  background: var(--ui-surface);
  border-left: 1px solid var(--ui-border);
  box-shadow: -12px 0 40px rgba(0,0,0,0.5);
  display: flex; flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
  z-index: 9999;
}
.panel.open { transform: translateX(0); }

@media (max-width: 600px) {
  .panel {
    width: 100%; height: 72vh; top: auto; bottom: 0;
    transform: translateY(100%);
    border-left: none; border-top: 1px solid var(--ui-border);
    border-radius: 16px 16px 0 0;
  }
  .panel.open { transform: translateY(0); }
  .trigger { bottom: 80px; }
}

.header {
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--ui-border);
  flex-shrink: 0;
}
.header-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.title { font-size: 15px; font-weight: 600; color: #e8e0f4; }
.close {
  width: 28px; height: 28px; border-radius: 50%;
  border: none; background: var(--ui-surface2); color: var(--ui-text);
  cursor: pointer; font-size: 15px;
  display: flex; align-items: center; justify-content: center;
}
.close:hover { background: var(--ui-border); }

.enable-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  background: var(--ui-surface2);
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 13px;
}
.switch {
  position: relative; width: 38px; height: 22px;
  background: var(--ui-border); border-radius: 11px;
  cursor: pointer; transition: background 0.2s;
  flex-shrink: 0;
}
.switch::after {
  content: ''; position: absolute;
  width: 18px; height: 18px; border-radius: 50%;
  background: #fff; top: 2px; left: 2px;
  transition: left 0.2s;
}
.switch.on { background: var(--ui-accent); }
.switch.on::after { left: 18px; }

.side-toggle { display: flex; gap: 4px; margin-bottom: 10px; }
.side-btn {
  padding: 5px 14px; border-radius: 6px;
  border: 1px solid var(--ui-border);
  background: transparent; color: var(--ui-text-dim);
  font-family: inherit; font-size: 12px; cursor: pointer;
}
.side-btn.active {
  background: var(--ui-accent2); color: #fff; border-color: var(--ui-accent2);
}

.tab-row { display: flex; gap: 4px; flex-wrap: wrap; }
.tab-btn {
  padding: 5px 12px; border-radius: 8px;
  border: 1px solid transparent;
  background: transparent; color: var(--ui-text-dim);
  font-family: inherit; font-size: 12px; cursor: pointer;
}
.tab-btn.active {
  background: var(--ui-surface2); color: var(--ui-accent);
  border-color: var(--ui-border);
}

.body {
  flex: 1; overflow-y: auto;
  padding: 16px 20px 20px;
}
.body::-webkit-scrollbar { width: 6px; }
.body::-webkit-scrollbar-thumb { background: var(--ui-border); border-radius: 3px; }

.tab-content { display: none; flex-direction: column; gap: 18px; }
.tab-content.active { display: flex; }

.group-title {
  font-size: 11px; font-weight: 600;
  color: var(--ui-accent);
  text-transform: uppercase; letter-spacing: 1.5px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--ui-border);
  font-family: 'Menlo', 'Monaco', monospace;
}

.ctrl-group { display: flex; flex-direction: column; gap: 12px; }
.ctrl-row { display: flex; flex-direction: column; gap: 4px; }
.ctrl-label {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px; color: var(--ui-text-dim);
}
.val {
  font-family: 'Menlo', 'Monaco', monospace;
  font-size: 10px; color: var(--ui-accent);
  background: var(--ui-surface2);
  padding: 1px 6px; border-radius: 4px;
  min-width: 42px; text-align: center;
}

input[type="range"] {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 4px;
  border-radius: 2px;
  background: var(--ui-surface2);
  outline: none; cursor: pointer;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--ui-accent);
  cursor: pointer; border: none;
  box-shadow: 0 0 8px rgba(160,140,224,0.4);
}
input[type="range"]::-moz-range-thumb {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--ui-accent); cursor: pointer; border: none;
}

input[type="color"] {
  -webkit-appearance: none; appearance: none;
  width: 32px; height: 24px;
  border: 1px solid var(--ui-border);
  border-radius: 4px; background: transparent;
  cursor: pointer; padding: 0;
}
input[type="color"]::-webkit-color-swatch-wrapper { padding: 2px; }
input[type="color"]::-webkit-color-swatch { border-radius: 2px; border: none; }

input[type="checkbox"] { accent-color: var(--ui-accent); cursor: pointer; width: 16px; height: 16px; }

.color-row {
  display: flex; align-items: center; gap: 10px;
  font-size: 12px; color: var(--ui-text-dim);
}
.color-row label { flex: 1; }

.check-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; color: var(--ui-text-dim);
  padding: 4px 0;
}

.footer {
  padding: 12px 20px;
  border-top: 1px solid var(--ui-border);
  display: flex; gap: 6px; flex-wrap: wrap;
  background: var(--ui-surface);
  flex-shrink: 0;
}
.foot-btn {
  flex: 1 1 calc(50% - 3px);
  padding: 9px; border-radius: 8px; border: none;
  font-family: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all 0.2s;
}
.foot-btn.primary { background: var(--ui-accent); color: #fff; }
.foot-btn.primary:hover { background: #b09af0; }
.foot-btn.secondary { background: var(--ui-surface2); color: var(--ui-text); border: 1px solid var(--ui-border); }
.foot-btn.secondary:hover { border-color: var(--ui-accent2); }
.foot-btn.danger { background: transparent; color: #e48aa0; border: 1px solid var(--ui-border); }
.foot-btn.danger:hover { border-color: #e48aa0; }

.toast {
  position: fixed;
  bottom: 24px; left: 50%;
  transform: translateX(-50%) translateY(80px);
  background: #2e2848; color: #e0d8f0;
  padding: 10px 20px; border-radius: 10px;
  font-size: 13px;
  border: 1px solid var(--ui-border);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  transition: transform 0.3s ease;
  z-index: 10000; pointer-events: none;
}
.toast.show { transform: translateX(-50%) translateY(0); }

.hint {
  font-size: 11px; color: var(--ui-text-dim);
  line-height: 1.5;
  padding: 8px 10px;
  background: var(--ui-surface2);
  border-radius: 6px;
  border-left: 2px solid var(--ui-accent);
}
.hint code { color: var(--ui-accent); font-family: 'Menlo', monospace; }
`;

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    for (const c of kids) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function slider(id, label, min, max, step, fmt) {
    return el('div', { class: 'ctrl-row' },
      el('div', { class: 'ctrl-label' },
        el('span', null, label),
        el('span', { class: 'val', 'data-val': id }, '')
      ),
      el('input', { type: 'range', id, min, max, step, 'data-fmt': fmt || '' })
    );
  }

  function tabHighlight() {
    return el('div', { class: 'tab-content active', 'data-tab': 'highlight' },
      el('div', { class: 'group-title' }, '顶部主高光 ::before'),
      el('div', { class: 'ctrl-group' },
        slider('hl_top', 'top 位置', 0, 20, 1, 'px'),
        slider('hl_left', 'left 偏移', 0, 40, 1, 'hl_lr'),
        slider('hl_right', 'right 偏移', 0, 40, 1, 'hl_lr'),
        slider('hl_height', '高度', 10, 80, 1, 'pct'),
        slider('hl_opacity_top', '顶部亮度', 0, 100, 1, 'alpha'),
        slider('hl_opacity_mid', '中部亮度', 0, 60, 1, 'alpha'),
        slider('hl_stop', '渐变截止点', 20, 90, 1, 'pct'),
        slider('hl_rx', '圆角 x', 0, 50, 1, 'px'),
        slider('hl_ry', '圆角 y', 0, 50, 1, 'px'),
      ),
      el('div', { class: 'group-title' }, '底部散焦光 ::after'),
      el('div', { class: 'ctrl-group' },
        slider('ca_bottom', 'bottom 位置', 0, 20, 1, 'px'),
        slider('ca_height', '高度', 5, 60, 1, 'pct'),
        slider('ca_opacity', '亮度', 0, 60, 1, 'alpha'),
      ),
    );
  }
  function tabBubble() {
    return el('div', { class: 'tab-content', 'data-tab': 'bubble' },
      el('div', { class: 'group-title' }, '气泡形状'),
      el('div', { class: 'ctrl-group' },
        slider('bb_radius', '圆角半径', 4, 40, 1, 'px'),
        slider('bb_tail_r', '尾部圆角', 0, 20, 1, 'px'),
        slider('bb_px', '水平内边距', 8, 32, 1, 'px'),
        slider('bb_py', '垂直内边距', 6, 28, 1, 'px'),
        slider('bb_persp', '3D 透视', 200, 2000, 50, 'px'),
        slider('bb_rotx', 'rotateX', 0, 8, 0.5, 'deg'),
      ),
      el('div', { class: 'group-title' }, '气泡填充'),
      el('div', { class: 'ctrl-group' },
        slider('bb_bg_alpha', '背景不透明度', 10, 80, 1, 'alpha'),
        slider('bb_border_alpha', '边框不透明度', 10, 100, 1, 'alpha'),
        slider('bb_border_w', '边框粗细', 0, 40, 1, 'bw'),
        slider('bb_blur', '模糊强度 (backdrop)', 0, 30, 1, 'px'),
        slider('bb_sat', '饱和度', 80, 200, 5, 'sat'),
      ),
      el('div', { class: 'group-title' }, '尾部三角'),
      el('div', { class: 'ctrl-group' },
        el('label', { class: 'check-row' },
          el('span', null, '显示尾部'),
          el('input', { type: 'checkbox', id: 'bb_show_tail' }),
        ),
      ),
    );
  }
  function tabShadow() {
    return el('div', { class: 'tab-content', 'data-tab': 'shadow' },
      el('div', { class: 'group-title' }, '外部阴影'),
      el('div', { class: 'ctrl-group' },
        slider('sh_y', '主阴影 Y 偏移', 0, 20, 1, 'px'),
        slider('sh_blur', '主阴影模糊', 0, 50, 1, 'px'),
        slider('sh_alpha', '主阴影不透明度', 0, 80, 1, 'alpha'),
      ),
      el('div', { class: 'group-title' }, '内部发光'),
      el('div', { class: 'ctrl-group' },
        slider('ig_top_alpha', '顶部高光 inset', 0, 100, 1, 'alpha'),
        slider('ig_top_y', '顶部高光 Y', 0, 10, 1, 'px'),
        slider('ig_top_blur', '顶部高光模糊', 0, 16, 1, 'px'),
        slider('ig_bot_alpha', '底部暗影 inset', 0, 50, 1, 'alpha'),
        slider('ig_bot_y', '底部暗影 Y', -12, 0, 1, 'px'),
        slider('ig_glow', '内发光扩散', 0, 50, 1, 'px'),
        slider('ig_glow_alpha', '内发光不透明度', 0, 80, 1, 'alpha'),
      ),
    );
  }
  function tabGlobal() {
    return el('div', { class: 'tab-content', 'data-tab': 'global' },
      el('div', { class: 'group-title' }, '右侧气泡 (自己)'),
      el('div', { class: 'ctrl-group' },
        el('div', { class: 'color-row' }, el('label', null, '主色调'), el('input', { type: 'color', id: 'cl_r_main' })),
        el('div', { class: 'color-row' }, el('label', null, '边框色'), el('input', { type: 'color', id: 'cl_r_border' })),
        el('div', { class: 'color-row' }, el('label', null, '文字颜色'), el('input', { type: 'color', id: 'cl_r_text' })),
      ),
      el('div', { class: 'group-title' }, '左侧气泡 (对方)'),
      el('div', { class: 'ctrl-group' },
        el('div', { class: 'color-row' }, el('label', null, '主色调'), el('input', { type: 'color', id: 'cl_l_main' })),
        el('div', { class: 'color-row' }, el('label', null, '边框色'), el('input', { type: 'color', id: 'cl_l_border' })),
        el('div', { class: 'color-row' }, el('label', null, '文字颜色'), el('input', { type: 'color', id: 'cl_l_text' })),
      ),
      el('div', { class: 'group-title' }, '文字'),
      el('div', { class: 'ctrl-group' },
        slider('gl_fs', '字号', 12, 22, 1, 'px'),
        slider('gl_lh', '行高', 12, 24, 1, 'lh'),
      ),
      el('div', { class: 'hint' },
        '💡 玻璃模式独立于 admin 外观设置, 参数仅保存到本设备 localStorage。',
        el('br'),
        '被 ',
        el('code', null, '@'),
        ' 的消息会保留彩虹边 (底部散焦光让位)。'
      ),
    );
  }

  function buildPanel() {
    const host = document.createElement('div');
    host.id = 'tm-bubble-tuner-root';
    document.body.appendChild(host);
    panelShadow = host.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = PANEL_CSS;
    panelShadow.appendChild(styleEl);

    panelShadow.appendChild(el('button', {
      class: 'trigger', title: '玻璃气泡调节', onclick: togglePanel,
    }, '🔮'));
    panelShadow.appendChild(el('div', { class: 'backdrop', onclick: closePanel }));

    const enableSwitch = el('div', {
      class: 'switch' + (globalParams.enabled ? ' on' : ''),
      id: 'enableSwitch',
      onclick: () => {
        if (globalParams.enabled) disable();
        else enable();
        showToast(globalParams.enabled ? '✨ 玻璃气泡已启用' : '已切回原气泡模式');
      },
    });

    panelShadow.appendChild(el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', { class: 'header-row' },
          el('span', { class: 'title' }, '🔮 玻璃气泡调节'),
          el('button', { class: 'close', onclick: closePanel, title: '关闭' }, '✕'),
        ),
        el('div', { class: 'enable-row' },
          el('span', null, '启用玻璃气泡模式'),
          enableSwitch,
        ),
        el('div', { class: 'side-toggle' },
          el('button', { class: 'side-btn active', 'data-side': 'right', onclick: (e) => setSide('right', e.target) }, '右侧 (自己)'),
          el('button', { class: 'side-btn', 'data-side': 'left', onclick: (e) => setSide('left', e.target) }, '左侧 (对方)'),
        ),
        el('div', { class: 'tab-row' },
          el('button', { class: 'tab-btn active', 'data-tab': 'highlight', onclick: (e) => switchTab('highlight', e.target) }, '高光'),
          el('button', { class: 'tab-btn', 'data-tab': 'bubble', onclick: (e) => switchTab('bubble', e.target) }, '气泡'),
          el('button', { class: 'tab-btn', 'data-tab': 'shadow', onclick: (e) => switchTab('shadow', e.target) }, '阴影'),
          el('button', { class: 'tab-btn', 'data-tab': 'global', onclick: (e) => switchTab('global', e.target) }, '配色'),
        ),
      ),
      el('div', { class: 'body' },
        tabHighlight(), tabBubble(), tabShadow(), tabGlobal(),
      ),
      el('div', { class: 'footer' },
        el('button', { class: 'foot-btn primary', onclick: exportCss }, '复制 CSS'),
        el('button', { class: 'foot-btn secondary', onclick: exportJson }, '复制 JSON'),
        el('button', { class: 'foot-btn secondary', onclick: importJson }, '导入 JSON'),
        el('button', { class: 'foot-btn danger', onclick: resetAll }, '重置'),
      ),
    ));

    panelShadow.appendChild(el('div', { class: 'toast', id: 'toast' }));

    bindInputs();
    loadToInputs();
  }

  function togglePanel() { panelOpen ? closePanel() : openPanel(); }
  function openPanel() {
    panelShadow.querySelector('.panel').classList.add('open');
    panelShadow.querySelector('.backdrop').classList.add('show');
    panelOpen = true;
    loadToInputs();
  }
  function closePanel() {
    if (!panelShadow) return;
    panelShadow.querySelector('.panel').classList.remove('open');
    panelShadow.querySelector('.backdrop').classList.remove('show');
    panelOpen = false;
  }

  function setSide(side, btnEl) {
    currentSide = side;
    panelShadow.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    loadToInputs();
  }
  function switchTab(name, btnEl) {
    panelShadow.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    panelShadow.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btnEl.classList.add('active');
    panelShadow.querySelector(`.tab-content[data-tab="${name}"]`).classList.add('active');
  }

  function updateEnableSwitchUI() {
    if (!panelShadow) return;
    const sw = panelShadow.querySelector('#enableSwitch');
    if (sw) sw.classList.toggle('on', !!globalParams.enabled);
  }

  /* ========== 输入绑定 ========== */
  function bindInputs() {
    PARAM_IDS.forEach(id => {
      const input = panelShadow.querySelector('#' + id);
      if (!input) return;
      if (input.type === 'checkbox') {
        input.addEventListener('change', () => {
          params[currentSide][id] = input.checked;
          applyVars();
          if (id === 'bb_show_tail') scheduleRender();
          saveState();
        });
      } else {
        input.addEventListener('input', () => {
          params[currentSide][id] = parseFloat(input.value);
          applyVars();
          updateValDisplay(id);
          if (/^(bb_bg_alpha|bb_border_alpha|bb_border_w|bb_tail_r)$/.test(id)) {
            scheduleRender();
          }
          saveState();
        });
      }
    });
    GLOBAL_COLOR_IDS.forEach(id => {
      const input = panelShadow.querySelector('#' + id);
      if (!input) return;
      input.addEventListener('input', () => {
        globalParams[id] = input.value;
        applyVars();
        scheduleRender();
        saveState();
      });
    });
    GLOBAL_NUM_IDS.forEach(id => {
      const input = panelShadow.querySelector('#' + id);
      if (!input) return;
      input.addEventListener('input', () => {
        globalParams[id] = parseFloat(input.value);
        applyVars();
        updateValDisplay(id);
        saveState();
      });
    });
  }

  function loadToInputs() {
    const p = params[currentSide];
    PARAM_IDS.forEach(id => {
      const input = panelShadow.querySelector('#' + id);
      if (!input) return;
      if (input.type === 'checkbox') input.checked = !!p[id];
      else input.value = p[id];
    });
    GLOBAL_COLOR_IDS.forEach(id => {
      const input = panelShadow.querySelector('#' + id);
      if (input) input.value = globalParams[id];
    });
    GLOBAL_NUM_IDS.forEach(id => {
      const input = panelShadow.querySelector('#' + id);
      if (input) input.value = globalParams[id];
    });
    PARAM_IDS.forEach(id => updateValDisplay(id));
    GLOBAL_NUM_IDS.forEach(id => updateValDisplay(id));
    updateEnableSwitchUI();
  }

  function updateValDisplay(id) {
    const valEl = panelShadow.querySelector(`[data-val="${id}"]`);
    if (!valEl) return;
    const input = panelShadow.querySelector('#' + id);
    if (!input) return;
    const fmt = input.getAttribute('data-fmt') || '';
    const v = parseFloat(input.value);
    let txt;
    switch (fmt) {
      case 'px':    txt = v + 'px'; break;
      case 'pct':   txt = v + '%'; break;
      case 'alpha': txt = (v / 100).toFixed(2); break;
      case 'deg':   txt = v + '°'; break;
      case 'bw':    txt = (v / 10).toFixed(1) + 'px'; break;
      case 'sat':   txt = (v / 100).toFixed(2); break;
      case 'lh':    txt = (v / 10).toFixed(1); break;
      case 'hl_lr':
        txt = currentSide === 'right'
          ? (id === 'hl_left' ? v + '%' : v + 'px')
          : (id === 'hl_left' ? v + 'px' : v + '%');
        break;
      default: txt = String(v);
    }
    valEl.textContent = txt;
  }

  /* ========== 导入/导出/重置 ========== */
  function showToast(msg) {
    if (!panelShadow) return;
    const t = panelShadow.querySelector('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 2000);
  }

  function copy(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast(okMsg)).catch(() => fallbackCopy(text, okMsg));
    } else fallbackCopy(text, okMsg);
  }
  function fallbackCopy(text, okMsg) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast(okMsg); } catch (e) { showToast('复制失败'); }
    document.body.removeChild(ta);
  }

  function exportCss() {
    const cs = getComputedStyle(document.documentElement);
    const sideKeys = [
      'radius','tail-r','px','py','persp','rotx',
      'bg-alpha','border-alpha','border-w','blur','sat','show-tail',
      'cr','cg','cb','br','bg','bb','text',
      'hl-top','hl-left','hl-right','hl-height','hl-op-top','hl-op-mid','hl-stop','hl-rx','hl-ry',
      'ca-bottom','ca-height','ca-op',
      'sh-y','sh-blur','sh-alpha',
      'ig-top-alpha','ig-top-y','ig-top-blur','ig-bot-alpha','ig-bot-y','ig-glow','ig-glow-alpha',
    ];
    const lines = [':root {'];
    ['r', 'l'].forEach(side => {
      lines.push(`  /* ---- ${side === 'r' ? '右侧(自己)' : '左侧(对方)'} ---- */`);
      const pfx = `--gb-${side}-`;
      sideKeys.forEach(k => {
        const v = cs.getPropertyValue(pfx + k).trim();
        if (v) lines.push(`  ${pfx}${k}: ${v};`);
      });
    });
    lines.push(`  --gb-fs: ${cs.getPropertyValue('--gb-fs').trim()};`);
    lines.push(`  --gb-lh: ${cs.getPropertyValue('--gb-lh').trim()};`);
    lines.push('}');
    copy(lines.join('\n'), 'CSS 变量已复制 ✓ (可贴回 bubble-glass.css)');
  }
  function exportJson() {
    copy(JSON.stringify({ right: params.right, left: params.left, global: globalParams }, null, 2),
      '参数 JSON 已复制 ✓');
  }
  function importJson() {
    const txt = prompt('粘贴之前导出的参数 JSON:');
    if (!txt) return;
    try {
      const obj = JSON.parse(txt);
      if (obj.right) params.right = Object.assign(clone(DEFAULTS_RIGHT), obj.right);
      if (obj.left) params.left = Object.assign(clone(DEFAULTS_LEFT), obj.left);
      if (obj.global) {
        const wasEnabled = globalParams.enabled;
        globalParams = Object.assign(clone(DEFAULTS_GLOBAL), obj.global);
        globalParams.enabled = wasEnabled;
      }
      loadToInputs();
      applyVars();
      scheduleRender();
      saveState();
      showToast('✓ 已导入参数');
    } catch (e) { showToast('JSON 解析失败'); }
  }
  function resetAll() {
    if (!confirm('重置所有玻璃参数为默认值?')) return;
    const wasEnabled = globalParams.enabled;
    params.right = clone(DEFAULTS_RIGHT);
    params.left = clone(DEFAULTS_LEFT);
    globalParams = clone(DEFAULTS_GLOBAL);
    globalParams.enabled = wasEnabled;
    loadToInputs();
    applyVars();
    scheduleRender();
    saveState();
    showToast('已重置为默认值');
  }

  /* ========== 启动 ========== */
  function probe() {
    const my = document.querySelectorAll('.msg.my .msg-bubble').length;
    const other = document.querySelectorAll('.msg.other .msg-bubble').length;
    console.group('%c[TmBubble] 气泡探测', 'color:#a08ce0;font-weight:bold');
    console.log('.msg.my .msg-bubble  → ' + my + ' 个');
    console.log('.msg.other .msg-bubble → ' + other + ' 个');
    console.log('当前 body class:', document.body.className);
    console.log('已启用玻璃模式:', document.body.classList.contains(BODY_CLASS));
    console.groupEnd();
    return { my, other, enabled: document.body.classList.contains(BODY_CLASS) };
  }

  function init() {
    loadState();
    buildPanel();
    applyVars();
    if (globalParams.enabled) enable();
    startObserver();
    console.log('%c[TmBubble] 玻璃气泡调节器已启动 — 点右下 🔮 或 TmBubble.open()', 'color:#a08ce0');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 80);
  }

  window.TmBubble = {
    enable, disable, toggle, reset: resetAll,
    open: openPanel, close: closePanel, probe,
    get params() { return params; },
    get globalParams() { return globalParams; },
  };
})();
