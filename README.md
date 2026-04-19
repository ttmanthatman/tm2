# TeamChat v0.3.0 — 模块化版本

## 📂 项目结构

```
tm2/
├── package.json                 # 依赖声明 (npm install)
├── README.md                    # 本文档
├── CHANGELOG.md                 # 版本变更记录 (Keep a Changelog 格式)
├── DEPLOY.md                    # 部署指南
│
├── install-from-git.sh          # 🆕 全新服务器一键安装
├── update.sh                    # 🔄 增量更新 (支持 tag 部署)
├── dev.sh                       # 🛠  本地开发辅助脚本
│
├── server/                      # ====== 后端 (Express + Socket.IO) ======
│   ├── server.js                # 🚀 主入口: 组装中间件 + 路由 + Socket
│   ├── config.js                # ⚙️  配置: 端口、密钥、路径、常量
│   ├── database.js              # 🗄️  数据库: 建表、迁移、辅助查询
│   ├── middleware.js            # 🔐 中间件: JWT认证、管理员权限
│   ├── upload.js                # 📎 上传: multer 存储策略
│   ├── push-service.js          # 🔔 推送: Web Push 发送逻辑
│   ├── socket.js                # 🔌 Socket: 实时消息、在线状态、接龙
│   └── routes/                  # 📡 API 路由 (每个文件独立可测)
│       ├── auth.js              #    登录 / 注册 / 改密码
│       ├── channels.js          #    频道 CRUD / 成员管理
│       ├── messages.js          #    消息获取 / 文件上传
│       ├── settings.js          #    外观 / 通知 / 时区
│       ├── users.js             #    用户增删查 (管理员)
│       ├── push.js              #    推送订阅 / 取消
│       ├── backup.js            #    备份导出 / 还原
│       └── admin-files.js       #    管理员: 聊天附件 + 墙纸库管理
│
└── public/                      # ====== 前端 (Vue 3 CDN SPA) ======
    ├── index.html               # 📄 入口 HTML (加载所有 CSS/JS)
    ├── sw.js                    # 🔧 Service Worker (PWA离线 + 推送)
    ├── manifest.json            # 📱 PWA 清单
    ├── images/                  # 🖼️  图标和默认头像
    │   └── default-avatar.svg
    ├── css/                     # 🎨 样式模块
    │   ├── base.css             #    重置 + 全局
    │   ├── login.css            #    登录页
    │   ├── layout.css           #    三栏布局 + 侧边栏 + 成员面板
    │   ├── chat.css             #    消息气泡 + 输入框 + 接龙卡片
    │   ├── modals.css           #    所有弹窗
    │   ├── files-admin.css      #    管理员附件 / 墙纸库专用样式
    │   └── responsive.css       #    响应式断点
    └── js/                      # ⚡ 脚本模块
        ├── emoji.js             #    Emoji: 可扩展表情注册表 (Yahoo Messenger 经典)
        ├── utils.js             #    工具: 转义、时间、清理、emoji 渲染
        ├── store.js             #    状态: Vue reactive 全局状态
        ├── api.js               #    API: 频道/消息/外观加载
        ├── socket-client.js     #    Socket: 客户端连接管理
        ├── push-client.js       #    推送: SW注册 + 订阅管理
        ├── modals/
        │   ├── admin-methods.js         # 管理员弹窗方法集合
        │   └── files-admin-methods.js   # 附件 & 墙纸库方法集
        └── app.js               #    主入口: Vue 组件 + 模板 + 挂载
```

## 🔧 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器 (带文件监控自动重启)
npm run dev

# 3. 或者用辅助脚本 (做了一些常用环境检查 / 清理)
./dev.sh

# 4. 浏览器访问
open http://localhost:3000
```

## 🚀 部署

详见 [`DEPLOY.md`](./DEPLOY.md)。简要:

```bash
# 全新服务器
bash install-from-git.sh

# 已有部署增量更新 (拉取最新 main)
bash update.sh

# 部署指定 tag (推荐生产用法)
bash update.sh v0.3.0
```

## 🐛 分模块调试指南

### 后端调试

| 要调试的功能 | 对应文件 | 调试方法 |
|-------------|---------|---------|
| 登录/注册问题 | `server/routes/auth.js` | 在路由函数中加 `console.log`,用 Postman 测 |
| 频道权限 | `server/routes/channels.js` + `server/database.js` | 检查 `canAccessChannel()` 返回值 |
| 消息发送 | `server/socket.js` | 监听 Socket 事件 `sendMessage`,检查 XSS 清理逻辑 |
| 推送不工作 | `server/push-service.js` + `server/routes/push.js` | 检查 VAPID 密钥和订阅端点 |
| 文件上传 | `server/upload.js` + `server/routes/messages.js` | 检查 multer 配置和文件类型过滤 |
| 附件 / 墙纸管理 | `server/routes/admin-files.js` | 检查批量删除 / 打包下载 / 槽位复用逻辑 |
| 数据库迁移 | `server/database.js` | 检查 migrations 数组和建表语句 |

### 前端调试

| 要调试的功能 | 对应文件 | 调试方法 |
|-------------|---------|---------|
| 样式问题 | `public/css/*.css` | 浏览器 DevTools 定位到具体 CSS 文件 |
| 状态管理 | `public/js/store.js` | 在 Vue Devtools 中观察 store 对象 |
| Socket 连接 | `public/js/socket-client.js` | DevTools Network → WS 标签页 |
| API 调用 | `public/js/api.js` | DevTools Network → XHR 标签页 |
| 通用管理弹窗 | `public/js/modals/admin-methods.js` | 在对应方法加断点 |
| 附件 / 墙纸库弹窗 | `public/js/modals/files-admin-methods.js` | 在对应方法加断点,确认 `modalData` 字段 |
| 消息渲染 | `public/js/utils.js` → `sanitize()` | 测试各种 HTML 输入 |
| Emoji 系统 | `public/js/emoji.js` → `EmojiRegistry` | 控制台执行 `EmojiRegistry.allCodes()` 查看已注册表情;`EmojiRegistry.register({...})` 测试动态扩展 |

## 🎮 后续扩展方向

### 引入在线小游戏互动

推荐在 `public/js/components/` 下新增游戏模块:

```
public/js/components/
├── games/
│   ├── GameLauncher.js    # 游戏启动器 (嵌入聊天消息)
│   ├── TicTacToe.js       # 井字棋
│   ├── DrawGuess.js       # 你画我猜
│   └── QuizGame.js        # 知识竞答
```

通过 Socket.IO 的 room 机制实现实时对战:
- 后端: `server/routes/games.js` + socket 事件
- 前端: 游戏组件通过 `socket.emit('gameAction', ...)` 交互

### 视觉现代化方向

1. **CSS 变量系统**: 在 `base.css` 中定义 `--primary`, `--bg`, `--text` 等变量
2. **动画**: 添加 `css/animations.css` (消息滑入、按钮反馈)
3. **组件化**: 逐步将 app.js 中的模板拆为独立 Vue 组件文件

## 📝 从旧版迁移

旧版 (bushu-43.sh) 的数据库 `database.sqlite` 完全兼容。
只需将数据库文件复制到项目根目录即可。

## 📋 模块依赖关系

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

## 📜 版本历史

详见 [`CHANGELOG.md`](./CHANGELOG.md)。
