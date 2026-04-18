#!/bin/bash
#===============================================================================
# dev.sh — TeamChat 开发辅助脚本 (v2)
#
# 日常开发:
#   ./dev.sh new   feat/xxx          创建新功能分支
#   ./dev.sh save  "commit msg"      快速 add + commit + push
#   ./dev.sh done  v0.2.0            合并当前分支到 main 并打 tag
#
# 从 Claude 拿到文件后:
#   ./dev.sh put   ~/Downloads/api.js public/js/api.js
#                                     复制文件到项目 (自动备份原文件)
#   ./dev.sh quickfix v0.1.1 "fix: 描述"
#                                     一键: 建分支→提交→合并→打tag→部署
#
# 出错恢复:
#   ./dev.sh undo                     撤销上一次 commit (保留文件改动)
#   ./dev.sh rollback v0.1.0          回退到指定版本
#   ./dev.sh retag v0.2.1 v0.1.1      重命名 tag (远程+本地)
#
# 部署运维:
#   ./dev.sh deploy [版本号]          SSH 部署到 VPS
#   ./dev.sh log                      查看提交历史
#   ./dev.sh status                   查看分支/tag/改动
#   ./dev.sh tags                     列出所有版本 tag
#   ./dev.sh diff                     提交前预览改动
#===============================================================================

set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[1;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ===== 配置区 — 根据你的环境修改 =====
VPS_HOST="45.62.123.222"
VPS_DIR="/var/www/teamchat-test"
VPS_USER="root"
BACKUP_DIR=".backups"          # 本地备份目录 (已 gitignore)
# =====================================

#--- 工具函数 ---
confirm() {
  echo -e "${YELLOW}$1${NC}"
  read -p "确认? [y/N] " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]] || { echo -e "${RED}已取消${NC}"; exit 1; }
}

ensure_clean() {
  if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}⚠️  工作区有未提交的改动:${NC}"
    git status -s
    echo ""
    confirm "继续操作会基于当前脏状态，确定要继续吗?"
  fi
}

