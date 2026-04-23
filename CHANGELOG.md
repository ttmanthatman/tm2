# Changelog

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/)。

## [Unreleased]

## [v0.4.3]
- 新增: 管理员可在「外观定制 → 💬 气泡样式」中自定义气泡颜色和效果
- 新增: 扁平 (Flat) — 纯色气泡，可自定义我方/对方颜色
- 新增: 2D 单泡渐变 — 每个气泡自身有渐变，可调角度
- 新增: 2D 整体渐变 — 颜色沿聊天视口方向流动 (background-attachment: fixed)
- 新增: 3D 宫崎骏 — 卡通风格立体着色 (高光/阴影/镜面反射)，可调强度
- 修复: 3D 模式使用统一边框色，避免圆角拐弯处颜色断裂
- 管理面板内置实时气泡预览，调色时即时可见效果

## [v0.4.2]
- 修复：取消录音时增加 _cancelled 标志位，onstop 回调检查该标志，彻底阻止上传
- 修复：语音录制自动检测实际 MIME 类型并使用正确扩展名，支持 iOS Safari 的 mp4 录制
- 修复：后端 fileFilter 增加 audio/mp4 和 audio/aac 支持
- 修复：语音静态服务增加正确的 Content-Type 头

## [v0.4.1]
- ✨ 新增 @提及自动补全：输入 @ 弹出成员列表，支持模糊搜索、键盘↑↓选择
- ✨ 被 @ 的消息气泡显示彩虹跑马灯边框
- 🗑️ 移除气泡立体感功能（2D/3D/平面切换），精简代码

## [v0.4.0]
- 语音消息 — 录音/播放/管理员删除/批量导入导出
## [v0.3.5]
- 输入栏重构为微信风格布局：[🎙 语音] [输入框] [😊 表情] [➕/发送]
- 语音按钮预留（点击提示"开发中"）
- 新增加号菜单，收纳换行、接龙、文件上传功能
- 加号按钮与发送按钮并排显示
- 输入栏背景改为微信同款浅灰 #f7f7f8，发送按钮改为微信绿 #07c160

## [v0.3.4]
- 频道权限面板切换时未清除旧成员数据，导致 nonMembers 下拉列表遗漏用户
- doCreateChannel 未等待 loadAllChannels 完成，可能导致频道列表状态不一致
- 版本号又弄错了，囧
- 修复私有频道消息泄漏、认证缺陷及多项安全/功能 bug

### Fixed
- 🔴 iPhone Safari 首次加载壁纸不显示，刷新后才正常 — initSW 不再阻塞 loadAppearance
- 🟠 登录页→聊天页切换后壁纸不生效 — enterChat 切页后 nextTick 重新 applyAppearance
- 🟡 冷启动弱网下无壁纸闪白 — 外观配置增加 localStorage 缓存，先用缓存立即渲染
- 🟡 iOS Safari 偶尔 JS 设置 background-image 不触发 repaint — 加 translateZ(0) 强制合成层刷新
- 🟡 挂载尾部 applyAppearance(store.appearance) 空调用 — 删除（此时 store.appearance 为 {}）

## [v0.3.1] - 2026-04-20

### Added
- Emoji 选择器替换为 93 个 Yahoo Messenger 经典 GIF 动画表情 (表情/动作/物品三分类)
- 管理员可通过右键菜单删除单条消息 (`DELETE /api/messages/:id`)，实时同步全端

### Changed
- Emoji shortcode 从符号式 (`:)` `B-)`) 改为命名式 (`:smile:` `:sunglasses:`)
- Emoji 图片从内联 SVG data URI 改为外部 GIF 资源
- 默认 emoji 分类从 `classic` 改为 `face`

### Notes
- 旧消息中的旧 shortcode 不再渲染为图片，显示为纯文本

## [v0.3.0] - 2026-04-19

### Added
- 管理员文件管理：聊天附件列表 / 批量删除 / 批量打包下载 (`server/routes/admin-files.js`)
- 管理员墙纸库：墙纸视频列表 (含被引用槽位) / 复用到指定槽位 / 批量删除
- 前端管理员附件 & 墙纸库方法集 (`public/js/modals/files-admin-methods.js`)
- 附件管理 / 墙纸库专用样式 (`public/css/files-admin.css`)
- 管理员用户导入/导出：批量导入 JSON (含预览、勾选、冲突跳过)、导出全部用户数据
- 自定义 Emoji 系统：`EmojiRegistry` 可扩展注册表 (`public/js/emoji.js`)，支持 `register()` / `registerBatch()` / `addCategory()` 动态扩充
- Emoji 选择器：输入栏新增按钮，弹出分类选择面板，点击插入 shortcode
- 消息动画：果冻弹性滑入 / 在线用户气泡水波微动，可在设置面板开关
- 气泡立体感：三挡切换 — 平面 / 2D 投影 / 3D 渐变拟物
- 设置面板新增「动画效果」区域

### Changed
- 统一版本号至 v0.3.0

### Fixed
- 消息气泡尖角方向修正
- 页面缩放禁止加固 (`overscroll-behavior:none`, `touch-action:pan-y`)
- `sanitize()` 重构避免两条 return 路径遗漏 emoji 替换

## [v0.1.1] - 2026-04-18

### Fixed
- 聊天背景图片/视频改为挂在 `.messages-wrapper` 上，防止跟消息一起滚动

### Changed
- `dev.sh` 新增 put / quickfix / undo / rollback / retag / tags / diff 等快捷命令
- save 增加空提交检测、deploy 增加 tag 存在性校验

## [v0.1.0] - 2026-04-18

> 基线版本 — 从 bushu-43.sh 单文件脚本迁移为 GitHub 仓库管理的模块化项目。

### Added
- 项目模块化拆分：后端 Express + Socket.IO 按职责拆分
- 前端 Vue 3 CDN SPA，CSS/JS 按功能拆为独立文件
- PWA 支持：Service Worker + manifest.json + Web Push
- 频道系统：CRUD、成员管理、权限控制
- 实时消息：Socket.IO 消息收发、在线状态、接龙
- 文件上传：multer 存储 + 类型过滤
- 用户管理：JWT 认证、管理员权限
- 备份系统：数据库导出与还原
- 部署工具：install-from-git.sh / update.sh / DEPLOY.md
- 多实例支持

### Notes
- 数据库 `database.sqlite` 与旧版 bushu-43.sh 完全兼容
