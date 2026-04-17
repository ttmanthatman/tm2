# 部署与更新指南

## 你已有的服务器(从老 bushu-43.sh 装的) → 切换到 git 模式

老脚本是把代码全 inline 在 shell 里的,要切到 GitHub 部署需要把现有目录"git 化"一次。**整个过程不丢数据**——`database.sqlite`、`uploads/`、`avatars/`、`backgrounds/`、`.jwt_secret`、`.vapid_keys` 全部保留。

```bash
cd /var/www/teamchat            # 或你的实例目录,例如 /var/www/teamchat-foo
sudo pm2 stop teamchat          # 多实例就用对应 pm2 名字

# 备份(双保险)
sudo cp -r . /root/teamchat-backup-$(date +%Y%m%d)

# 把现有目录变成 git 工作区,但不动数据文件
sudo git init
sudo git remote add origin https://github.com/ttmanthatman/tm2.git
sudo git fetch origin

# 关键: 把仓库代码覆盖到当前目录,但保留数据
# .gitignore 必须包含数据文件,否则会被覆盖(见下方)
sudo git checkout -f origin/main -- .

# 装新依赖(因为加了 archiver)
sudo npm install --omit=dev

# 把 server/config.js 里的端口占位符替换成真实端口
# (老安装是 inline 写的,新代码用占位符)
sudo sed -i "s/__PORT_PLACEHOLDER__/3000/g" server/config.js   # 把 3000 改成你实际的端口

sudo pm2 restart teamchat
```

完成后,**之后每次更新只要一行**:

```bash
cd /var/www/teamchat && sudo bash update.sh
```


## 全新服务器 → 一行安装

```bash
curl -fsSL https://raw.githubusercontent.com/ttmanthatman/tm2/main/install-from-git.sh | sudo bash
```

或者环境变量定制:

```bash
APP_DIR=/var/www/teamchat-prod PORT=3001 PM2_NAME=teamchat-prod \
  bash install-from-git.sh
```


## 日常更新流程

```
本地改代码  →  git push  →  ssh 到服务器  →  cd /var/www/teamchat && sudo bash update.sh
```

`update.sh` 会:
1. **自动备份**当前数据库到 `.backups/` (保留最近 7 份)
2. `git fetch + reset --hard origin/<branch>` (放弃服务器上任何本地改动)
3. **只在 package.json 变了**才跑 `npm install`
4. `pm2 restart` + 健康检查

更新所有实例:
```bash
sudo bash update.sh --all
```


## 关键: `.gitignore` 必须保护数据

仓库根目录必须有 `.gitignore`,否则 `git pull` 会把服务器上的数据覆盖掉。最少要包含:

```
node_modules/
database.sqlite
database.sqlite-*
.jwt_secret
.vapid_keys
uploads/
avatars/
backgrounds/
.backups/
*.log
.DS_Store
```

**注意**: 你需要在仓库里加这个文件并 push。如果服务器上之前的目录里已经被误推过这些文件,需要先 `git rm --cached <file>` 再 push。


## 回滚

如果新版本有问题:

```bash
cd /var/www/teamchat
sudo git log --oneline -10               # 找到上一个 commit
sudo git reset --hard <上一个commit-sha>
sudo npm install --omit=dev              # 如果依赖也降了
sudo pm2 restart teamchat
```

数据库回滚(如果改过表结构):
```bash
sudo pm2 stop teamchat
sudo cp .backups/database.20260417-143022.sqlite database.sqlite
sudo pm2 start teamchat
```


## 端口占位符的事

`server/config.js` 里有一行:
```js
const PORT = process.env.PORT || __PORT_PLACEHOLDER__;
```

这是为部署脚本预留的注入点。两种处理方式 —— 选其一:

**方案 A (推荐):** 把仓库里这行改成默认 3000:
```js
const PORT = process.env.PORT || 3000;
```
然后通过 pm2 的环境变量传入实际端口: `PORT=3001 pm2 start ...` 或 ecosystem 配置。

**方案 B:** 部署/更新脚本里 sed 替换。但这样每次 `git pull` 会把它拉成占位符,update.sh 必须每次再 sed 一遍 —— 比较脆弱。

`update.sh` 里**没有**自动 sed,因为长期看应该改成方案 A。


## 多实例

老脚本支持 `/var/www/teamchat-foo`、`/var/www/teamchat-bar` 多实例。新方案完全兼容:

```bash
# 创建第二个实例
APP_DIR=/var/www/teamchat-staging PORT=3002 PM2_NAME=teamchat-staging \
  bash install-from-git.sh

# 一起更新
sudo bash update.sh --all
```


## 推荐工作流

1. 本地开发 → `git push`
2. 服务器 ssh → `cd /var/www/teamchat && sudo bash update.sh`
3. 出错 → `pm2 logs teamchat --lines 100`
4. 严重问题 → `git reset --hard <prev-sha> && sudo bash update.sh`

如果你想更进一步(可选,未来再做):
- **GitHub Actions 自动部署**: push 后通过 ssh 自动触发服务器上的 `update.sh`
- **健康检查 webhook**: 部署后自动 curl `/api/...` 验证
- **蓝绿部署**: 多实例切流量做零停机
