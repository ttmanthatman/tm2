# TeamChat — 多频道团队聊天室

基于 Vue 3 (CDN) + Express + Socket.IO + SQLite 的轻量团队聊天应用。
无需构建工具，前端纯 HTML/CSS/JS，部署只需一台 VPS。

## 功能一览

**聊天核心** — 多频道实时消息、@提及自动补全 (彩虹跑马灯高亮)、文件/图片上传、语音录制与播放、接龙活动

**气泡样式** — 管理员可自定义气泡外观：扁平 / 2D 单泡渐变 / 2D 整体渐变 / 3D 宫崎骏卡通着色，支持自适应高光暗部、渐变描边、五维阴影 (距离/角度/模糊/扩散/颜色)，3D 模式可开启陀螺仪动态光照

**外观定制** — 聊天背景 (纯色/图片/视频)、登录页背景、发送按钮颜色/文字、管理员墙纸库

**用户管理** — JWT 认证、管理员权限、批量用户导入导出

**通知推送** — Web Push (VAPID)、PWA 离线支持

**运维工具** — 数据库备份导出/还原、一键部署脚本、dev.sh 开发辅助

## 项目结构

```
tm2/
├── server/                     # ── 后端 ──
│   ├── server.js               # 主入口
│   ├── config.js               # 配置: 端口、密钥、路径
│   ├── database.js             # SQLite: 建表、迁移、查询
│   ├── middleware.js            # JWT 认证、管理员权限
│   ├── upload.js               # multer 文件上传 (含语音 mp4/aac)
│   ├── push-service.js         # Web Push 推送
│   ├── socket.js               # 实时消息、在线状态、接龙
│   └── routes/
│       ├── auth.js             # 登录 / 注册 / 改密码
│       ├── channels.js         # 频道 CRUD / 成员管理
│       ├── messages.js         # 消息获取 / 文件上传
│       ├── settings.js         # 外观 / 通知 / 时区 / 气泡样式
│       ├── users.js            # 用户增删查
│       ├── push.js             # 推送订阅 / 取消
│       ├── backup.js           # 备份导出 / 还原
│       └── admin-files.js      # 附件 & 墙纸库管理
│
├── public/                     # ── 前端 ──
│   ├── index.html              # 入口 HTML
│   ├── sw.js                   # Service Worker (PWA + 推送)
│   ├── manifest.json           # PWA 清单
│   ├── images/                 # 图标、默认头像
│   ├── emojis/                 # Yahoo Messenger 经典 GIF 表情
│   ├── css/
│   │   ├── base.css            # 重置 + 全局变量
│   │   ├── login.css           # 登录页
│   │   ├── layout.css          # 三栏布局 + 侧边栏 + 成员面板
│   │   ├── chat.css            # 消息气泡 + 气泡CSS变量 + 2D/3D规则
│   │   ├── modals.css          # 弹窗系统
│   │   ├── files-admin.css     # 管理员附件/墙纸库
│   │   ├── responsive.css      # 响应式断点
│   │   └── app-polish.css      # App 质感增强层 (最后加载)
│   └── js/
│       ├── emoji.js            # 可扩展表情注册表
│       ├── utils.js            # 工具函数 (转义/时间/清理)
│       ├── store.js            # Vue reactive 全局状态
│       ├── gyro.js             # 陀螺仪模块 (动态气泡光照)
│       ├── api.js              # API 调用 + 外观应用 + 气泡3D引擎
│       ├── socket-client.js    # Socket.IO 客户端
│       ├── push-client.js      # SW 注册 + 推送订阅
│       ├── app.js              # Vue 主入口 (组件 + 模板 + 挂载)
│       └── modals/
│           ├── admin-methods.js         # 管理员弹窗方法
│           └── files-admin-methods.js   # 附件/墙纸库方法
│
├── dev.sh                      # 开发辅助 (分支/提交/部署/回滚)
├── install-from-git.sh         # 全新服务器一键安装
├── update.sh                   # 增量更新 (支持 tag 部署)
├── DEPLOY.md                   # 部署文档
├── CHANGELOG.md                # 版本变更记录
└── CLAUDE_CONTEXT.md           # AI 辅助开发上下文
```

## 本地开发

```bash
npm install
npm run dev          # 带热重启, 访问 http://localhost:3000
```

## 部署

详见 [DEPLOY.md](./DEPLOY.md)。

```bash
bash install-from-git.sh       # 全新服务器
bash update.sh                 # 增量更新
bash update.sh v0.4.3          # 指定 tag 部署
```

## 开发辅助 (dev.sh)

```bash
./dev.sh put ~/Downloads/api.js public/js/api.js   # 替换文件 (自动备份)
./dev.sh save "fix: 描述"                           # add + commit + push
./dev.sh quickfix v0.x.x "fix: 描述"               # 一键: 分支→提交→合并→打tag
./dev.sh rollback v0.4.3                            # 回退到指定版本
./dev.sh deploy                                     # SSH 部署到 VPS
```

## 旧版迁移

旧版 (bushu-43.sh) 的 `database.sqlite` 完全兼容，直接复制到项目根目录即可。

## 版本历史

详见 [CHANGELOG.md](./CHANGELOG.md)。
