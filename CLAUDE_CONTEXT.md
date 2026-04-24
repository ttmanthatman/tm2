# 项目: TeamChat (tm2)

## 基本信息
- 仓库: https://github.com/ttmanthatman/tm2 (public, Claude 可直接访问)
- 技术栈: Vue 3 (CDN, 非构建) + Express + Socket.IO + SQLite + DeepSeek API
- 前端: public/ 下的纯 HTML/CSS/JS，Vue 通过 CDN 引入，无 webpack/vite
- 后端: server/ 下按职责拆分 (config/database/middleware/routes/socket/ai)
- 部署: VPS + PM2 + Nginx，通过 dev.sh 驱动
- **当前版本: v0.5.5** (发版后记得同步更新这里，但别依赖这个字段——用 `git tag -l`)
- 分支策略: main (稳定可部署) + feat/* 或 fix/* (开发中)

## 关键约束 (给 Claude 的)

### 工作环境
- 我只在网页端 Claude 对话开发，没有 IDE
- 前端不用构建工具，所有 JS 直接在浏览器跑，**不能用 import/export**
- Vue 用 CDN 引入，在 js/app.js 里拼 template，不是 SFC
- 我是公网公开的 github 仓库，Claude 可以用 `git clone` / web_fetch / raw URL 直接读取文件
- **凡是"可能要改"的配置（API key、provider、模型名、开关），都必须做成管理页可配，绝不让我 SSH 改文件**

### 给方案前必做
1. **先读仓库当前真实代码**。本文件的模块索引和版本号可能滞后，不要基于它推测代码状态。每次任务开始都 clone / fetch 一次最新 main。
2. **确认版本号**。`git tag -l` 看仓库最新 tag，下一版 = 最新 tag + 1。不要依赖本文件的"当前版本"字段。
3. **失败时先问症状，再改代码**。上一版坏了的话先要截图、Safari 还是 PWA、是否开键盘，确认根因再动手。每硬猜一次就可能再坏一版。
4. **读代码要有节制**。动手前只读架构关键文件（database.js / socket.js / 目标路由 / 目标 js）。不要把整个前端 app.js 1000+ 行一口气读完——工具额度有限，读完就没余量写代码了。

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
| 全局配置 (端口/密钥/路径/DeepSeek fallback) | config.js |
| 建表/迁移/辅助查询 | database.js |
| JWT 认证/管理员权限 | middleware.js |
| 文件上传 (multer) | upload.js |
| Web Push 推送 | push-service.js |
| 实时消息/在线状态/接龙/AI 触发 hook | socket.js |
| 登录/注册/改密码 | routes/auth.js |
| 频道 CRUD/成员管理 | routes/channels.js |
| 消息获取/文件上传接口 | routes/messages.js |
| 外观/通知/时区设置 | routes/settings.js |
| 用户增删查 (管理员) | routes/users.js |
| 推送订阅/取消 | routes/push.js |
| 备份导出/还原 | routes/backup.js |
| 管理员附件 & 墙纸库管理 | routes/admin-files.js |
| **AI 角色管理 + Key 配置** | **routes/ai.js** |
| **DeepSeek API 封装** | **ai/deepseek-client.js** |
| **AI 角色运行时 (schedule/prompt/调用)** | **ai/character.js** |
| **AI 触发评估器 (mention 判断/防循环)** | **ai/trigger.js** |
| 主入口 (组装一切) | server.js |

### 前端 public/
| 功能 | 文件 |
|------|------|
| 页面入口 HTML | index.html |
| **AI 角色管理页 (独立 HTML, 未集成进 SPA)** | **ai-admin.html** |
| Vue 主应用 (组件+模板+挂载) | js/app.js |
| 全局响应式状态 | js/store.js |
| API 调用封装 | js/api.js |
| Socket.IO 客户端 | js/socket-client.js |
| Web Push 客户端 | js/push-client.js |
| 工具函数 (转义/时间/清理) | js/utils.js |
| 可扩展表情注册表 | js/emoji.js |
| 管理员弹窗方法 | js/modals/admin-methods.js |
| 管理员附件/墙纸库方法 | js/modals/files-admin-methods.js |
| Service Worker (PWA+推送, 缓存名 teamchat-v9) | sw.js |
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

## 数据库 schema (核心表)

- `users`: id, username, password, nickname, avatar, is_admin, **is_ai**, last_login_at
- `channels`: id, name, description, is_private, is_default
- `channel_members`: channel_id, user_id, role (member/viewer)
- `messages`: id, user_id, username, content, type (text/image/file/voice), file_path, duration, reply_to, channel_id, created_at (UTC ISO)
- `settings`: key, value — **DeepSeek key 存这里 (key='deepseek_api_key')**
- `ai_characters`: id, user_id (FK → users, one-to-one), config_json, state_json, enabled, tokens_used_today, budget_reset_at
- `ai_logs`: id, character_id, channel_id, trigger_type, input_msg_id, output_msg_id, input_tokens, output_tokens, latency_ms, error, created_at
- `push_subscriptions`: id, user_id, endpoint, keys_p256dh, keys_auth

## 模块依赖关系

```
config.js ←── database.js ←── middleware.js
    ↑              ↑              ↑
    └──────────────┼──────────────┘
                   ↓
              routes/*.js ←── upload.js ←── ai/deepseek-client.js
                   ↓              ↓              ↓
              socket.js ←── push-service.js ←── ai/character.js ←── ai/trigger.js
                   ↓                                    ↑
              server.js (组装入口) ────────────────────┘
```

AI 调用链：`socket.sendMessage → trigger.evaluate → character.runReply → deepseek-client.chatCompletion → 写 messages 表 + emit newMessage + 写 ai_logs`

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
./dev.sh quickfix v0.X.Y "fix(...): 一行标题

(可选多行正文)"

# 2. 手动编辑 CHANGELOG.md, 添加 v0.X.Y 条目

# 3. 提交 CHANGELOG
./dev.sh save "docs: CHANGELOG v0.X.Y"

# 4. 部署
./dev.sh deploy v0.X.Y
```

> 注意：commit message 的第一行要符合 conventional commits 格式 (`fix(scope): ...` / `feat(scope): ...` / `docs: ...`)。Claude 给版本号时，先 `git tag -l` 确认最新 tag，下一版 +1。

## AI 角色功能使用指南 (v0.5.2)

### 架构要点
- AI 以"虚拟用户"存在 users 表 (`is_ai=1`)，发消息走 messages 表，和人类完全一致
- DeepSeek Key 存 `settings.deepseek_api_key`，管理页 `/ai-admin` 粘贴保存
- 触发：人类在 socket.sendMessage 时，`ai/trigger.evaluate()` 被异步调用，检查所有启用角色是否要响应
- 防循环：sender.is_ai=1 → 跳过；每角色 3 条/分钟；日 token 预算硬上限
- 管理页独立 `/ai-admin.html`，未集成进主 SPA

### 当前 `config_json` 识别的字段白名单
(在 `server/routes/ai.js` 的 `validateConfig` + `fillDefaults` 里)

- `name` — 昵称
- `persona.identity / personality / speaking_style / interests / taboos` — 拼 system prompt
- `schedule.timezone / online_windows` — 上线时段
- `trigger.mode / mention_keywords / max_replies_per_minute` — 触发规则
- `channels` — 频道 id 数组 (空=所有公开频道)
- `model.name / temperature / max_context_messages` — DeepSeek 调用参数
- `budget.daily_tokens / per_message_max_tokens` — 成本上限

**其他字段（如 `action_potentials` / `internal_conflicts` / `social_meters` / `voice_profile` / `stability_index`）当前版本不读取**，会原样存 DB (Object.assign 不会丢)，保留给未来扩展。

### AI 没回复时的排查顺序
1. 管理页看 Key 卡片状态（`/api/ai/config` 返回 `key_set: true`？）
2. 角色 enabled=1 且 is_online_now=true？
3. 人类消息是否包含 mention_keywords / 昵称？
4. `ai_logs` 表近期记录是什么（`trigger_type`、`error` 字段）
5. `pm2 logs` 看 DeepSeek 调用异常

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

### 5. 版本号是仓库里的 tag 说了算，不是本文件
本文件的「当前版本」字段每次发版都可能忘记更新。下次决定版本号时，**先 `git tag -l`**，不要读这里。本文件字段仅供参考。

### 6. 消费级产品不让用户碰 SSH / 文件
v0.5.0 让我去 VPS 手动建 `.deepseek_key` 文件——我明确说过"只在网页端 Claude 对话开发没有 IDE"。v0.5.1 返工改成了管理页配置。**凡是可能要换的配置（API key、provider、模型名、开关），都做成管理页可配**。只有一次性部署配置（JWT 密钥、VAPID）才能留在文件里。

### 7. express.static 默认不做 .html fallback
SPA (`app.get("*", ...)` serve index.html) + 独立 HTML 页 (如 `/ai-admin.html`) 共存时，**必须**给 `express.static` 加 `{ extensions: ["html"] }`，否则 `/ai-admin` 会被 SPA catch-all 吞掉，返回聊天主页。这个 bug 在 v0.5.2 修掉了。未来再加独立页同样注意。

### 8. Service Worker 缓存很顽固，加新页记得 bump 缓存版本
新加 HTML 页或改现有页时，如果不 bump `public/sw.js` 的 `CACHE_NAME`（当前 `teamchat-v9`），老用户会一直看到旧版。排查方法：F12 → Application → Service Workers → Unregister + Clear storage + 隐身窗口。未来改 sw.js 可托管内容时，同步把 CACHE_NAME 后缀 +1（v10、v11...）

### 9. 工具额度要省着用
Claude 每次对话工具调用有上限。架构核心文件（schema、主流程、路由入口）必读；前端 1000+ 行的 app.js、admin-methods.js 不到真要改别打开——那种文件读一遍就占 1/3 额度，剩下的不够写代码了。宁可多问一次用户"这个改动要不要动 XX 文件"，也别自作主张全读完。

### 10. 用户给的 JSON 不一定代码能识别
v0.5.2 我给了一个非常丰富的角色 JSON (有 action_potentials、social_meters、internal_conflicts 等)，但当前代码只读了 10%。**收到复杂配置时先对照代码白名单过一遍**，告诉我：哪些字段会生效、哪些会被忽略、哪些要等 v0.x 才能实现。不要闷头照单全收让我误以为都生效了。未识别字段用 `_reserved_full_spec` 前缀保留，未来扩展时好接。

---

> **使用方法**：
> - 开新功能时：粘贴本文件 + 任务说明
> - 续做未完成功能时：粘贴本文件 + 上次的 HANDOFF.md + 本次目标
> - 发版后：更新「当前版本」字段；新增/删除/重命名文件时同步更新模块索引；踩到新坑时在「血的教训」追加条目