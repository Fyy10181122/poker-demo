#!/usr/bin/env bash
# 在云服务器上【首次】运行：安装 Node / nginx / pm2，配置并启动服务
# 前置：已通过 deploy/deploy.sh 把代码上传到 /opt/poker-demo
# 用法（SSH 进服务器后）:
#   cd /opt/poker-demo && bash deploy/setup-server.sh
set -e

echo "==> 检测系统包管理器"
if command -v apt-get >/dev/null 2>&1; then
  PKG=apt
elif command -v dnf >/dev/null 2>&1; then
  PKG=dnf
elif command -v yum >/dev/null 2>&1; then
  PKG=yum
else
  echo "未识别的包管理器（仅支持 apt/dnf/yum）。请手动安装 Node20 + nginx + pm2。"
  exit 1
fi

echo "==> 系统更新"
sudo $PKG update -y

echo "==> 安装 Node.js 20"
if [ "$PKG" = "apt" ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -
  sudo $PKG install -y nodejs
fi

echo "==> 安装 pm2（进程守护）"
sudo npm install -g pm2

echo "==> 安装 nginx（反向代理 + HTTPS）"
if [ "$PKG" = "apt" ]; then sudo apt-get install -y nginx; else sudo $PKG install -y nginx; fi
sudo systemctl enable --now nginx

echo "==> 安装生产依赖"
cd /opt/poker-demo
npm install --omit=dev

echo "==> 启动服务"
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "==> 配置开机自启：请复制下面一行命令执行一次（按提示选 shell）"
pm2 startup

echo ""
echo "========== 下一步 =========="
echo "1) 配置 nginx 反代："
echo "   sudo cp deploy/poker-demo.conf /etc/nginx/sites-available/poker-demo"
echo "   sudo ln -s /etc/nginx/sites-available/poker-demo /etc/nginx/sites-enabled/"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo "2) 有域名则上 HTTPS：sudo certbot --nginx -d 你的域名"
echo "3) 之后改代码只需在本地重跑: bash deploy/deploy.sh user@服务器IP"
echo "==========================="
