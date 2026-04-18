#!/bin/bash
#===============================================================================
# dev.sh — 开发辅助脚本
# 用法:
#   ./dev.sh new   feat/xxx        创建新功能分支
#   ./dev.sh save  "commit msg"    快速 add + commit + push
#   ./dev.sh done  v0.2.0          合并当前分支到 main 并打 tag
#   ./dev.sh deploy                SSH 到 VPS 执行 update.sh
#   ./dev.sh deploy v0.2.0         SSH 到 VPS 部署指定 tag
#   ./dev.sh log                   查看简洁提交历史
#   ./dev.sh status                查看当前分支和状态
#===============================================================================

set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[1;31m'; NC='\033[0m'

# ===== 配置区 — 根据你的环境修改 =====
VPS_HOST="45.62.123.222"    # 改成你的 VPS 地址
VPS_DIR="/var/www/teamchat-test"           # VPS 上的部署目录
VPS_USER="root"                       # SSH 用户名
# =====================================

case "$1" in

  #--- 创建新功能分支 ---
  new)
    if [ -z "$2" ]; then
      echo -e "${RED}用法: ./dev.sh new feat/xxx${NC}"; exit 1
    fi
    git checkout main
    git pull origin main
    git checkout -b "$2"
    echo -e "${GREEN}✅ 已从 main 创建分支: $2${NC}"
    ;;

  #--- 快速保存 ---
  save)
    if [ -z "$2" ]; then
      echo -e "${RED}用法: ./dev.sh save \"feat: 你的提交信息\"${NC}"; exit 1
    fi
    BRANCH=$(git branch --show-current)
    git add -A
    git commit -m "$2"
    git push origin "$BRANCH"
    echo -e "${GREEN}✅ 已提交并推送到 $BRANCH${NC}"
    echo -e "   $(git rev-parse --short HEAD) $2"
    ;;

  #--- 功能完成，合并回 main ---
  done)
    if [ -z "$2" ]; then
      echo -e "${RED}用法: ./dev.sh done v0.2.0${NC}"; exit 1
    fi
    BRANCH=$(git branch --show-current)
    if [ "$BRANCH" = "main" ]; then
      echo -e "${RED}❌ 你已经在 main 上了，请先切到功能分支${NC}"; exit 1
    fi

    echo -e "${YELLOW}→ 合并 $BRANCH 到 main，标记 $2${NC}"

    # 先确保功能分支是最新的
    git push origin "$BRANCH"

    # 切到 main 并合并
    git checkout main
    git pull origin main
    git merge "$BRANCH" --no-ff -m "merge: $BRANCH → main ($2)"

    # 打 tag
    git tag -a "$2" -m "Release $2"

    # 推送
    git push origin main --tags

    # 清理远程和本地分支
    git push origin --delete "$BRANCH" 2>/dev/null || true
    git branch -d "$BRANCH"

    echo ""
    echo -e "${GREEN}✅ 完成!${NC}"
    echo -e "   分支 $BRANCH 已合并到 main"
    echo -e "   标签 $2 已创建并推送"
    echo -e "   分支 $BRANCH 已删除"
    echo ""
    echo -e "${YELLOW}⚠️  别忘了更新 CHANGELOG.md !${NC}"
    echo -e "   然后: ./dev.sh save \"docs: 更新 CHANGELOG for $2\""
    ;;

  #--- 部署到 VPS ---
  deploy)
    TAG_ARG=""
    if [ -n "$2" ]; then
      TAG_ARG="$2"
      echo -e "${YELLOW}→ 部署 tag $2 到 $VPS_HOST:$VPS_DIR${NC}"
    else
      echo -e "${YELLOW}→ 部署最新 main 到 $VPS_HOST:$VPS_DIR${NC}"
    fi
    ssh "$VPS_USER@$VPS_HOST" "cd $VPS_DIR && sudo bash update.sh $TAG_ARG"
    echo -e "${GREEN}✅ 部署完成${NC}"
    ;;

  #--- 查看日志 ---
  log)
    echo ""
    git log --oneline --graph --all --decorate -20
    echo ""
    ;;

  #--- 查看状态 ---
  status)
    BRANCH=$(git branch --show-current)
    echo -e "分支: ${GREEN}$BRANCH${NC}"
    echo -e "最新 tag: $(git describe --tags --abbrev=0 2>/dev/null || echo '无')"
    echo ""
    git status -s
    ;;

  #--- 帮助 ---
  *)
    echo ""
    echo "TeamChat 开发辅助脚本"
    echo ""
    echo "用法: ./dev.sh <命令> [参数]"
    echo ""
    echo "  new   <分支名>       创建新功能分支 (从 main)"
    echo "  save  \"提交信息\"     add + commit + push 当前分支"
    echo "  done  <版本号>       合并当前分支到 main 并打 tag"
    echo "  deploy [版本号]      部署到 VPS (可选指定 tag)"
    echo "  log                  查看提交历史"
    echo "  status               查看当前分支和状态"
    echo ""
    echo "示例:"
    echo "  ./dev.sh new feat/your-feature"
    echo "  ./dev.sh save \"feat: 描述这次改动\""
    echo "  ./dev.sh done v0.2.0"
    echo "  ./dev.sh deploy v0.2.0"
    echo ""
    ;;
esac
