#!/bin/bash
#===============================================================================
# TeamChat 首次安装脚本 (基于 GitHub 部署)
# 用法: 在新服务器上以 root 身份:
#   curl -fsSL https://raw.githubusercontent.com/ttmanthatman/tm2/main/install-from-git.sh | sudo bash
# 或:
#   wget -O install.sh https://raw.githubusercontent.com/ttmanthatman/tm2/main/install-from-git.sh
#   sudo bash install.sh
#
# 之后所有更新只需在 /var/www/teamchat 跑: sudo bash update.sh
#===============================================================================
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[1;31m'; CYAN='\033[0;36m'; NC='\033[0m'

REPO_URL="${REPO_URL:-https://github.com/ttmanthatman/tm2.git}"
APP_DIR="${APP_DIR:-/var/www/teamchat}"
PM2_NAME="${PM2_NAME:-teamchat}"
PORT="${PORT:-3000}"

if [ "$EUID" -ne 0 ]; then echo -e "${RED}请用 sudo 或 root 运行${NC}"; exit 1; fi

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  TeamChat 首次安装 (GitHub 部署版)${NC}"
echo -e "${CYAN}================================================${NC}"
echo "仓库:  $REPO_URL"
echo "目录:  $APP_DIR"
echo "端口:  $PORT"
echo "PM2:   $PM2_NAME"
echo ""

# ----- 1. 系统依赖 -----
echo -e "${YELLOW}[1/6] 安装系统依赖...${NC}"
if [ -f /etc/os-release ]; then . /etc/os-release; OS=$ID; else OS=unknown; fi
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
  apt-get update -y
  apt-get install -y curl wget git build-essential python3 nginx
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "rocky" ] || [ "$OS" = "alma" ]; then
  yum install -y epel-release || true
  yum install -y curl wget git gcc-c++ make python3 nginx
fi

# ----- 2. Node.js (LTS) -----
echo -e "${YELLOW}[2/6] 安装 Node.js...${NC}"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs || yum install -y nodejs
fi
echo "Node: $(node -v)  npm: $(npm -v)"
npm install -g pm2 >/dev/null 2>&1 || true

# ----- 3. 拉代码 -----
echo -e "${YELLOW}[3/6] 拉取代码...${NC}"
if [ -d "$APP_DIR/.git" ]; then
  echo "目录已存在 git 仓库,执行 pull"
  cd "$APP_DIR" && git pull
else
  if [ -d "$APP_DIR" ] && [ "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠️  $APP_DIR 已存在内容${NC}"
    echo -n "是否备份并重新 clone? (yes/no): "; read -r ans
    if [ "$ans" = "yes" ]; then
      mv "$APP_DIR" "${APP_DIR}.backup.$(date +%s)"
    else
      echo "已取消"; exit 1
    fi
  fi
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# 准备数据目录
mkdir -p uploads avatars backgrounds public/images
chmod 755 uploads avatars backgrounds

# 默认头像 (如果仓库里没有)
if [ ! -f public/images/default-avatar.svg ]; then
  cat > public/images/default-avatar.svg <<'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#667eea"/><circle cx="50" cy="38" r="16" fill="white"/><ellipse cx="50" cy="75" rx="28" ry="20" fill="white"/></svg>
SVGEOF
fi

# ----- 4. 处理端口占位符 -----
# 你的 server/config.js 里有 __PORT_PLACEHOLDER__,需要替换成真实端口
if grep -q "__PORT_PLACEHOLDER__" server/config.js; then
  sed -i "s/__PORT_PLACEHOLDER__/$PORT/g" server/config.js
  echo -e "${GREEN}✓ 已替换端口占位符为 $PORT${NC}"
fi

# ----- 5. 装依赖 + 初始化 -----
echo -e "${YELLOW}[4/6] npm install...${NC}"
npm install --omit=dev --no-audit --no-fund

echo -e "${YELLOW}[5/6] 初始化数据库 + 管理员...${NC}"
if [ ! -f database.sqlite ]; then
  echo -n "管理员用户名 [admin]: "; read -r ADMIN_USER; ADMIN_USER=${ADMIN_USER:-admin}
  echo -n "管理员密码 (至少6位): "; read -rs ADMIN_PASS; echo
  if [ ${#ADMIN_PASS} -lt 6 ]; then echo -e "${RED}密码至少 6 位${NC}"; exit 1; fi

  ADMIN_USER="$ADMIN_USER" ADMIN_PASS="$ADMIN_PASS" node -e '
const Database=require("better-sqlite3"),bcrypt=require("bcryptjs");
require("./server/database");  // 触发建表
const db=new Database("database.sqlite");
const u=process.env.ADMIN_USER, p=process.env.ADMIN_PASS, h=bcrypt.hashSync(p,10);
try{db.prepare("INSERT INTO users (username,password,is_admin) VALUES (?,?,1)").run(u,h);console.log("✓ 管理员已创建: "+u);}
catch(e){db.prepare("UPDATE users SET password=?,is_admin=1 WHERE username=?").run(h,u);console.log("✓ 管理员密码已重置: "+u);}
const adminId=db.prepare("SELECT id FROM users WHERE username=?").get(u).id;
const ch=db.prepare("SELECT id FROM channels WHERE is_default=1").get();
if(ch)db.prepare("INSERT OR IGNORE INTO channel_members (channel_id,user_id,role) VALUES (?,?,?)").run(ch.id,adminId,"owner");
db.close();
'
  chmod 600 database.sqlite .jwt_secret .vapid_keys 2>/dev/null || true
else
  echo "已存在 database.sqlite,跳过初始化"
fi

# ----- 6. pm2 + nginx -----
echo -e "${YELLOW}[6/6] 启动服务...${NC}"
pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
PORT=$PORT pm2 start server/server.js --name "$PM2_NAME"
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# nginx 反代 (基础 http,SSL 自己用 certbot 加)
if [ ! -f /etc/nginx/conf.d/teamchat.conf ] && [ ! -f /etc/nginx/sites-available/teamchat ]; then
  cat > /etc/nginx/conf.d/teamchat.conf <<NGINX
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
NGINX
  nginx -t && systemctl restart nginx
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  🎉 安装完成${NC}"
echo -e "${GREEN}================================================${NC}"
echo "  访问: http://$(hostname -I | awk '{print $1}')"
echo "  以后更新只需:  cd $APP_DIR && sudo bash update.sh"
echo "  查看日志:      pm2 logs $PM2_NAME"
echo ""
echo -e "${YELLOW}如需 HTTPS:  certbot --nginx -d your.domain.com${NC}"
