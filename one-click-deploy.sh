#!/usr/bin/env bash
#===============================================================================
# TeamChat one-click deploy / update
#
# Usage on a fresh Linux server:
#   curl -fsSL https://raw.githubusercontent.com/ttmanthatman/tm2/main/one-click-deploy.sh | sudo bash
#
# Optional environment variables:
#   APP_DIR=/var/www/teamchat
#   REPO_URL=https://github.com/ttmanthatman/tm2.git
#   BRANCH=main
#   PORT=3000
#   PM2_NAME=teamchat
#   DOMAIN=chat.example.com       # optional nginx server_name
#   ADMIN_USER=admin              # optional, prompts if missing on first init
#   ADMIN_PASS=change-me          # optional, prompts if missing on first init
#   SKIP_NGINX=1                  # skip nginx config
#===============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
CYAN='\033[0;36m'
NC='\033[0m'

REPO_URL="${REPO_URL:-https://github.com/ttmanthatman/tm2.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/var/www/teamchat}"
PM2_NAME="${PM2_NAME:-teamchat}"
PORT="${PORT:-3000}"
DOMAIN="${DOMAIN:-_}"
SKIP_NGINX="${SKIP_NGINX:-0}"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo -e "${RED}Please run as root or with sudo.${NC}"
  exit 1
fi

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  TeamChat one-click deploy${NC}"
echo -e "${CYAN}================================================${NC}"
echo "Repository: $REPO_URL"
echo "Branch:     $BRANCH"
echo "Directory:  $APP_DIR"
echo "Port:       $PORT"
echo "PM2 name:   $PM2_NAME"
echo "Domain:     $DOMAIN"
echo ""

detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "${ID:-unknown}"
  else
    echo "unknown"
  fi
}

install_system_deps() {
  local os="$1"
  echo -e "${YELLOW}[1/7] Installing system dependencies...${NC}"
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y curl wget git build-essential python3 nginx ca-certificates
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y curl wget git gcc-c++ make python3 nginx ca-certificates
  elif command -v yum >/dev/null 2>&1; then
    yum install -y epel-release || true
    yum install -y curl wget git gcc-c++ make python3 nginx ca-certificates
  else
    echo -e "${RED}Unsupported OS package manager: $os${NC}"
    exit 1
  fi
}

install_node() {
  echo -e "${YELLOW}[2/7] Checking Node.js...${NC}"
  local major="0"
  if command -v node >/dev/null 2>&1; then
    major="$(node -v | sed 's/^v//' | cut -d. -f1)"
  fi

  if [ "$major" -lt 18 ]; then
    echo "Installing Node.js 20 LTS..."
    if command -v apt-get >/dev/null 2>&1; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
      apt-get install -y nodejs
    elif command -v dnf >/dev/null 2>&1; then
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
      dnf install -y nodejs
    else
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
      yum install -y nodejs
    fi
  fi

  echo "Node: $(node -v)  npm: $(npm -v)"
  npm install -g pm2 >/dev/null 2>&1 || true
}

checkout_code() {
  echo -e "${YELLOW}[3/7] Fetching application code...${NC}"
  if [ -d "$APP_DIR/.git" ]; then
    cd "$APP_DIR"
    git remote set-url origin "$REPO_URL" || true
    git fetch origin "$BRANCH" --prune
    git checkout "$BRANCH"
    git reset --hard "origin/$BRANCH"
  else
    if [ -d "$APP_DIR" ] && [ "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
      local backup="${APP_DIR}.backup.$(date +%Y%m%d-%H%M%S)"
      echo -e "${YELLOW}$APP_DIR already exists and is not a git checkout. Moving it to $backup${NC}"
      mv "$APP_DIR" "$backup"
    fi
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
  fi
}

prepare_runtime_dirs() {
  echo -e "${YELLOW}[4/7] Preparing runtime directories...${NC}"
  mkdir -p uploads avatars backgrounds voices public/images .backups
  chmod 755 uploads avatars backgrounds voices
  echo "$PORT" > .port
  chmod 600 .port 2>/dev/null || true
}

install_app_deps() {
  echo -e "${YELLOW}[5/7] Installing npm dependencies...${NC}"
  if [ -f package-lock.json ]; then
    npm ci --omit=dev --no-audit --no-fund
  else
    npm install --omit=dev --no-audit --no-fund
  fi
}

init_admin_if_needed() {
  echo -e "${YELLOW}[6/7] Initializing database and admin user...${NC}"
  if [ -f database.sqlite ]; then
    echo "database.sqlite already exists. Keeping current users and data."
    return
  fi

  if [ -z "${ADMIN_USER:-}" ]; then
    read -r -p "Admin username [admin]: " ADMIN_USER
    ADMIN_USER="${ADMIN_USER:-admin}"
  fi
  if [ -z "${ADMIN_PASS:-}" ]; then
    read -r -s -p "Admin password (at least 6 chars): " ADMIN_PASS
    echo ""
  fi
  if [ "${#ADMIN_PASS}" -lt 6 ]; then
    echo -e "${RED}Admin password must be at least 6 chars.${NC}"
    exit 1
  fi

  ADMIN_USER="$ADMIN_USER" ADMIN_PASS="$ADMIN_PASS" npm run init-admin
  chmod 600 database.sqlite .jwt_secret .vapid_keys 2>/dev/null || true
}

configure_pm2() {
  echo -e "${YELLOW}[7/7] Starting PM2 service...${NC}"
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    PORT="$PORT" pm2 restart "$PM2_NAME" --update-env
  else
    PORT="$PORT" pm2 start server/server.js --name "$PM2_NAME"
  fi
  pm2 save
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
}

configure_nginx() {
  if [ "$SKIP_NGINX" = "1" ]; then
    echo "Skipping nginx config because SKIP_NGINX=1"
    return
  fi
  if ! command -v nginx >/dev/null 2>&1; then
    echo "nginx is not installed; skipping reverse proxy config."
    return
  fi

  local conf="/etc/nginx/conf.d/teamchat.conf"
  echo -e "${YELLOW}Configuring nginx reverse proxy at $conf...${NC}"
  cat > "$conf" <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
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
  nginx -t
  systemctl restart nginx || service nginx restart
}

health_check() {
  echo -e "${YELLOW}Running health check...${NC}"
  sleep 2
  if curl -fsS "http://127.0.0.1:$PORT/api/settings/registration" >/dev/null; then
    echo -e "${GREEN}Health check passed.${NC}"
  else
    echo -e "${RED}Health check failed. Check logs with: pm2 logs $PM2_NAME${NC}"
    exit 1
  fi
}

OS="$(detect_os)"
install_system_deps "$OS"
install_node
checkout_code
prepare_runtime_dirs
install_app_deps
init_admin_if_needed
configure_pm2
configure_nginx
health_check

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  TeamChat deployed successfully${NC}"
echo -e "${GREEN}================================================${NC}"
echo "App directory: $APP_DIR"
echo "Local URL:     http://127.0.0.1:$PORT"
echo "Public URL:    http://$DOMAIN"
echo "Logs:          pm2 logs $PM2_NAME"
echo "Update again:  curl -fsSL https://raw.githubusercontent.com/ttmanthatman/tm2/$BRANCH/one-click-deploy.sh | sudo bash"
