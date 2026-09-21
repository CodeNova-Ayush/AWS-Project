#!/bin/bash
# ==============================================================================
# Direct Deployment Script: Local Machine -> AWS EC2 (No GitHub Push)
# Usage:
#   Option A (with .pem key): ./deploy/deploy_direct.sh <EC2_PUBLIC_IP> <PATH_TO_PEM_KEY>
#   Option B (with default SSH key): ./deploy/deploy_direct.sh <EC2_PUBLIC_IP>
# ==============================================================================

set -euo pipefail

EC2_IP="${1:?Error: Please provide your EC2 Public IP as argument 1. Example: ./deploy/deploy_direct.sh 13.211.92.23}"
KEY_PATH="${2:-}"

SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"

if [ -n "$KEY_PATH" ]; then
  if [ ! -f "$KEY_PATH" ]; then
    echo "❌ Error: Key file not found at: $KEY_PATH"
    echo ""
    echo "💡 Tips:"
    echo "  1. If your key is in Downloads, check its exact filename:"
    echo "     ls -la ~/Downloads/*.pem"
    echo "  2. You can drag and drop your .pem file directly into the terminal after the IP."
    exit 1
  fi
  chmod 400 "$KEY_PATH"
  SSH_OPTS="-i $KEY_PATH $SSH_OPTS"
  echo "🔑 Using SSH key: $KEY_PATH"
fi

echo "========================================================"
echo "  Deploying MergeDeck directly to AWS EC2: $EC2_IP"
echo "  (No GitHub push required — using latest local build)"
echo "========================================================"

# Test connection and determine user (ubuntu or ec2-user)
echo ">>> Checking connection to EC2 instance..."
REMOTE_USER=""
if ssh $SSH_OPTS "ubuntu@$EC2_IP" "echo ready" >/dev/null 2>&1; then
  REMOTE_USER="ubuntu"
elif ssh $SSH_OPTS "ec2-user@$EC2_IP" "echo ready" >/dev/null 2>&1; then
  REMOTE_USER="ec2-user"
fi

if [ -z "$REMOTE_USER" ]; then
  echo ""
  echo "❌ Connection failed: Permission denied (publickey) or timeout."
  echo ""
  echo "👉 To fix this, you have TWO very easy options:"
  echo ""
  echo "Option 1: If you downloaded a .pem file from AWS:"
  echo "  Run: ./deploy/deploy_direct.sh $EC2_IP ~/Downloads/<YOUR_ACTUAL_KEY_NAME>.pem"
  echo "  (Hint: Drag and drop your .pem file from Finder into the terminal!)"
  echo ""
  echo "Option 2: Authorize your Mac directly via AWS Console (Zero-Key Method):"
  echo "  1. In your AWS Console, click the 'Connect' button (top right)."
  echo "  2. Choose 'EC2 Instance Connect' and click 'Connect' to open the browser terminal."
  echo "  3. Copy and paste this single command into the browser terminal and press Enter:"
  echo ""
  echo "     mkdir -p ~/.ssh && echo \"$(cat ~/.ssh/id_ed25519.pub 2>/dev/null || cat ~/.ssh/id_rsa.pub 2>/dev/null)\" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
  echo ""
  echo "  4. Once pasted, re-run this command on your Mac terminal:"
  echo "     ./deploy/deploy_direct.sh $EC2_IP"
  echo ""
  exit 1
fi

echo "Connected successfully as user: $REMOTE_USER"

# 1. Ensure frontend web bundle is exported
echo ">>> [1/5] Checking frontend web build..."
if [ ! -f "frontend/dist/index.html" ]; then
  echo "Building frontend web export..."
  cd frontend && npx expo export --platform web && cd ..
else
  echo "Frontend bundle ready in frontend/dist."
fi

# 2. Package local code (excluding node_modules and .git)
echo ">>> [2/5] Packaging local project code..."
ARCHIVE="/tmp/mergedeck_deploy.tar.gz"
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='__pycache__' \
    --exclude='.venv' \
    --exclude='venv' \
    -czf "$ARCHIVE" backend frontend deploy .env.example

