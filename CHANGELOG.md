# Changelog

本文件记录每个版本的变更内容。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/)。

## [v0.1.0] - 2026-04-18

> 基线版本 — 从 bushu-43.sh 单文件脚本迁移为 GitHub 仓库管理的模块化项目。

### Added
- 项目模块化拆分：后端 Express + Socket.IO 按职责拆分为 config / database / middleware / routes / socket 等模块
- 前端 Vue 3 CDN SPA，CSS 和 JS 按功能拆为独立文件
- PWA 支持：Service Worker + manifest.json + Web Push 推送
- 频道系统：CRUD、成员管理、权限控制
- 实时消息：Socket.IO 消息收发、在线状态、接龙功能
- 文件上传：multer 存储 + 文件类型过滤
- 用户管理：JWT 认证、管理员权限、注册 / 登录 / 改密码
- 备份系统：数据库导出与还原
- 部署工具：install-from-git.sh（全新安装）、update.sh（增量更新）、DEPLOY.md 部署指南
- 多实例支持：同一台服务器可部署多个独立实例

### Notes
- 数据库 `database.sqlite` 与旧版 bushu-43.sh 完全兼容，直接复制即可迁移
