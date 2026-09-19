#!/bin/bash
# ============================================================================
# Quick deploy script — run from your LOCAL machine to push code + env to EC2
# Usage: ./deploy_to_ec2.sh <EC2_PUBLIC_IP> <PATH_TO_KEY.pem>
# Example: ./deploy_to_ec2.sh 54.123.45.67 ~/Downloads/snippet-key.pem
# ============================================================================

set -euo pipefail

EC2_IP="${1:?Usage: ./deploy_to_ec2.sh <EC2_PUBLIC_IP> <PATH_TO_KEY.pem>}"
KEY_PATH="${2:?Usage: ./deploy_to_ec2.sh <EC2_PUBLIC_IP> <PATH_TO_KEY.pem>}"
SSH_CMD="ssh -i $KEY_PATH -o StrictHostKeyChecking=no ubuntu@$EC2_IP"
SCP_CMD="scp -i $KEY_PATH -o StrictHostKeyChecking=no"

echo ">>> Deploying SNIPPET to EC2 at $EC2_IP..."

# 1. Upload the setup script
echo "[1/4] Uploading setup script..."
$SCP_CMD deploy/setup_ec2.sh ubuntu@$EC2_IP:/home/ubuntu/setup_ec2.sh

# 2. Upload backend .env (contains secrets — never committed to git)
echo "[2/4] Uploading backend .env..."
$SCP_CMD backend/.env ubuntu@$EC2_IP:/home/ubuntu/backend_env_temp

# 3. Run setup on the EC2 instance
echo "[3/4] Running setup on EC2 (this takes 3-5 minutes)..."
$SSH_CMD "chmod +x /home/ubuntu/setup_ec2.sh && sudo /home/ubuntu/setup_ec2.sh"

# 4. Move .env into the correct location and start the service
echo "[4/4] Configuring environment and starting service..."
$SSH_CMD << 'REMOTE_EOF'
  # Move .env to the app directory
  cp /home/ubuntu/backend_env_temp /home/ubuntu/snippet-app/backend/.env
  rm -f /home/ubuntu/backend_env_temp

  # CRITICAL: Update GITHUB_REDIRECT_URI for production
  # The EC2 public IP is used as the redirect URI
  EC2_PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
  if [ -n "$EC2_PUBLIC_IP" ]; then
    sed -i "s|GITHUB_REDIRECT_URI=.*|GITHUB_REDIRECT_URI=http://$EC2_PUBLIC_IP/auth-callback|" /home/ubuntu/snippet-app/backend/.env
    echo "Updated GITHUB_REDIRECT_URI to http://$EC2_PUBLIC_IP/auth-callback"
  fi

  # Start the service
  sudo systemctl restart snippet
  sleep 3
  sudo systemctl status snippet --no-pager
REMOTE_EOF

echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE!"
echo "  App is live at: http://$EC2_IP"
echo "============================================"
echo ""
echo "  IMPORTANT: Update your GitHub OAuth App settings:"
echo "  1. Go to: https://github.com/settings/developers"
echo "  2. Find your OAuth App"
echo "  3. Set Homepage URL:    http://$EC2_IP"
echo "  4. Set Callback URL:    http://$EC2_IP/auth-callback"
echo ""