echo "Package size: $(du -sh "$ARCHIVE" | cut -f1)"

# 3. Upload archive to EC2
echo ">>> [3/5] Uploading project files to EC2 ($REMOTE_USER@$EC2_IP)..."
scp $SSH_OPTS "$ARCHIVE" "$REMOTE_USER@$EC2_IP:/home/$REMOTE_USER/mergedeck_deploy.tar.gz"
if [ -f "backend/.env" ]; then
  scp $SSH_OPTS "backend/.env" "$REMOTE_USER@$EC2_IP:/home/$REMOTE_USER/backend.env"
fi

# 4. Execute remote configuration and setup
echo ">>> [4/5] Running setup on EC2 (installing dependencies, Nginx, and systemd)..."
ssh $SSH_OPTS "$REMOTE_USER@$EC2_IP" REMOTE_USER="$REMOTE_USER" bash -s << 'REMOTE_EOF'
set -euo pipefail

TARGET_USER="${REMOTE_USER:-ubuntu}"
APP_DIR="/home/$TARGET_USER/snippet-app"

echo "==> Updating system packages..."
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y python3 python3-pip python3-venv nginx curl
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf update -y
  sudo dnf install -y python3 python3-pip nginx curl
elif command -v yum >/dev/null 2>&1; then
  sudo yum update -y
  sudo yum install -y python3 python3-pip nginx curl
fi

sudo mkdir -p "$APP_DIR"
sudo chown -R "$TARGET_USER:$TARGET_USER" "$APP_DIR"

echo "==> Unpacking application..."
tar -xzf "/home/$TARGET_USER/mergedeck_deploy.tar.gz" -C "$APP_DIR"
rm -f "/home/$TARGET_USER/mergedeck_deploy.tar.gz"

if [ -f "/home/$TARGET_USER/backend.env" ]; then
  mv "/home/$TARGET_USER/backend.env" "$APP_DIR/backend/.env"
elif [ ! -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/backend/.env"
fi

echo "==> Setting up Python virtual environment..."
cd "$APP_DIR/backend"
python3 -m venv venv
venv/bin/pip install --upgrade pip
venv/bin/pip install -r requirements.txt
venv/bin/pip install -e ./emergentintegrations 2>/dev/null || true

echo "==> Creating systemd service..."
sudo tee /etc/systemd/system/mergedeck.service > /dev/null << SERVICE_EOF
[Unit]
Description=MergeDeck Backend (FastAPI + Static Web App)
After=network.target

[Service]
Type=simple
User=$TARGET_USER
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=-$APP_DIR/backend/.env
Environment=PORT=8000
Environment=PYTHONUNBUFFERED=1
ExecStart=$APP_DIR/backend/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE_EOF

sudo systemctl daemon-reload
sudo systemctl enable mergedeck.service
sudo systemctl restart mergedeck.service

echo "==> Configuring Nginx..."
if [ -d "/etc/nginx/sites-available" ]; then
  sudo tee /etc/nginx/sites-available/mergedeck > /dev/null << 'NGINX_EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

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
    }
}
NGINX_EOF
  sudo ln -sf /etc/nginx/sites-available/mergedeck /etc/nginx/sites-enabled/mergedeck
  sudo rm -f /etc/nginx/sites-enabled/default
else
  sudo tee /etc/nginx/conf.d/mergedeck.conf > /dev/null << 'NGINX_EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

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
    }
}
NGINX_EOF
fi

sudo nginx -t
sudo systemctl restart nginx || sudo systemctl start nginx

echo "==> Service Status:"
sudo systemctl status mergedeck.service --no-pager
REMOTE_EOF

rm -f "$ARCHIVE"

echo ""
echo "========================================================"
echo "  🎉 DEPLOYMENT SUCCESSFUL!"
echo "  Your luxury MergeDeck app is live on AWS EC2:"
echo "  👉 http://$EC2_IP"
echo "========================================================"
