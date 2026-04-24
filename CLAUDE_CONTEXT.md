# 项目: TeamChat (tm2)

## 基本信息
- 仓库: https://github.com/ttmanthatman/tm2 (public, Claude 可直接访问)
- 技术栈: Vue 3 (CDN, 非构建) + Express + Socket.IO + SQLite
- 前端: public/ 下的纯 HTML/CSS/JS，Vue 通过 CDN 引入，无 webpack/vite
- 后端: server/ 下按职责拆分 (config/database/middleware/routes/socket)
- 部署: VPS + PM2 + Nginx，通过 dev.sh 驱动
- **当前版本: v0.4.9** (发版后记得同步更新这里)
- 分支策略: main (稳定可部署) + feat/* 或 fix/* (开发中)

## 关键约束 (给 Claude 的)

### 工作环境
- 我只在网页端 Claude 对话开发，没有 IDE
- 前端不用构建工具，所有 JS 直接在浏览器跑，**不能用 import/export**
- Vue 用 CDN 引入，在 js/app.js 里拼 template，不是 SFC
- 我是公网公开的 github 仓库，Claude 可以用 `git clone` / web_fetch / raw URL 直接读取文件

### 给方案前必做
1. **先读仓库当前真实代码**。本文件的模块索引和版本号可能滞后，不要基于它推测代码状态。每次任务开始都 clone / fetch 一次最新 main。
2. **确认版本号**。`git tag -l` 看仓库最新 tag，下一版 = 最新 tag + 1。不要依赖本文件的"当前版本"字段。
3. **对 mobile / iOS 相关改动要极度谨慎**。iOS Safari 有一堆反直觉行为 (visualViewport / 100dvh / position:fixed / touch-action 之间的交互都不按字面含义工作)。若不能真机验证，只做最小改动，并提前说明"这个改法可能坏哪里"，给我决策权，不要盲目自信。
4. **失败时先问症状，再改代码**。上一版坏了的话先要截图、Safari 还是 PWA、是否开键盘，确认根因再动手。每硬猜一次就可能再坏一版。
5. **不要用 ask_user_input_v0 要用户贴代码**。Claude 能直接从 github 读任何文件，先用工具，实在读不到再问。

### 输出要求
- 每次输出前先给**变更摘要** (一行 commit message + CHANGELOG 条目草稿)
- 按文件路径逐个给出完整代码或明确的局部替换，方便直接粘贴
- 每次输出的文件按照项目目录结构打包
- 对 mobile / iOS / 布局相关改动：额外给「**失败风险清单**」—— 本次改动可能在哪些场景翻车 (Safari vs PWA、键盘开合、横竖屏、双击空白)，让我部署前心里有数
- 每次输出末尾按 **开发工作流** 给完整 dev.sh 命令行

## 模块索引

### 后端 server/
| 功能 | 文件 |
|------|------|
| 全局配置 (端口/密钥/路径) | config.js |
| 建表/迁移/辅助查询 | database.js |
| JWT 认证/管理员权限 | middleware.js |
| 文件上传 (multer) | upload.js |
| Web Push 推送 | push-service.js |
| 实时消息/在线状态/接龙 | socket.js |
| 登录/注册/改密码 | routes/auth.js |
| 频道 CRUD/成员管理 | routes/channels.js |
| 消息获取/文件上传接口 | routes/messages.js |
| 外观/通知/时区设置 | routes/settings.js |
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
| API 调用封装 | js/api.js |
| Socket.IO 客户端 | js/socket-client.js |
| Web Push 客户端 | js/push-client.js |
| 工具函数 (转义/时间/清理) | js/utils.js |
| 可扩展表情注册表 | js/emoji.js |
| 管理员弹窗方法 | js/modals/admin-methods.js |
| 管理员附件/墙纸库方法 | js/modals/files-admin-methods.js |
| Service Worker (PWA+推送) | sw.js |
| PWA 清单 | manifest.json |

### 前端样式 public/css/
| 职责 | 文件 |
|------|------|
| 重置 + 全局变量 | base.css |
| 登录页 | login.css |
| 三栏布局 + 侧边栏 + 成员面板 | layout.css |
| 消息气泡 (扁平) + 输入框 + 接龙卡片 | chat.css |
| 所有弹窗 | modals.css |
| 管理员附件/墙纸库专用样式 | files-admin.css |
| 响应式断点 | responsive.css |
| App 质感增强 (反馈/滚动条/safe-area) | app-polish.css |

### 部署/运维
| 用途 | 文件 |
|------|------|
| 全新服务器一键安装 | install-from-git.sh |
| 增量更新 (支持 tag 部署) | update.sh |
| 本地开发工作流 (quickfix/save/deploy/rollback) | dev.sh (gitignore) |
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
base.css → login.css → layout.css → chat.css → modals.css
  → files-admin.css → responsive.css → app-polish.css
```

app-polish.css 必须最后加载，它通过覆盖和增强前面的样式来提供 App 质感。

## 开发工作流 (dev.sh)

dev.sh 是本地脚本 (gitignored)，封装了四条命令：

### 1. 快速提交一个带 tag 的改动
```bash
./dev.sh quickfix v0.X.Y "commit message (支持多行)"
```
内部流程：创建 `fix/quickfix-vX.Y.Z` 分支 → 提交 → 切回 main → 合并 → 打 tag → 推送 → 删除临时分支。

### 2. 在 main 上直接提交 (不打 tag)
```bash
./dev.sh save "commit message"
```
用于 docs / CHANGELOG 这类小提交。

### 3. 部署某 tag 到 VPS
```bash
./dev.sh deploy v0.X.Y
```
SSH 到 VPS → 备份数据库 → git fetch → 切到指定 tag → npm install → pm2 restart。

### 4. 回滚
```bash
./dev.sh rollback
```
回到部署日志里的上一版。仅影响 VPS 端部署，不动 git history。

### 典型发版流程 (Claude 每次按此输出命令)
```bash
# 1. 提交代码 + 打 tag
./dev.sh quickfix v0.4.X "fix(...): 一行标题

(可选多行正文)"

# 2. 手动编辑 CHANGELOG.md, 添加 v0.4.X 条目

# 3. 提交 CHANGELOG
./dev.sh save "docs: CHANGELOG v0.4.X"

# 4. 部署
./dev.sh deploy v0.4.X
```

> 注意：commit message 的第一行要符合 conventional commits 格式 (`fix(scope): ...` / `feat(scope): ...` / `docs: ...`)。Claude 给版本号时，先 `git tag -l` 确认最新 tag，下一版 +1。

## 输出格式约定

1. 先给出**变更摘要**：一行 commit message 标题 + CHANGELOG 条目草稿
2. 如果不确定该改哪些文件，先对照上方模块索引判断，说明理由，再去仓库读对应文件
3. 按文件逐个输出：标明路径，给出完整代码或局部替换
4. 对 mobile/iOS/布局改动给「失败风险清单」
5. 末尾给完整 dev.sh 发版命令 (四步)
6. 当我说「生成交接摘要」时，按以下格式输出，单独保存为 HANDOFF.md (不要合并进本文件)：
   - **本次目标**：一句话
   - **完成度**：已完成 / 进行中 / 阻塞
   - **改动文件清单**：路径 + 一句话说明
   - **分支状态**：是否已 commit / push / 合并到 main / 打 tag / 部署
   - **未决问题**：下次需要继续的点
   - **设计决策备忘**：关键的"为什么这么做"

## 血的教训 (给未来的 Claude)

这些坑已经踩过了，下次别再踩。

### 1. 不要在 body 上加 `position:fixed` 来"锁住"视口
iOS 聚焦输入框时仍会推 layout viewport，固定 body 会被一起顶上去，chat-header 和 messages 会跑出屏幕顶部。**正确做法**：让 body 的 `height` 跟着 `visualViewport.height` 走 (用 `--app-vh` 变量同步)，body 本身维持普通文档流。只要 body 高度等于可见区，iOS 就不再做聚焦滚动补偿。

### 2. `touch-action: manipulation` 不禁止双指缩放
它只禁止**双击缩放**。真正禁止双指缩放的是 `touch-action: pan-x pan-y` 或 `touch-action: none`。当前本项目是靠 `#app { touch-action: pan-y }` 覆盖整个视口来锁缩放的 —— 任何让 `#app` 不能完全覆盖视口的改动 (父容器变小、position 改了、height 不对) 都会漏出裸 html 区域，让双指缩放生效。改布局时务必验证 `#app` 仍然铺满。

### 3. `100dvh` 不考虑软键盘
CSS 规范里 `dvh` 专指浏览器 UI 的动态高度，**不包括软键盘**。iOS 上键盘弹起后 100dvh 不会缩小，会遮住输入栏。必须用 `visualViewport.height` 作为高度源，容器主动缩 —— 当前 base.css / layout.css / responsive.css 里相应容器都是 `height: var(--app-vh, 100dvh)`，JS 在 visualViewport 变化时同步 `--app-vh`。

### 4. 不要随便 `scrollTo(0, 0)` 兜底
老代码在 `visualViewport.resize` 时 `scrollTo(0,0)`，本意是兜底 iOS 聚焦滚动，但副作用是 Safari 底栏切换时也触发，造成"双击空白内容上移"的误会。只要容器高度跟可见区走，不需要这种兜底；加了反而出问题。

### 5. 版本号是仓库里的 tag 说了算，不是本文件
本文件的「当前版本」字段每次发版都可能忘记更新。下次决定版本号时，**先 `git tag -l`**，不要读这里。本文件字段仅供参考。

---

> **使用方法**：
> - 开新功能时：粘贴本文件 + 任务说明
> - 续做未完成功能时：粘贴本文件 + 上次的 HANDOFF.md + 本次目标
> - 发版后：更新「当前版本」字段；新增/删除/重命名文件时同步更新模块索引；踩到新坑时在「血的教训」追加条目