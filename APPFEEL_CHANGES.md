# TeamChat — App感增强修改方案

## 变更摘要

**commit message:** `feat: add app-polish CSS layer — fix 20+ web-feel issues for native app experience`

**CHANGELOG 条目:**
- 新增 `css/app-polish.css`：统一的 App 质感增强层
- 修复弹窗/侧边栏遮罩无过渡动画的问题
- 添加毛玻璃背景、触控反馈、自定义滚动条
- 支持 iOS safe-area
- 禁止 UI 区域文字选中和系统长按菜单

---

## 问题诊断 × 修复对照

| # | 问题 | 表现 | 修复位置 |
|---|------|------|----------|
| 1 | UI 文字可选中 | 拖拽侧边栏能选中频道名 | app-polish.css `user-select` |
| 2 | 默认滚动条 | 粗大的灰色滚动条暴露浏览器 | app-polish.css 自定义滚动条 |
| 3 | 无触控反馈 | 点按钮没有任何视觉反馈 | app-polish.css `transform:scale` |
| 4 | 弹窗瞬间出现 | 没有入场动画，一闪就在 | app-polish.css `modalSlideUp` |
| 5 | 弹窗遮罩不模糊 | 纯黑半透明，网页感强 | app-polish.css `backdrop-filter` |
| 6 | 图片预览无动画 | 点击图片直接切全屏 | app-polish.css `imgZoomIn` |
| 7 | 右键菜单瞬间出现 | 没有弹出动画 | app-polish.css `menuPop` |
| 8 | emoji 选择器生硬 | 没有弹出动画 | app-polish.css `pickerSlideUp` |
| 9 | iOS刘海/底部不适配 | 输入框被 home indicator 遮挡 | app-polish.css `safe-area-inset` |
| 10 | 长按弹系统菜单 | iOS 上长按按钮弹出「拷贝」 | app-polish.css `touch-callout` |
| 11 | 点击蓝色高亮 | iOS/Android 点击时出现蓝色矩形 | app-polish.css `tap-highlight-color` |
| 12 | 侧边栏遮罩瞬开 | `display:none→block` 无法做 transition | layout.css + app-polish.css |
| 13 | 输入框聚焦生硬 | border 变色没有过渡 | app-polish.css `transition` |
| 14 | 通知栏展开生硬 | 没有展开动画 | app-polish.css `slideDown` |
| 15 | 回复条突然出现 | 没有入场动画 | app-polish.css |
| 16 | 被踢浮层粗糙 | 无毛玻璃无动画 | app-polish.css |
| 17 | header 阴影太弱 | 看不出层次感 | app-polish.css 增强 shadow |
| 18 | 输入区无层次 | 和消息区没有明显的视觉分离 | app-polish.css |
| 19 | 发送按钮禁用态 | 空消息时按钮没有视觉差异 | app-polish.css |
| 20 | 无骨架屏动画 | 加载时白屏 | app-polish.css `shimmer` |

---

## 改动文件清单

### 文件 1: `public/css/app-polish.css` (新增)
已生成，不再重复。

---

### 文件 2: `public/index.html`
在 responsive.css 后面加一行引入 app-polish.css：

**找到这行:**
```html
  <link rel="stylesheet" href="/css/responsive.css">
```

**替换为:**
```html
  <link rel="stylesheet" href="/css/responsive.css">
  <link rel="stylesheet" href="/css/app-polish.css">
```

---

### 文件 3: `public/css/layout.css`
sidebar-overlay 的 `display:none` 会阻断 CSS transition。
需要改成用 opacity + pointer-events 来控制。

**找到这行:**
```css
.sidebar-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.4);z-index:99}
```

**替换为:**
```css
.sidebar-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.4);z-index:99;opacity:0;pointer-events:none;transition:opacity .3s ease}
```

---

### 文件 4: `public/css/responsive.css`
sidebar-overlay 的 `.show` 也要配合修改。

**找到这行:**
```css
  .sidebar-overlay.show{display:block}
```

**替换为:**
```css
  .sidebar-overlay.show{opacity:1;pointer-events:auto}
```

---

## 不需要改 JS

以上所有修改都是纯 CSS，不需要改动任何 JS 文件。

---

## 可选的进阶优化（下一步）

这些需要改 JS 配合，这次先不动，但记录下来：

1. **频道切换骨架屏** — 切换频道时短暂显示 `.skeleton` 占位
2. **发送消息飞出动画** — 发送时消息气泡从输入框位置飞入列表
3. **下拉刷新手势** — 移动端下拉加载历史消息（touch 事件）
4. **震动反馈** — 发送/长按时 `navigator.vibrate(10)`
5. **页面切换过渡** — 登录→聊天用 fade 而不是瞬切
