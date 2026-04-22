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
| 消息气泡 + 输入框 + 接龙卡片 + 动画 | chat.css |
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
