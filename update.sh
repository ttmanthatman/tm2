#!/bin/bash
#===============================================================================
# TeamChat 服务器端更新脚本
# 用法: 在 /var/www/teamchat (或任意已部署实例目录) 执行:
#   sudo bash update.sh                        # 更新当前目录(默认实例)
#   sudo bash update.sh /var/www/teamchat-foo  # 更新指定实例
#   sudo bash update.sh --all                  # 更新所有实例
#
# 该脚本只做:  git pull  →  npm install  →  pm2 restart
# 不动: 数据库 / uploads / avatars / backgrounds / .jwt_secret / .vapid_keys
#===============================================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[1;31m'; CYAN='\033[0;36m'; NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请用 sudo 或 root 运行${NC}"; exit 1
fi

# ----- 解析目标 -----
TARGETS=()
if [ "$1" = "--all" ]; then
  for d in /var/www/teamchat /var/www/teamchat-*; do
    [ -d "$d/.git" ] && TARGETS+=("$d")
  done
  if [ ${#TARGETS[@]} -eq 0 ]; then
    echo -e "${RED}未找到任何 git 部署的实例${NC}"; exit 1
  fi
elif [ -n "$1" ]; then
  TARGETS=("$1")
else
  # 默认: 当前目录,如果不是 git 仓库则用 /var/www/teamchat
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

  # 安全网: 备份数据库 (保留最近 7 份)
  if [ -f database.sqlite ]; then
    mkdir -p .backups
    cp database.sqlite ".backups/database.$(date +%Y%m%d-%H%M%S).sqlite"
    ls -1t .backups/database.*.sqlite 2>/dev/null | tail -n +8 | xargs -r rm -f
    echo -e "${GREEN}✓ 数据库已备份到 .backups/${NC}"
  fi

  # 拉代码
  echo -e "${YELLOW}→ git fetch & reset${NC}"
  git fetch --all --prune
  local BRANCH
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  [ "$BRANCH" = "HEAD" ] && BRANCH="main"
  git reset --hard "origin/$BRANCH"
  local SHA
  SHA=$(git rev-parse --short HEAD)
  echo -e "${GREEN}✓ 已切到 $BRANCH @ $SHA${NC}"

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
  # PM2 名称约定: 默认实例叫 teamchat,多实例叫 teamchat-<suffix> (= 目录名)
  local PM2NAME="$NAME"
  echo -e "${YELLOW}→ pm2 restart $PM2NAME${NC}"
  if pm2 describe "$PM2NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2NAME" --update-env
  else
    # 第一次或被删过,根据目录里的 server/server.js 启动
    local ENTRY="server/server.js"
    [ -f server.js ] && ENTRY="server.js"  # 兼容老布局
    local PORT
    PORT=$(grep -oP 'PORT\s*=\s*process\.env\.PORT\s*\|\|\s*\K\d+' "$ENTRY" 2>/dev/null || echo "3000")
    PORT=$PORT pm2 start "$ENTRY" --name "$PM2NAME"
  fi
  pm2 save >/dev/null

  # 健康检查
  sleep 2
  if pm2 describe "$PM2NAME" 2>/dev/null | grep -q "status.*online"; then
    echo -e "${GREEN}✅ [$NAME] 更新完成 → $SHA${NC}"
  else
    echo -e "${RED}⚠️  [$NAME] 进程未在线,请检查: pm2 logs $PM2NAME --lines 50${NC}"
    return 1
  fi
}

FAIL=0
for t in "${TARGETS[@]}"; do
  update_one "$t" || FAIL=$((FAIL+1))
done

echo ""
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 全部 ${#TARGETS[@]} 个实例更新完成${NC}"
else
  echo -e "${RED}⚠️  ${#TARGETS[@]} 个实例中 $FAIL 个失败${NC}"; exit 1
fi
