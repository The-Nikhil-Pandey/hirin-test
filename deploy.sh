#!/bin/bash
# Deploy script for the 8x8 class-quality assessor.
# Works on AlmaLinux/RHEL (dnf) and Debian/Ubuntu (apt).
# Run on the VPS as root:  bash deploy.sh
set -e

APP_PORT=8090
APP_DIR="/home/class-quality-app"
REPO="https://github.com/The-Nikhil-Pandey/hirin-test.git"

echo "==> checking nothing else is on port $APP_PORT"
if ss -tlnp | grep -q ":$APP_PORT "; then
  echo "PORT $APP_PORT IS ALREADY IN USE - edit APP_PORT in this script"; exit 1
fi

PKG=apt-get
command -v dnf >/dev/null && PKG=dnf
command -v yum >/dev/null && ! command -v dnf >/dev/null && PKG=yum

echo "==> installing node (if missing/old), git, pm2  [pkg: $PKG]"
if ! command -v node >/dev/null || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - 2>/dev/null || \
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  $PKG install -y nodejs
fi
$PKG install -y git tar xz 2>/dev/null || true
npm install -g pm2 --silent

echo "==> installing ffmpeg"
if ! command -v ffmpeg >/dev/null; then
  $PKG install -y epel-release 2>/dev/null || true
  $PKG install -y ffmpeg 2>/dev/null || true
fi
if ! command -v ffmpeg >/dev/null; then
  echo "   repo ffmpeg not available - using static build"
  curl -fsSL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz
  tar -xJf /tmp/ffmpeg.tar.xz -C /tmp
  cp /tmp/ffmpeg-*-amd64-static/ffmpeg /tmp/ffmpeg-*-amd64-static/ffprobe /usr/local/bin/
  rm -rf /tmp/ffmpeg.tar.xz /tmp/ffmpeg-*-amd64-static
fi
ffmpeg -version | head -1

echo "==> pulling code into $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> installing server deps"
cd server && npm install --omit=dev

echo "==> building client"
cd ../client && npm install && npm run build
cd ..

echo "==> starting app with pm2 on port $APP_PORT"
pm2 delete class-assessor 2>/dev/null || true
PORT=$APP_PORT pm2 start server/index.js --name class-assessor
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
pm2 save

echo "==> firewall"
if command -v firewall-cmd >/dev/null && firewall-cmd --state 2>/dev/null | grep -q running; then
  firewall-cmd --permanent --add-port=$APP_PORT/tcp >/dev/null
  firewall-cmd --reload >/dev/null
  echo "firewalld: opened port $APP_PORT (other rules untouched)"
fi
if command -v ufw >/dev/null; then
  ufw allow $APP_PORT/tcp >/dev/null
  ufw status | grep -q "Status: active" \
    && echo "ufw active: allowed $APP_PORT" \
    || echo "ufw inactive: rule added, not enabling (protects your other apps)"
fi
command -v firewall-cmd >/dev/null || command -v ufw >/dev/null || \
  echo "no firewall tool found - app is reachable directly on the IP"

IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')
echo ""
echo "DONE - app is live at:  http://$IP:$APP_PORT"
pm2 status
