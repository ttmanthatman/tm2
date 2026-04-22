# 项目: TeamChat (tm2)

## 基本信息
- 仓库: https://github.com/ttmanthatman/tm2
- 技术栈: Vue 3 (CDN, 非构建) + Express + Socket.IO + SQLite
- 前端: public/ 下的纯 HTML/CSS/JS，Vue 通过 CDN 引入，无 webpack/vite
- 后端: server/ 下按职责拆分 (config/database/middleware/routes/socket)
- 部署: VPS + PM2 + Nginx，通过 update.sh 从 GitHub 拉取更新
- 当前版本: v0.4.2
- 分支策略: main (稳定可部署) + feat/* 或 fix/* (开发中)

## 关键约束
- 我只在网页端 Claude 对话开发，没有 IDE
- 前端不用构建工具，所有 JS 直接在浏览器跑，不能用 import/export
- 请先读取需要改动的文件原始内容，再给出修改方案
- 按文件路径逐个给出完整代码(或明确的局部替换)，方便我直接粘贴
- 每次输出前先给变更摘要(用于 git commit message 和 CHANGELOG)
- 每次输出的文件按照项目目录结构打包
- 每次输出后，参考dev.sh，输出部署的完整命令行

## 模块索引

### 后端 server/
| 功能 | 文件 |
|------|------|
| 全局配置 (端口/密钥/路径) | config.js |
| 建表/迁移/辅助查询 | database.js |
| JWT 认证/管理员权限 | middleware.js |
| 文件上传 (multer, 含语音 mp4/aac 支持) | upload.js |
| Web Push 推送 | push-service.js |
| 实时消息/在线状态/接龙 | socket.js |
| 登录/注册/改密码 | routes/auth.js |
| 频道 CRUD/成员管理 | routes/channels.js |
| 消息获取/文件上传接口 | routes/messages.js |
| 外观/通知/时区/气泡样式设置 | routes/settings.js |
| 用户增删查 (管理员) | routes/users.js |
| 推送订阅/取消 | routes/push.js |
| 备份导出/还原 | routes/backup.js |
| 管理员附件 & 墙纸库管理 | routes/admin-files.js |
| 主入口 (组装一切) | server.js |

### 前端 public/
| 功能 | 文件 |
|------|------|
| 页面入口 HTML | index.html |
| Vue 主应用 (组件+模板+挂载) | js/app.js |
| 全局响应式状态 | js/store.js |
| API 调用 + 外观应用 + 气泡3D引擎 | js/api.js |
| Socket.IO 客户端 | js/socket-client.js |
| Web Push 客户端 | js/push-client.js |
| 工具函数 (转义/时间/清理) | js/utils.js |
| 可扩展表情注册表 | js/emoji.js |
| 管理员弹窗方法 (含气泡样式草稿/保存) | js/modals/admin-methods.js |
| 管理员附件/墙纸库方法 | js/modals/files-admin-methods.js |
| Service Worker (PWA+推送) | sw.js |
| PWA 清单 | manifest.json |

### 前端样式 public/css/
| 职责 | 文件 |
|------|------|
| 重置 + 全局变量 | base.css |
| 登录页 | login.css |
| 三栏布局 + 侧边栏 + 成员面板 | layout.css |
| 消息气泡 + 气泡CSS变量 + 2D/3D模式规则 + 输入框 + 接龙卡片 + 动画 | chat.css |
| 所有弹窗 | modals.css |
| 管理员附件/墙纸库专用样式 | files-admin.css |
| 响应式断点 | responsive.css |
| App 质感增强 (动画/反馈/滚动条/safe-area) | app-polish.css |

### 部署/运维
| 用途 | 文件 |
|------|------|
| 全新服务器一键安装 | install-from-git.sh |
| 增量更新 (支持 tag 部署) | update.sh |
| 本地开发辅助脚本 | dev.sh |
| 部署文档 | DEPLOY.md |
| 版本变更记录 | CHANGELOG.md |

## 模块依赖关系

```
config.js ←── database.js ←── middleware.js
    ↑              ↑              ↑
    └──────────────┼──────────────┘
                   ↓
              routes/*.js ←── upload.js
                   ↓              ↓
              socket.js ←── push-service.js
                   ↓
              server.js (组装入口)
```

## CSS 加载顺序

```
base.css → login.css → layout.css → chat.css → modals.css → files-admin.css → responsive.css → app-polish.css
```

app-polish.css 必须最后加载，它通过覆盖和增强前面的样式来提供 App 质感。

## 气泡样式系统架构

气泡样式是一个跨 5 个文件的子系统，改动时需要同步修改。

### 数据流

```
管理员面板 (app.js 模板)
  ↓ v-model 双向绑定
草稿对象 modalData.appDraft.bubble_*  (admin-methods.js openAppearance)
  ↓ 保存
POST /api/settings/appearance  →  settings 表 (settings.js APPEARANCE_KEYS)
  ↓ Socket 广播 appearanceChanged
applyAppearance(d)  →  _applyBubbleStyle(d)  (api.js)
  ↓ 计算 CSS 变量
document.documentElement.style.setProperty('--b-*-3d-*', ...)
  ↓ CSS 规则消费变量
body.bubble-3d .msg.my .msg-bubble { background: var(--b-my-3d-bg); ... }  (chat.css)
```

### 管理面板实时预览

app.js 中的 `bubblePreviewStyle(isMy)` 方法直接读取 `modalData.appDraft` 中的草稿值，用与 api.js `_calc3D` 完全相同的算法计算 inline style，实现调色时即时预览。**修改 `_calc3D` 时必须同步修改 `bubblePreviewStyle`。**

### 气泡设置键 (20个)

| 分类 | 键名 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| 模式 | bubble_style | flat/2d-single/2d-flow/3d | flat | 效果模式 |
| 颜色 | bubble_my_color1 | hex | #667eea | 我方主色 |
| 颜色 | bubble_my_color2 | hex | #667eea | 我方副色 (渐变/3D用) |
| 颜色 | bubble_my_text | hex | #ffffff | 我方文字色 |
| 颜色 | bubble_other_color1 | hex | #ffffff | 对方主色 |
| 颜色 | bubble_other_color2 | hex | #ffffff | 对方副色 |
| 颜色 | bubble_other_text | hex | #333333 | 对方文字色 |
| 渐变 | bubble_gradient_angle | 0-360 | 135 | 2D单泡渐变角度 |
| 3D | bubble_3d_intensity | 10-100 | 60 | 整体3D强度 (%) |
| 3D | bubble_3d_bevel | 0-100 | 50 | 倒角宽度 (%) |
| 描边 | bubble_border_on | 0/1 | 0 | 渐变描边开关 |
| 描边 | bubble_border_width | 1-6 | 2 | 描边宽度 (px) |
| 描边 | bubble_border_color1 | hex | #ffffff | 描边起始色 |
| 描边 | bubble_border_color2 | hex | #000000 | 描边结束色 |
| 阴影 | bubble_shadow_offset | 0-20 | 4 | 投射距离 (px) |
| 阴影 | bubble_shadow_angle | 0-355 | 180 | 投射角度 (°, 180=正下方) |
| 阴影 | bubble_shadow_blur | 0-40 | 12 | 模糊半径 (px) |
| 阴影 | bubble_shadow_spread | -5~15 | 0 | 扩散半径 (px) |
| 阴影 | bubble_shadow_opacity | 0-100 | 15 | 不透明度 (%, 0=无阴影) |
| 阴影 | bubble_shadow_color | hex | #000000 | 阴影颜色 |

### CSS 变量 (chat.css :root)

| 变量 | 用途 |
|------|------|
| --b-my-c1, --b-my-c2, --b-my-text | 我方气泡基色/文字色 (flat/2D) |
| --b-ot-c1, --b-ot-c2, --b-ot-text | 对方气泡基色/文字色 (flat/2D) |
| --b-angle | 2D 单泡渐变角度 |
| --b-my-3d-bg, --b-my-3d-shadow, --b-my-3d-border | 我方 3D 预计算值 |
| --b-ot-3d-bg, --b-ot-3d-shadow, --b-ot-3d-border | 对方 3D 预计算值 |

### body class 切换

| class | 触发条件 |
|-------|----------|
| (无) | bubble_style = flat |
| bubble-2d-single | bubble_style = 2d-single |
| bubble-2d-flow | bubble_style = 2d-flow |
| bubble-3d | bubble_style = 3d |

### 3D 引擎关键算法 (api.js `_calc3D`)

- **自适应高光**: `hiL = L + (97 - L) × 0.6 × t` — 按离白色的剩余空间比例提亮，浅色不会洗白
- **自适应暗部**: `shL = L - (L - 5) × 0.55 × t` + 色相偏移 8° + 加饱和 — 暗部有颜色不死黑
- **渐变描边**: `background-clip: padding-box / border-box` 技巧，border 设为 transparent
- **阴影角度**: `X = dist × sin(θ)`, `Y = -dist × cos(θ)` (θ=180° 即正下方)

## 语音录制注意事项

- 录制使用 `_cancelled` 标志位防止取消后仍发送 (onstop 异步竞态)
- MIME 类型自动检测: 优先 webm/opus，iOS Safari 回退到 mp4
- 后端 upload.js 的 `VOICE_MIME_EXT` 映射表决定文件扩展名
- 文件名由前端根据实际 MIME 选择扩展名 (.webm / .m4a / .ogg)

## 输出格式约定
1. 先给出**变更摘要**：一行 commit message + CHANGELOG 条目草稿
2. 再按文件逐个输出：标明路径，给出完整代码或局部替换
3. 如果不确定该改哪些文件，先对照上方模块索引判断，说明理由，然后去仓库读取对应文件
4. 当我说「生成交接摘要」时，按以下格式输出，单独保存为 HANDOFF.md（不要合并进本文件）：
   - **本次目标**：一句话
   - **完成度**：已完成 / 进行中 / 阻塞
   - **改动文件清单**：路径 + 一句话说明
   - **分支状态**：是否已 commit / push / 合并到 main
   - **未决问题**：下次需要继续的点
   - **设计决策备忘**：关键的"为什么这么做"

---

> **使用方法**：
> - 开新功能时：粘贴本文件 + 任务说明
> - 续做未完成功能时：粘贴本文件 + 上次的 HANDOFF.md + 本次目标
> - 发版后：更新上方的「当前版本」；新增/删除/重命名文件时同步更新模块索引
