# Changelog

本文件记录每个版本的变更内容。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/)。

## [Unreleased]

### Added
- 管理员文件管理:聊天附件列表 / 批量删除 / 批量打包下载(`server/routes/admin-files.js`)
- 管理员墙纸库:墙纸视频列表(含被引用槽位) / 复用到指定槽位 / 批量删除(`server/routes/admin-files.js`)
- 前端管理员附件 & 墙纸库方法集,混入主 Vue 组件(`public/js/modals/files-admin-methods.js`)
- 附件管理 / 墙纸库专用样式(`public/css/files-admin.css`)
- 管理员用户导入/导出:批量导入用户 JSON(含预览、勾选、冲突跳过)、导出全部用户数据,兼容旧版 TeamChat 格式(`server/routes/users.js`)

### Changed
- 统一版本号至 v0.1.0:`package.json` 与 `README.md` 中残留的旧版本号 9.1.0 已修正

## [v0.1.1] - 2026-04-18
- fix: 聊天背景图片/视频改为挂在 .messages-wrapper 上，防止跟消息一起滚动

### Changed
- Added: dev.sh 新增 put（带备份复制文件）、quickfix（一键修复流程）、undo（撤销 commit）、rollback（版本回退）、retag（重命名 tag）、tags（列出版本）、diff（预览改动）
- Improved: save 增加空提交检测、deploy 增加 tag 存在性校验、关键操作增加确认提示

## [v0.1.0] - 2026-04-18

> 基线版本 — 从 bushu-43.sh 单文件脚本迁移为 GitHub 仓库管理的模块化项目。

### Added
- 项目模块化拆分:后端 Express + Socket.IO 按职责拆分为 config / database / middleware / routes / socket 等模块
- 前端 Vue 3 CDN SPA,CSS 和 JS 按功能拆为独立文件
- PWA 支持:Service Worker + manifest.json + Web Push 推送
- 频道系统:CRUD、成员管理、权限控制
- 实时消息:Socket.IO 消息收发、在线状态、接龙功能
- 文件上传:multer 存储 + 文件类型过滤
- 用户管理:JWT 认证、管理员权限、注册 / 登录 / 改密码
- 备份系统:数据库导出与还原
- 部署工具:install-from-git.sh(全新安装)、update.sh(增量更新)、DEPLOY.md 部署指南
- 多实例支持:同一台服务器可部署多个独立实例

### Notes
- 数据库 `database.sqlite` 与旧版 bushu-43.sh 完全兼容,直接复制即可迁移
