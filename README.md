# TeamChat v0.4.1 — 多频道团队聊天室

基于 Vue 3 (CDN) + Express + Socket.IO + SQLite 的轻量团队聊天应用。
无需构建工具，前端纯 HTML/CSS/JS，部署只需一台 VPS。

## 项目结构

```
tm2/
├── package.json
├── README.md
├── CHANGELOG.md
├── DEPLOY.md
├── CLAUDE_CONTEXT.md           # Claude 开发上下文 (AI 辅助开发用)
│
├── install-from-git.sh         # 全新服务器一键安装
├── update.sh                   # 增量更新 (支持 tag 部署)
├── dev.sh                      # 本地开发辅助脚本
│
├── server/                     # ── 后端 ──
│   ├── server.js               # 主入口: 组装中间件 + 路由 + Socket
│   ├── config.js               # 配置: 端口、密钥、路径
│   ├── database.js             # 数据库: 建表、迁移、查询
│   ├── middleware.js            # JWT 认证、管理员权限
│   ├── upload.js               # multer 文件上传
│   ├── push-service.js         # Web Push 推送
│   ├── socket.js               # 实时消息、在线状态、接龙
│   └── routes/
│       ├── auth.js             # 登录 / 注册 / 改密码
│       ├── channels.js         # 频道 CRUD / 成员管理
│       ├── messages.js         # 消息获取 / 文件上传
│       ├── settings.js         # 外观 / 通知 / 时区
│       ├── users.js            # 用户增删查 + @提及基础列表
│       ├── push.js             # 推送订阅 / 取消
│       ├── backup.js           # 备份导出 / 还原
│       └── admin-files.js      # 附件 & 墙纸库管理
│
└── public/                     # ── 前端 ──
    ├── index.html              # 入口 HTML
    ├── sw.js                   # Service Worker (PWA + 推送)
    ├── manifest.json           # PWA 清单
    ├── images/                 # 图标、默认头像
    ├── emojis/                 # Yahoo Messenger 经典 GIF 表情
    ├── css/
    │   ├── base.css            # 重置 + 全局变量
    │   ├── login.css           # 登录页
    │   ├── layout.css          # 三栏布局 + 侧边栏 + 成员面板
    │   ├── chat.css            # 消息气泡 + 输入框 + 接龙 + @提及 + 动画
    │   ├── modals.css          # 弹窗系统
    │   ├── files-admin.css     # 管理员附件/墙纸库
    │   ├── responsive.css      # 响应式断点
    │   └── app-polish.css      # App 质感增强层
    └── js/
        ├── emoji.js            # 可扩展表情注册表
        ├── utils.js            # 工具函数 (转义/时间/清理)
        ├── store.js            # Vue reactive 全局状态
        ├── api.js              # API 调用封装
        ├── socket-client.js    # Socket.IO 客户端
        ├── push-client.js      # SW 注册 + 推送订阅
        ├── modals/
        │   ├── admin-methods.js         # 管理员弹窗方法
        │   └── files-admin-methods.js   # 附件/墙纸库方法
        └── app.js              # Vue 主入口 (组件 + 模板 + 挂载)
```

## 本地开发

```bash
npm install
npm run dev          # 带热重启
# 或
./dev.sh             # 辅助脚本 (环境检查 + 常用快捷命令)

# 访问 http://localhost:3000
```

## 部署

详见 [DEPLOY.md](./DEPLOY.md)。

```bash
# 全新服务器
bash install-from-git.sh

# 增量更新
bash update.sh

# 指定 tag 部署
bash update.sh v0.4.0
```

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

## 调试指南

### 后端

| 功能 | 文件 | 方法 |
|------|------|------|
| 登录/注册 | `routes/auth.js` | Postman 测接口 |
| 频道权限 | `routes/channels.js` + `database.js` | 检查 `canAccessChannel()` |
| 消息发送 | `socket.js` | 监听 `sendMessage` 事件 |
| 推送 | `push-service.js` + `routes/push.js` | 检查 VAPID 密钥 |
| 文件上传 | `upload.js` + `routes/messages.js` | 检查 multer 配置 |
| 附件/墙纸管理 | `routes/admin-files.js` | 检查批量操作逻辑 |

### 前端

| 功能 | 文件 | 方法 |
|------|------|------|
| 样式 | `css/*.css` | DevTools Elements 面板 |
| 状态 | `js/store.js` | Vue Devtools |
| Socket | `js/socket-client.js` | DevTools Network → WS |
| API | `js/api.js` | DevTools Network → XHR |
| Emoji | `js/emoji.js` | 控制台 `EmojiRegistry.allCodes()` |

## 旧版迁移

旧版 (bushu-43.sh) 的 `database.sqlite` 完全兼容，直接复制到项目根目录即可。

## 版本历史

详见 [CHANGELOG.md](./CHANGELOG.md)。
