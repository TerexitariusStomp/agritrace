VPS Android Emulator + WebRTC Setup
===================================

This guide sets up a headless Android Emulator on a KVM‑capable VPS and exposes it over WebRTC using Google’s android-emulator-webrtc bridge. It also shows how to run the AgroTrace backend and the Expo mobile app against the emulator.

Prerequisites
- Ubuntu 22.04+ VPS with KVM/nested virtualization (kvm-ok reports usable; /dev/kvm exists)
- Open firewall ports (adjust as needed):
  - TCP 8443 (WebRTC HTTPS UI)
  - UDP 10000-10100 (WebRTC media)
  - Optional: TCP 5555 (ADB remote, keep closed if not needed)

One‑shot Setup Script
Run these as root on your VPS.

1) Create and run setup script
```
cat >/root/setup-emulator-webrtc.sh <<'EOF'
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y qemu-kvm libvirt-daemon-system libvirt-clients virtinst cpu-checker unzip curl git ca-certificates apt-transport-https \
  openjdk-17-jre-headless docker.io docker-compose-plugin

# Verify KVM
if ! lsmod | grep -q kvm; then modprobe kvm || true; fi
kvm-ok || true

# Android SDK
export ANDROID_SDK_ROOT=/opt/android-sdk
mkdir -p $ANDROID_SDK_ROOT/cmdline-tools
cd /tmp
curl -LO https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q commandlinetools-linux-*_latest.zip -d $ANDROID_SDK_ROOT/cmdline-tools
mv $ANDROID_SDK_ROOT/cmdline-tools/cmdline-tools $ANDROID_SDK_ROOT/cmdline-tools/latest

cat >/etc/profile.d/android-sdk.sh <<ENV
export ANDROID_SDK_ROOT=/opt/android-sdk
export PATH=$PATH:/opt/android-sdk/platform-tools:/opt/android-sdk/emulator:/opt/android-sdk/cmdline-tools/latest/bin
ENV
source /etc/profile.d/android-sdk.sh

yes | sdkmanager --licenses
sdkmanager "platform-tools" "emulator" "platforms;android-34" "system-images;android-34;google_apis;x86_64"

# Create AVD
AVD_NAME=agro-avd
echo no | avdmanager create avd -n "$AVD_NAME" -k "system-images;android-34;google_apis;x86_64" --device "pixel_5" || true

# Systemd service for emulator (headless)
cat >/etc/systemd/system/agro-emulator.service <<UNIT
[Unit]
Description=Android Emulator (headless, API 34)
After=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
Environment=ANDROID_SDK_ROOT=/opt/android-sdk
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/emulator
ExecStart=/opt/android-sdk/emulator/emulator -avd $AVD_NAME -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -accel on -read-only \
  -port 5554 -grpc 127.0.0.1:8554 -idle-grpc-timeout 0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now agro-emulator.service

# Wait and bring up ADB
sleep 10
/opt/android-sdk/platform-tools/adb connect 127.0.0.1:5555 || true

# Clone WebRTC bridge
mkdir -p /opt && cd /opt
if [ ! -d /opt/android-emulator-webrtc ]; then
  git clone https://github.com/google/android-emulator-webrtc.git
fi
cd /opt/android-emulator-webrtc

# Self-signed TLS certs for 8443
mkdir -p certs
if [ ! -f certs/server.key ]; then
  openssl req -x509 -nodes -newkey rsa:2048 -keyout certs/server.key -out certs/server.crt -days 365 \
    -subj "/C=US/ST=State/L=City/O=AgroTrace/OU=Emu/CN=localhost"
fi

# Minimal config for bridge (adjust if repo expects different keys)
cat >webrtc-config.yaml <<CFG
listen_addr: 0.0.0.0:8443
tls_cert_file: ./certs/server.crt
tls_key_file: ./certs/server.key
emulator_grpc_addr: 127.0.0.1:8554
adb_addr: 127.0.0.1:5555
CFG

# Build and run bridge via Docker
docker build -t emulator-webrtc:local .
cat > /opt/android-emulator-webrtc/docker-compose.yaml <<COMPOSE
services:
  emulator-webrtc:
    image: emulator-webrtc:local
    container_name: emulator-webrtc
    network_mode: host
    volumes:
      - /opt/android-emulator-webrtc/webrtc-config.yaml:/app/config.yaml:ro
      - /opt/android-emulator-webrtc/certs:/app/certs:ro
    command: ["--config", "/app/config.yaml"]
    restart: unless-stopped
COMPOSE

docker compose up -d

echo "======== Summary ========"
echo "Emulator service: systemctl status agro-emulator.service"
echo "WebRTC UI (self-signed): https://$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'):8443"
echo "ADB (local to VPS): 127.0.0.1:5555"
EOF
chmod +x /root/setup-emulator-webrtc.sh
/root/setup-emulator-webrtc.sh
```

2) Open firewall
```
ufw allow 8443/tcp
ufw allow 10000:10100/udp
```

3) Verify
```
journalctl -u agro-emulator.service -n 100 --no-pager
adb connect 127.0.0.1:5555 && adb devices
# In your browser: https://<VPS_IP>:8443 (accept self-signed cert)
```

Run AgroTrace on the VPS
1) Backend
```
cd /opt
git clone <your GitHub repo URL> agritrace && cd agritrace
cp .env.example backend/.env
npm install
npm run dev:backend
# Health: curl http://127.0.0.1:4000/health
```

2) Mobile app (Expo) against emulator
The Android emulator accesses services on the VPS host via `http://10.0.2.2`.

```
cd /opt/agritrace
echo "EXPO_PUBLIC_API_URL=http://10.0.2.2:4000" > mobile/.env
cd mobile
npx --yes expo start --android --non-interactive --port 8082
```

Notes
- If you prefer to run the backend on a different port, update `mobile/.env` accordingly.
- For production WebRTC, replace self-signed certs with valid TLS, and consider adding TURN for NAT traversal.

