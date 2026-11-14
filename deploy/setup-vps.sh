#!/usr/bin/env bash
# Cài đặt máy chủ lần đầu cho estateSmartAI. Chạy bằng root trên Ubuntu 22.04 hoặc 24.04:
#   curl -fsSL https://raw.githubusercontent.com/liliustwocout/estatesmart/main/deploy/setup-vps.sh -o setup-vps.sh
#   sudo REPO_URL=https://github.com/liliustwocout/estatesmart.git DOMAIN=estatesmart.online bash setup-vps.sh
set -euo pipefail

REPO_URL=${REPO_URL:-https://github.com/liliustwocout/estatesmart.git}
DOMAIN=${DOMAIN:-estatesmart.online}
BASE=/opt/estatesmart
APP=$BASE/app

[ "$(id -u)" -eq 0 ] || { echo "Hãy chạy bằng root (sudo)."; exit 1; }

echo ">> Cập nhật hệ thống và cài gói cần thiết"
apt-get update -y
apt-get install -y ca-certificates curl git gnupg ufw webhook

echo ">> Thêm 2 GB swap (giúp npm build ổn định trên VPS 2 GB RAM)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo ">> Cài Docker Engine từ kho chính thức của Docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo ">> Tạo user deploy (chạy webhook và docker, không dùng root)"
id deploy >/dev/null 2>&1 || useradd -m -s /bin/bash deploy
usermod -aG docker deploy
mkdir -p $BASE
chown deploy:deploy $BASE

echo ">> Clone mã nguồn"
if [ ! -d $APP/.git ]; then
  sudo -u deploy git clone --branch main "$REPO_URL" $APP
fi
chmod +x $APP/deploy/deploy.sh

echo ">> Tạo secret cho GitHub Webhook"
if [ ! -f $BASE/webhook.env ]; then
  echo "WEBHOOK_SECRET=$(openssl rand -hex 32)" > $BASE/webhook.env
  chmod 600 $BASE/webhook.env
  chown deploy:deploy $BASE/webhook.env
fi
echo "DOMAIN=$DOMAIN" > $APP/.env
chown deploy:deploy $APP/.env

echo ">> Cài dịch vụ webhook (systemd)"
cat > /etc/systemd/system/estatesmart-webhook.service <<UNIT
[Unit]
Description=estateSmartAI GitHub webhook
After=network-online.target docker.service

[Service]
User=deploy
EnvironmentFile=$BASE/webhook.env
ExecStart=/usr/bin/webhook -hooks $APP/deploy/hooks.json -template -port 9000 -verbose
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now estatesmart-webhook

echo ">> Tường lửa: chỉ mở SSH, HTTP, HTTPS; cổng 9000 chỉ cho mạng Docker nội bộ"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from 172.16.0.0/12 to any port 9000 proto tcp
ufw --force enable

echo ">> Deploy lần đầu"
sudo -u deploy $APP/deploy/deploy.sh
tail -n 5 $BASE/deploy.log

echo
echo "Hoàn tất. Secret cho GitHub Webhook (chỉ hiện ở đây, lưu vào GitHub rồi đóng cửa sổ):"
cut -d= -f2 $BASE/webhook.env
echo "Payload URL: https://$DOMAIN/hooks/deploy"
