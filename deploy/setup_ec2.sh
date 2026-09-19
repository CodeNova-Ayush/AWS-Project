#!/bin/bash
# ============================================================================
# SNIPPET — AWS EC2 Free Tier Deployment Script
# Run this on a fresh Ubuntu 22.04/24.04 EC2 t2.micro instance
# Usage: chmod +x setup_ec2.sh && sudo ./setup_ec2.sh
# ============================================================================

set -euo pipefail

echo "============================================"
echo "  SNIPPET — EC2 Production Setup"
echo "============================================"

# ── 1. System Updates & Core Dependencies ──
echo ">>> [1/7] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y \
  git curl wget unzip build-essential \
  python3 python3-pip python3-venv \
  nginx certbot python3-certbot-nginx \
  ca-certificates gnupg software-properties-common

# ── 2. Install Node.js 20 ──
echo ">>> [2/7] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "Node: $(node --version) | npm: $(npm --version)"

# ── 3. Clone Repository ──
echo ">>> [3/7] Cloning repository..."
APP_DIR="/home/ubuntu/snippet-app"
if [ -d "$APP_DIR" ]; then
  echo "App directory exists, pulling latest..."
  cd "$APP_DIR" && git pull origin main
else
  cd /home/ubuntu
  git clone https://github.com/CodeNova-Ayush/AWS-Project.git snippet-app
  cd "$APP_DIR"
fi

# ── 4. Setup Python Backend ──
echo ">>> [4/7] Setting up Python backend..."
cd "$APP_DIR/backend"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# ── 5. Build Frontend ──
echo ">>> [5/7] Building Expo web frontend..."
cd "$APP_DIR/frontend"
npm install --legacy-peer-deps
npx expo export --platform web
echo "Frontend built to: $APP_DIR/frontend/dist"

# ── 6. Create systemd service ──
echo ">>> [6/7] Creating systemd service..."
cat > /etc/systemd/system/snippet.service << 'SYSTEMD_EOF'
[Unit]
Description=Snippet Backend (FastAPI + Static Frontend)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/snippet-app/backend
EnvironmentFile=/home/ubuntu/snippet-app/backend/.env
Environment=PORT=8000
Environment=PYTHONUNBUFFERED=1
ExecStart=/home/ubuntu/snippet-app/backend/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

systemctl daemon-reload
systemctl enable snippet.service

# ── 7. Configure Nginx Reverse Proxy ──
echo ">>> [7/7] Configuring Nginx..."
cat > /etc/nginx/sites-available/snippet << 'NGINX_EOF'
server {
    listen 80;
    server_name _;

    # Proxy all traffic to the FastAPI backend (which serves API + static frontend)
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        client_max_body_size 10M;
    }
}
NGINX_EOF

# Enable site and remove default
ln -sf /etc/nginx/sites-available/snippet /etc/nginx/sites-enabled/snippet
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo ""
echo "============================================"
echo "  SETUP COMPLETE!"
echo "============================================"
echo ""
echo "  Next steps:"
echo "  1. Create /home/ubuntu/snippet-app/backend/.env"
echo "     (copy your local .env values)"
echo "  2. Start the app: sudo systemctl start snippet"
echo "  3. Check status:  sudo systemctl status snippet"
echo "  4. View logs:     sudo journalctl -u snippet -f"
echo "  5. Open http://<YOUR-EC2-PUBLIC-IP> in a browser"
echo ""
echo "============================================"
