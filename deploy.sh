#!/bin/bash
# Deploy script for the 8x8 class-quality assessor.
# Run on the VPS as root:  bash deploy.sh
set -e

APP_PORT=8090
APP_DIR="$HOME/class-quality-app"
REPO="https://github.com/The-Nikhil-Pandey/hirin-test.git"

echo "==> checking nothing else is on port $APP_PORT"
if ss -tlnp | grep -q ":$APP_PORT "; then
  echo "PORT $APP_PORT IS ALREADY IN USE - edit APP_PORT in this script"; exit 1
fi

echo "==> installing dependencies (node, ffmpeg, pm2)"
if ! command -v node >/dev/null || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
apt-get update -qq
apt-get install -y ffmpeg git
npm install -g pm2 --silent

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
pm2 startup systemd -u root --hp "$HOME" >/dev/null 2>&1 || true
pm2 save

echo "==> firewall"
if command -v ufw >/dev/null; then
  ufw allow $APP_PORT/tcp >/dev/null
  if ufw status | grep -q "Status: active"; then
    echo "ufw is active: allowed port $APP_PORT (other apps untouched)"
  else
    echo "NOTE: ufw is installed but INACTIVE - leaving it off so your other"
    echo "      running apps/ports are not blocked. Rule for $APP_PORT is added"
    echo "      and will apply if you ever enable ufw (remember to also allow ssh + your other ports first)."
  fi
else
  echo "ufw not installed - skipping firewall config (app is reachable directly on the IP)"
fi

IP=$(curl -s ifconfig.me || echo "<server-ip>")
echo ""
echo "DONE - app is live at:  http://$IP:$APP_PORT"
pm2 status
