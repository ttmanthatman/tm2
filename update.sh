#!/bin/bash
#===============================================================================
# TeamChat 服务器端更新脚本 (增强版)
# 用法:
#   sudo bash update.sh              拉取 main 最新代码并重启
#   sudo bash update.sh v0.2.0       部署指定 tag 版本
#   sudo bash update.sh --all        更新所有实例 (最新 main)
#
# 新增功能 (相比原版):
#   - 支持按 git tag 部署指定版本
#   - 每次部署自动记录到 .deploy-log (时间、commit、信息)
#   - 部署前后显示版本变化对比
#
# 不动: 数据库 / uploads / avatars / backgrounds / .jwt_secret / .vapid_keys
#===============================================================================

set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[1;31m'; CYAN='\033[0;36m'; NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请用 sudo 或 root 运行${NC}"; exit 1
fi

# ----- 解析参数 -----
DEPLOY_TAG=""
TARGETS=()

if [ "$1" = "--all" ]; then
  for d in /var/www/teamchat /var/www/teamchat-*; do
    [ -d "$d/.git" ] && TARGETS+=("$d")
  done
  if [ ${#TARGETS[@]} -eq 0 ]; then
    echo -e "${RED}未找到任何 git 部署的实例${NC}"; exit 1
  fi
elif [ -n "$1" ] && [[ "$1" == v* ]]; then
  # 参数以 v 开头视为 tag
  DEPLOY_TAG="$1"
  if [ -d "$(pwd)/.git" ]; then TARGETS=("$(pwd)"); else TARGETS=("/var/www/teamchat"); fi
elif [ -n "$1" ]; then
  TARGETS=("$1")
else
  if [ -d "$(pwd)/.git" ]; then TARGETS=("$(pwd)"); else TARGETS=("/var/www/teamchat"); fi
fi

update_one() {
  local DIR="$1"
  local NAME
  NAME=$(basename "$DIR")

  echo ""
  echo -e "${CYAN}━━━ 更新 $NAME ($DIR) ━━━${NC}"

  if [ ! -d "$DIR/.git" ]; then
    echo -e "${RED}[$NAME] 不是 git 仓库,跳过。请先用 install-from-git.sh 重新部署或手动 git clone${NC}"
    return 1
  fi

  cd "$DIR"

  # 记录更新前的版本
  local OLD_SHA
  OLD_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  local OLD_DESC
  OLD_DESC=$(git describe --tags --always 2>/dev/null || echo "$OLD_SHA")

  # 安全网: 备份数据库 (保留最近 7 份)
  if [ -f database.sqlite ]; then
    mkdir -p .backups
    cp database.sqlite ".backups/database.$(date +%Y%m%d-%H%M%S).sqlite"
    ls -1t .backups/database.*.sqlite 2>/dev/null | tail -n +8 | xargs -r rm -f
    echo -e "${GREEN}✓ 数据库已备份到 .backups/${NC}"
  fi

  # 拉代码
  echo -e "${YELLOW}→ git fetch${NC}"
  git fetch --all --prune --tags

  if [ -n "$DEPLOY_TAG" ]; then
    # --- 按 tag 部署 ---
    if ! git rev-parse "tags/$DEPLOY_TAG" >/dev/null 2>&1; then
      echo -e "${RED}❌ tag $DEPLOY_TAG 不存在!${NC}"
      echo "可用的 tag:"
      git tag --sort=-version:refname | head -10
      return 1
    fi
    echo -e "${YELLOW}→ 切换到 tag: $DEPLOY_TAG${NC}"
    git checkout "tags/$DEPLOY_TAG" --detach
  else
    # --- 按分支部署 (默认 main) ---
    local BRANCH
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    [ "$BRANCH" = "HEAD" ] && BRANCH="main"
    git reset --hard "origin/$BRANCH"
    echo -e "${GREEN}✓ 已切到 $BRANCH 最新${NC}"
  fi

  local NEW_SHA
  NEW_SHA=$(git rev-parse --short HEAD)
  local NEW_DESC
  NEW_DESC=$(git describe --tags --always 2>/dev/null || echo "$NEW_SHA")

  # 显示版本变化
  if [ "$OLD_SHA" != "$NEW_SHA" ]; then
    echo -e "${CYAN}   版本变化: $OLD_DESC → $NEW_DESC${NC}"
    echo -e "${CYAN}   变更内容:${NC}"
    git log --oneline "$OLD_SHA..$NEW_SHA" 2>/dev/null | head -10 | sed 's/^/   /'
  else
    echo -e "${GREEN}✓ 代码无变化 ($NEW_DESC)${NC}"
  fi

  # 装依赖 (只在 package.json 或 lock 变化时跑)
  if [ ! -d node_modules ] || \
     [ package.json -nt node_modules ] || \
     ([ -f package-lock.json ] && [ package-lock.json -nt node_modules ]); then
    echo -e "${YELLOW}→ npm install${NC}"
    npm install --omit=dev --no-audit --no-fund
  else
    echo -e "${GREEN}✓ 依赖无变化,跳过 npm install${NC}"
  fi

  # 重启 pm2
  local PM2NAME="$NAME"
  echo -e "${YELLOW}→ pm2 restart $PM2NAME${NC}"
  if pm2 describe "$PM2NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2NAME"
  else
    echo -e "${RED}⚠ PM2 进程 $PM2NAME 不存在，尝试 start${NC}"
    pm2 start server/server.js --name "$PM2NAME"
  fi

  # 健康检查
  sleep 2
  if pm2 describe "$PM2NAME" 2>/dev/null | grep -q "online"; then
    echo -e "${GREEN}✓ $PM2NAME 运行正常${NC}"
  else
    echo -e "${RED}⚠ $PM2NAME 状态异常，请检查: pm2 logs $PM2NAME${NC}"
  fi

  # ===== 记录部署日志 =====
  local DEPLOY_LOG="$DIR/.deploy-log"
  local LOG_LINE
  LOG_LINE="$(date '+%Y-%m-%d %H:%M:%S') | $OLD_DESC → $NEW_DESC | $(git log -1 --format='%s')"
  echo "$LOG_LINE" >> "$DEPLOY_LOG"
  echo -e "${GREEN}✓ 部署记录已写入 .deploy-log${NC}"

  echo -e "${GREEN}━━━ $NAME 更新完成 ($NEW_DESC) ━━━${NC}"
}

# ----- 执行 -----
for TARGET in "${TARGETS[@]}"; do
  update_one "$TARGET"
done

echo ""
echo -e "${GREEN}全部完成 ✅${NC}"
