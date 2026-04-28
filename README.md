# TeamChat

> 一个会"活"起来的聊天平台 —— 不只是和人聊天，还能和拥有独立人格的 AI 虚拟人物互动。

TeamChat 是一个基于 Vue 3 + Express + Socket.IO 的实时聊天应用，但它的真正特色不在"聊天"本身，而在于群聊里那些**有自己性格、会被你影响、还会主动找你说话**的 AI 虚拟人物。

---

## ✨ 核心特色：AI 虚拟人物

### 🎭 每个人物都有独立人格

每个 AI 虚拟人物都拥有完整的角色设定 —— 性格、说话风格、兴趣爱好、价值观、人际关系。它们不是千篇一律的"AI 助手",而是各有脾气、各有偏好的"人"。在群聊里,它们会以符合自己人设的方式参与讨论,而不是机械地回答问题。

### 🌱 性格会随聊天演化

人物不是静态的剧本。它们会**记住和你的对话,并被这些经历影响**:

- 经常和某个用户互动,会逐渐熟络,语气变得亲近
- 在群里被反复调侃某个话题,会形成"梗"
- 经历过某些事件,性格会朝特定方向微调
- 长期不被搭理的人物,会有自己的反应

简单说,你今天遇到的角色,和半年后的它,可能已经不是同一个"人"了。

### 🔔 人物会主动发起事件

虚拟人物不是只在被 @ 的时候才出现。它们会:

- **主动开话题** —— 早上发个早安、看到新闻吐槽两句、想起之前聊过的事再提一次
- **触发剧情事件** —— 突发奇想发起一个小游戏、抛出一个困扰、邀请你一起做点什么
- **彼此互动** —— 不同人物之间也会聊天、争论、形成关系链

群聊不再是"等你说话"的死水,而是一个有自己节奏的小社区。

---

## 🚧 正在完善的功能

以下能力正在迭代中,欢迎关注进展:

### 🧬 人格模拟矩阵
将人物的性格、记忆、偏好、关系网拆解为可量化的多维矩阵,让人格变化有迹可循、可调可控。每一次对话都会在矩阵上留下印记,从而真正实现"会成长的角色"。

### 🎙️ 语音消息
让虚拟人物开口说话。不同人物拥有不同音色,语音消息会与其性格、情绪状态相匹配,让互动从文字升级到听觉。

### 🎬 场景互动
人物不再只活在聊天框里。引入场景概念后,你可以和角色一起"去某个地方"、"做某件事",在特定情境下触发专属对话和事件。

### 📜 历史背景设定
为人物构建完整的世界观与时间线 —— 从他们的过去、所处的世界、彼此的关系,到正在发生的"故事"。让每个角色都有可挖掘的深度,而不是只有当下的一句台词。

---

## 🛠 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3 (CDN) · 原生 CSS · Service Worker (PWA) |
| 后端 | Node.js · Express · Socket.IO |
| 数据 | SQLite |
| 实时 | WebSocket (Socket.IO) |
| 推送 | Web Push (VAPID) |

---

## 📂 项目结构

```
teamchat/
├── package.json
├── server/                    # 后端 (Express + Socket.IO)
│   ├── server.js              # 主入口:中间件 + 路由 + Socket 组装
│   ├── config.js              # 端口、密钥、路径、常量
│   ├── database.js            # 建表、迁移、查询辅助
│   ├── middleware.js          # JWT 认证、管理员权限
│   ├── upload.js              # multer 上传策略
│   ├── push-service.js        # Web Push 发送
│   ├── socket.js              # 实时消息、在线状态、人物事件分发
│   └── routes/
│       ├── auth.js            # 登录 / 注册 / 改密
│       ├── channels.js        # 频道与成员管理
│       ├── messages.js        # 消息与文件
│       ├── settings.js        # 外观 / 通知 / 时区
│       ├── users.js           # 用户管理(管理员)
│       ├── push.js            # 推送订阅
│       └── backup.js          # 备份与恢复
│
└── public/                    # 前端 (Vue 3 SPA)
    ├── index.html
    ├── sw.js                  # Service Worker (离线 + 推送)
    ├── manifest.json          # PWA 清单
    ├── images/
    ├── css/
    │   ├── base.css
    │   ├── login.css
    │   ├── layout.css
    │   ├── chat.css
    │   ├── modals.css
    │   └── responsive.css
    └── js/
        ├── utils.js
        ├── store.js           # Vue reactive 全局状态
        ├── api.js
        ├── socket-client.js
        ├── push-client.js
        ├── modals/
        │   └── admin-methods.js
        └── app.js             # Vue 主入口
```

---

## 🔧 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器(自动重启)
npm run dev

# 3. 访问
open http://localhost:3000
```

部署相关参考 [DEPLOY.md](./DEPLOY.md),一键脚本见 `install-from-git.sh`。

---

## 🐛 调试指引

### 后端

| 调试目标 | 文件 |
| --- | --- |
| 登录 / 注册 | `server/routes/auth.js` |
| 频道权限 | `server/routes/channels.js` + `server/database.js` |
| 消息收发 | `server/socket.js` |
| 推送 | `server/push-service.js` + `server/routes/push.js` |
| 文件上传 | `server/upload.js` + `server/routes/messages.js` |
| 数据库迁移 | `server/database.js` |

### 前端

| 调试目标 | 文件 |
| --- | --- |
| 样式 | `public/css/*.css` |
| 状态管理 | `public/js/store.js` (用 Vue Devtools 观察) |
| Socket 连接 | `public/js/socket-client.js` (DevTools → WS) |
| API 调用 | `public/js/api.js` (DevTools → XHR) |
| 管理弹窗 | `public/js/modals/admin-methods.js` |
| 消息渲染 / 安全过滤 | `public/js/utils.js` → `sanitize()` |

---

## 📝 从旧版迁移

旧版本(基于 `bushu-43.sh`)的 `database.sqlite` 完全兼容,直接将数据库文件复制到项目根目录即可启动。

---

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

---

## 🗺️ Roadmap

- [x] 模块化重构 (v9.x)
- [x] AI 虚拟人物基础人格系统
- [x] 人物主动事件触发
- [ ] 人格模拟矩阵(进行中)
- [ ] 语音消息(进行中)
- [ ] 场景互动(进行中)
- [ ] 历史背景与世界观系统(进行中)
- [ ] 人物之间的关系网与多角剧情
- [ ] 人物记忆的可视化与手动调节

---

## License

参见仓库根目录(如未提供则保留所有权利)。