backup_file() {
  local file="$1"
  if [ -f "$file" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$file")"
    local ts=$(date +%Y%m%d_%H%M%S)
    cp "$file" "$BACKUP_DIR/${file}.${ts}.bak"
    echo -e "   ${CYAN}📦 已备份: $file → $BACKUP_DIR/${file}.${ts}.bak${NC}"
  fi
}

ensure_gitignore_backup() {
  if ! grep -q "^${BACKUP_DIR}/" .gitignore 2>/dev/null; then
    echo "${BACKUP_DIR}/" >> .gitignore
    echo -e "   ${CYAN}已将 ${BACKUP_DIR}/ 加入 .gitignore${NC}"
  fi
}

# ===================================================================

case "$1" in

  # ============================================================
  # 日常开发
  # ============================================================

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

    # 安全检查: 没有改动就别白跑
    if [ -z "$(git status --porcelain)" ]; then
      echo -e "${YELLOW}⚠️  没有任何改动，无需提交${NC}"
      echo -e "   如果你还没替换文件，先执行: ./dev.sh put <源文件> <目标路径>"
      exit 0
    fi

    echo -e "${CYAN}即将提交以下改动到 $BRANCH:${NC}"
    git status -s
    echo ""

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

    git push origin "$BRANCH"
    git checkout main
    git pull origin main
    git merge "$BRANCH" --no-ff -m "merge: $BRANCH → main ($2)"
    git tag -a "$2" -m "Release $2"
    git push origin main --tags
    git push origin --delete "$BRANCH" 2>/dev/null || true
    git branch -d "$BRANCH"

    echo ""
    echo -e "${GREEN}✅ 完成!${NC}"
    echo -e "   分支 $BRANCH → main, tag $2 已推送"
    echo ""
    echo -e "${YELLOW}⚠️  别忘了更新 CHANGELOG.md !${NC}"
    echo -e "   然后: ./dev.sh save \"docs: 更新 CHANGELOG for $2\""
    ;;

  # ============================================================
  # 从 Claude 拿到文件后
  # ============================================================

  #--- 复制文件到项目 (带备份) ---
  put)
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo -e "${RED}用法: ./dev.sh put <源文件> <目标路径>${NC}"
      echo -e "示例: ./dev.sh put ~/Downloads/api.js public/js/api.js"
      echo -e "      ./dev.sh put ~/Downloads/chat.css public/css/chat.css"
      exit 1
    fi
    SRC="$2"; DEST="$3"

    if [ ! -f "$SRC" ]; then
      echo -e "${RED}❌ 源文件不存在: $SRC${NC}"; exit 1
    fi

    ensure_gitignore_backup

    # 备份原文件
    backup_file "$DEST"

    # 确保目标目录存在
    mkdir -p "$(dirname "$DEST")"

    # 复制
    cp "$SRC" "$DEST"
    echo -e "${GREEN}✅ 已复制: $SRC → $DEST${NC}"

    # 显示 diff 预览
    echo ""
    echo -e "${CYAN}改动预览:${NC}"
    git diff --stat "$DEST" 2>/dev/null || echo "   (新文件)"
    echo ""
    echo -e "下一步: ./dev.sh save \"fix: 描述你的改动\""
    echo -e "或继续 put 更多文件，最后再一起 save"
    ;;

  #--- 一键修复: 建分支→提交→合并→打tag ---
  quickfix)
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo -e "${RED}用法: ./dev.sh quickfix <版本号> \"提交信息\"${NC}"
      echo -e "示例: ./dev.sh quickfix v0.1.1 \"fix: 修复背景滚动\""
      echo ""
      echo -e "${YELLOW}注意: 先用 ./dev.sh put 把文件放好，再执行 quickfix${NC}"
      exit 1
    fi
    VERSION="$2"; MSG="$3"

    # 检查是否有改动可以提交
    if [ -z "$(git status --porcelain)" ]; then
      echo -e "${RED}❌ 没有任何改动。先用 ./dev.sh put 替换文件${NC}"; exit 1
    fi

    BRANCH=$(git branch --show-current)

    echo -e "${BOLD}📋 Quickfix 计划:${NC}"
    echo -e "   版本: $VERSION"
    echo -e "   信息: $MSG"
    echo -e "   改动文件:"
    git status -s | sed 's/^/   /'
    echo ""
    confirm "确认执行以上操作?"

    # 如果在 main 上，自动创建临时分支
    if [ "$BRANCH" = "main" ]; then
      FIX_BRANCH="fix/quickfix-${VERSION}"
      git checkout -b "$FIX_BRANCH"
      echo -e "   ${CYAN}→ 创建分支 $FIX_BRANCH${NC}"
    else
      FIX_BRANCH="$BRANCH"
    fi

    # 提交
    git add -A
    git commit -m "$MSG"
    echo -e "   ${CYAN}→ 已提交${NC}"

    # 推送功能分支
    git push origin "$FIX_BRANCH"

    # 合并到 main
    git checkout main
    git pull origin main
    git merge "$FIX_BRANCH" --no-ff -m "merge: $FIX_BRANCH → main ($VERSION)"
    echo -e "   ${CYAN}→ 已合并到 main${NC}"

    # 打 tag
    git tag -a "$VERSION" -m "Release $VERSION"
    git push origin main --tags
    echo -e "   ${CYAN}→ 已打 tag $VERSION${NC}"

    # 清理分支
    git push origin --delete "$FIX_BRANCH" 2>/dev/null || true
    git branch -d "$FIX_BRANCH"

    echo ""
    echo -e "${GREEN}✅ Quickfix 完成!${NC}"
    echo -e "   $MSG → main ($VERSION)"
    echo ""
    echo -e "下一步:"
    echo -e "   1. 编辑 CHANGELOG.md, 加上 $VERSION 的条目"
    echo -e "   2. ./dev.sh save \"docs: CHANGELOG $VERSION\""
    echo -e "   3. ./dev.sh deploy $VERSION"
    ;;

  # ============================================================
  # 出错恢复
  # ============================================================

  #--- 撤销上一次 commit (保留改动) ---
  undo)
    LAST=$(git log --oneline -1)
    echo -e "${YELLOW}即将撤销最近一次 commit (文件改动会保留):${NC}"
    echo -e "   $LAST"
    confirm "确认撤销?"

    git reset --soft HEAD~1
    echo -e "${GREEN}✅ 已撤销 commit，改动保留在暂存区${NC}"
    echo -e "   你可以修改后重新: ./dev.sh save \"新的提交信息\""
    ;;

  #--- 回退到指定版本 ---
  rollback)
    if [ -z "$2" ]; then
      echo -e "${RED}用法: ./dev.sh rollback <版本号>${NC}"
      echo -e "示例: ./dev.sh rollback v0.1.0"
      echo ""
      echo -e "可用版本:"
      git tag --sort=-version:refname | head -10
      exit 1
    fi
    TARGET="$2"

    # 验证 tag 存在
    if ! git rev-parse "$TARGET" >/dev/null 2>&1; then
      echo -e "${RED}❌ 版本 $TARGET 不存在${NC}"
      echo -e "可用版本:"
      git tag --sort=-version:refname | head -10
      exit 1
    fi

    CURRENT=$(git describe --tags --abbrev=0 2>/dev/null || echo "未知")
    echo -e "${YELLOW}回退计划:${NC}"
    echo -e "   当前: $CURRENT"
    echo -e "   目标: $TARGET"
    echo ""
    echo -e "${YELLOW}这会在 main 上创建一个新的 revert commit${NC}"
    confirm "确认回退?"

    ensure_clean

    git checkout main
    git pull origin main
    git revert --no-commit HEAD..$(git rev-parse "$TARGET") 2>/dev/null || \
      git checkout "$TARGET" -- .
    git commit -m "rollback: 回退到 $TARGET (从 $CURRENT)"
    git push origin main

    echo -e "${GREEN}✅ 已回退到 $TARGET 的代码状态${NC}"
    echo -e "   (历史记录保留，可以安全地再次前进)"
    echo ""
    echo -e "如需部署: ./dev.sh deploy"
    ;;

  #--- 重命名 tag ---
  retag)
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo -e "${RED}用法: ./dev.sh retag <旧tag> <新tag>${NC}"
      echo -e "示例: ./dev.sh retag v0.2.1 v0.1.1"
      exit 1
    fi
    OLD_TAG="$2"; NEW_TAG="$3"

    if ! git rev-parse "$OLD_TAG" >/dev/null 2>&1; then
      echo -e "${RED}❌ tag $OLD_TAG 不存在${NC}"; exit 1
    fi
    if git rev-parse "$NEW_TAG" >/dev/null 2>&1; then
      echo -e "${RED}❌ tag $NEW_TAG 已存在${NC}"; exit 1
    fi

    confirm "重命名 tag: $OLD_TAG → $NEW_TAG (远程+本地)"

    # 在同一 commit 上创建新 tag
    COMMIT=$(git rev-parse "$OLD_TAG")
    git tag -a "$NEW_TAG" "$COMMIT" -m "Release $NEW_TAG"

    # 删除旧 tag
    git tag -d "$OLD_TAG"
    git push origin --delete "$OLD_TAG" 2>/dev/null || true

    # 推送新 tag
    git push origin "$NEW_TAG"

    echo -e "${GREEN}✅ 已重命名: $OLD_TAG → $NEW_TAG${NC}"
    ;;

  # ============================================================
  # 部署运维
  # ============================================================

  #--- 部署到 VPS ---
  deploy)
    TAG_ARG=""
    if [ -n "$2" ]; then
      TAG_ARG="$2"
      # 验证 tag 存在
      if ! git rev-parse "$TAG_ARG" >/dev/null 2>&1; then
        echo -e "${RED}❌ 版本 $TAG_ARG 不存在${NC}"
        echo -e "可用版本:"
        git tag --sort=-version:refname | head -5
        exit 1
      fi
      echo -e "${YELLOW}→ 部署 $TAG_ARG 到 $VPS_HOST:$VPS_DIR${NC}"
    else
      echo -e "${YELLOW}→ 部署最新 main 到 $VPS_HOST:$VPS_DIR${NC}"
    fi
    confirm "确认部署?"
    ssh "$VPS_USER@$VPS_HOST" "cd $VPS_DIR && sudo bash update.sh $TAG_ARG"
    echo -e "${GREEN}✅ 部署完成${NC}"
    ;;

  #--- 查看日志 ---
  log)
    echo ""
    git log --oneline --graph --all --decorate -20
    echo ""
    ;;

  #--- 查看所有 tag ---
  tags)
    echo ""
    echo -e "${BOLD}版本列表:${NC}"
    git tag --sort=-version:refname | while read tag; do
      DATE=$(git log -1 --format="%ai" "$tag" 2>/dev/null | cut -d' ' -f1)
      MSG=$(git tag -l --format='%(contents:subject)' "$tag" 2>/dev/null)
      echo -e "   ${GREEN}$tag${NC}  ($DATE)  $MSG"
    done
    echo ""
    ;;

  #--- 查看状态 ---
  status)
    BRANCH=$(git branch --show-current)
    echo ""
    echo -e "分支: ${GREEN}$BRANCH${NC}"
    echo -e "最新 tag: $(git describe --tags --abbrev=0 2>/dev/null || echo '无')"
    echo -e "最新 commit: $(git log --oneline -1)"
    echo ""
    CHANGES=$(git status -s)
    if [ -n "$CHANGES" ]; then
      echo -e "${YELLOW}未提交的改动:${NC}"
      echo "$CHANGES"
    else
      echo -e "${GREEN}工作区干净 ✓${NC}"
    fi
    echo ""
    ;;

  #--- 提交前预览改动 ---
  diff)
    if [ -z "$(git status --porcelain)" ]; then
      echo -e "${GREEN}没有改动${NC}"; exit 0
    fi
    echo -e "${BOLD}改动文件:${NC}"
    git status -s
    echo ""
    echo -e "${BOLD}详细 diff:${NC}"
    git diff
    git diff --cached
    ;;

  # ============================================================
  # 帮助
  # ============================================================
  *)
    echo ""
    echo -e "${BOLD}TeamChat 开发辅助脚本 v2${NC}"
    echo ""
    echo -e "${CYAN}▸ 日常开发${NC}"
    echo "  new    <分支名>              创建新功能分支 (从 main)"
    echo "  save   \"提交信息\"            add + commit + push 当前分支"
    echo "  done   <版本号>              合并当前分支到 main 并打 tag"
    echo ""
    echo -e "${CYAN}▸ Claude 改完代码后${NC}"
    echo "  put    <源文件> <目标路径>    复制文件到项目 (自动备份原文件)"
    echo "  quickfix <版本号> \"提交信息\"  一键: 建分支→提交→合并→打tag"
    echo ""
    echo -e "${CYAN}▸ 出错恢复${NC}"
    echo "  undo                         撤销上一次 commit (保留文件)"
    echo "  rollback <版本号>            回退到指定版本"
    echo "  retag  <旧tag> <新tag>       重命名 tag"
    echo ""
    echo -e "${CYAN}▸ 运维${NC}"
    echo "  deploy [版本号]              部署到 VPS"
    echo "  log                          查看提交历史"
    echo "  tags                         列出所有版本"
    echo "  status                       查看分支和改动"
    echo "  diff                         提交前预览改动"
    echo ""
    echo -e "${BOLD}典型流程 (从 Claude 拿到修复文件):${NC}"
    echo "  1. ./dev.sh put ~/Downloads/api.js public/js/api.js"
    echo "  2. ./dev.sh put ~/Downloads/chat.css public/css/chat.css  # 如有多个"
    echo "  3. ./dev.sh diff                                          # 检查改动"
    echo "  4. ./dev.sh quickfix v0.1.1 \"fix: 修复背景滚动\""
    echo "  5. 编辑 CHANGELOG.md"
    echo "  6. ./dev.sh save \"docs: CHANGELOG v0.1.1\""
    echo "  7. ./dev.sh deploy v0.1.1"
    echo ""
    echo -e "${BOLD}搞砸了?${NC}"
    echo "  tag 打错了:    ./dev.sh retag v0.2.1 v0.1.1"
    echo "  commit 错了:   ./dev.sh undo"
    echo "  要回旧版本:    ./dev.sh rollback v0.1.0"
    echo ""
    ;;
esac
