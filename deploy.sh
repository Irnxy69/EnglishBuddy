#!/bin/bash
# =============================================
# EnglishBuddy 一键部署脚本（腾讯云 Ubuntu）
# 使用方式: bash deploy.sh
# =============================================

set -e  # 任何命令失败就停止

# ── 配置 ─────────────────────────────────────────────────────────────────────
APP_DIR="/home/ubuntu/englishbuddy"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
REPO_URL="https://github.com/Irnxy69/EnglishBuddy.git"
SERVER_IP=$(curl -s ifconfig.me)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo -e "\n🚀 EnglishBuddy 部署开始...\n"

# ── 1. 安装系统依赖 ───────────────────────────────────────────────────────────
log "安装系统依赖..."
sudo apt update -q
sudo apt install -y -q nginx python3.12 python3.12-venv python3-pip git curl

# 安装 Node.js 20
if ! command -v node &> /dev/null; then
    log "安装 Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - -q
    sudo apt install -y -q nodejs
fi

# 安装 PM2
if ! command -v pm2 &> /dev/null; then
    log "安装 PM2..."
    sudo npm install -g pm2 -q
fi

# ── 2. 拉取代码 ───────────────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
    log "更新代码 (git pull)..."
    cd "$APP_DIR" && git pull
else
    log "首次克隆代码..."
    git clone "$REPO_URL" "$APP_DIR"
fi

# ── 3. 部署后端 ───────────────────────────────────────────────────────────────
log "配置后端..."
cd "$BACKEND_DIR"

# 检查 .env 文件
if [ ! -f ".env" ]; then
    warn ".env 文件不存在！请先创建：cp .env.example .env && nano .env"
    err "缺少 .env 文件，部署中止"
fi

# 创建虚拟环境
if [ ! -d "venv" ]; then
    python3.12 -m venv venv
fi

log "安装 Python 依赖..."
venv/bin/pip install --quiet -r requirements.txt "pydantic[email]" \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    --trusted-host pypi.tuna.tsinghua.edu.cn

# 创建 systemd 服务
log "配置后端系统服务..."
sudo tee /etc/systemd/system/englishbuddy-api.service > /dev/null <<EOF
[Unit]
Description=EnglishBuddy FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=$BACKEND_DIR
ExecStart=$BACKEND_DIR/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=3
Environment=PATH=$BACKEND_DIR/venv/bin

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable englishbuddy-api
sudo systemctl restart englishbuddy-api
log "后端服务启动完成"

# ── 4. 部署前端 ───────────────────────────────────────────────────────────────
log "配置前端..."
cd "$FRONTEND_DIR"

# 设置 API URL 指向本机
echo "NEXT_PUBLIC_API_URL=http://$SERVER_IP" > .env.production.local

log "安装 Node.js 依赖..."
npm install --silent

log "构建前端 (可能需要 2-3 分钟)..."
npm run build

# PM2 管理 Next.js
pm2 describe englishbuddy-web &> /dev/null && pm2 restart englishbuddy-web || \
    pm2 start npm --name "englishbuddy-web" -- start
pm2 save --force
log "前端服务启动完成"

# ── 5. 配置 Nginx ─────────────────────────────────────────────────────────────
log "配置 Nginx..."
sudo tee /etc/nginx/sites-available/englishbuddy > /dev/null <<EOF
server {
    listen 80;
    server_name $SERVER_IP _;

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        client_max_body_size 20M;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # 健康检查
    location /health {
        proxy_pass http://127.0.0.1:8000;
    }

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/englishbuddy /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default  # 移除默认配置
sudo nginx -t && sudo systemctl restart nginx
log "Nginx 配置完成"

# ── 6. 配置 PM2 开机自启 ──────────────────────────────────────────────────────
pm2 startup | tail -1 | sudo bash || true

# ── 完成 ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  🎉 部署完成！${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "  网页访问: http://$SERVER_IP"
echo -e "  API 文档: http://$SERVER_IP/api/docs   (注: 需后端开启)"
echo -e "  后端状态: sudo systemctl status englishbuddy-api"
echo -e "  前端状态: pm2 status"
echo -e "  Nginx 日志: sudo tail -f /var/log/nginx/error.log"
echo ""
