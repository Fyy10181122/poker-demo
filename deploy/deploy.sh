#!/usr/bin/env bash
# 本地运行：把代码上传到云服务器并重启服务
# 用法: bash deploy/deploy.sh user@服务器公网IP
# 依赖: rsync + ssh（Windows 用 Git Bash / WSL）
set -e

if [ -z "$1" ]; then
  echo "用法: bash deploy/deploy.sh user@服务器公网IP"
  echo "示例: bash deploy/deploy.sh ubuntu@1.2.3.4"
  exit 1
fi

HOST="$1"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> 上传代码到 $HOST:/opt/poker-demo"
ssh "$HOST" "sudo mkdir -p /opt/poker-demo && sudo chown -R \$USER /opt/poker-demo"
rsync -avz --delete \
  --exclude node_modules --exclude .git --exclude .workbuddy --exclude '*.log' \
  "$DIR/" "$HOST:/opt/poker-demo/"

echo "==> 远程安装生产依赖并重启 pm2"
ssh "$HOST" "cd /opt/poker-demo && npm install --omit=dev && ( pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js )"

echo "==> 部署完成！"
echo "    直接 IP 访问: http://$HOST:3000"
echo "    若已配 nginx 域名: 用你的域名访问"
