#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "============================================="
echo " Starting Neko Deployment & Setup Script     "
echo "============================================="

# 1. Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (using sudo)."
  exit 1
fi

# 2. Detect OS and install Docker if not present
if ! [ -x "$(command -v docker)" ]; then
  echo "[-] Docker is not installed. Installing Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh
  echo "[+] Docker installed successfully!"
else
  echo "[+] Docker is already installed."
fi

# Ensure docker service is running
systemctl start docker || true
systemctl enable docker || true

# 3. Check for Docker Compose (v2 is standard now)
if ! docker compose version >/dev/null 2>&1; then
  echo "[-] Docker Compose v2 is not available. Installing plugin..."
  if [ -x "$(command -v apt-get)" ]; then
    apt-get update && apt-get install -y docker-compose-plugin
  elif [ -x "$(command -v yum)" ]; then
    yum install -y docker-compose-plugin
  fi
  echo "[+] Docker Compose v2 installed!"
else
  echo "[+] Docker Compose v2 is available."
fi

# 4. Install Node.js for Orchestrator
if ! [ -x "$(command -v node)" ]; then
  echo "[-] Node.js is not installed. Installing Node.js..."
  if [ -x "$(command -v apt-get)" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  elif [ -x "$(command -v yum)" ]; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
  fi
  echo "[+] Node.js installed successfully!"
else
  echo "[+] Node.js is already installed."
fi

# 5. Open Firewall Ports
echo "[-] Configuring Firewall Ports..."
if [ -x "$(command -v ufw)" ]; then
  echo "[*] UFW detected. Opening Neko & Orchestrator ports..."
  ufw allow 3001/tcp comment 'Neko Orchestrator API'
  ufw allow 8080/tcp comment 'Neko Web UI'
  ufw allow 8088/tcp comment 'Neko WebRTC TCP Mux'
  ufw allow 52000:52100/udp comment 'Neko WebRTC UDP'
  ufw reload
elif [ -x "$(command -v firewall-cmd)" ]; then
  echo "[*] Firewalld detected. Opening Neko & Orchestrator ports..."
  firewall-cmd --permanent --add-port=3001/tcp
  firewall-cmd --permanent --add-port=8080/tcp
  firewall-cmd --permanent --add-port=8088/tcp
  firewall-cmd --permanent --add-port=52000-52100/udp
  firewall-cmd --reload
else
  echo "[!] No standard firewall (UFW/Firewalld) detected. Please ensure ports 3001/tcp, 8080/tcp, 8088/tcp, and 52000-52100/udp are open in your Cloud Provider's console (Security Groups)."
fi

# 5.5 Detect VPS Public IP and write to .env
echo "[-] Detecting VPS Public IP address..."
PUBLIC_IP=$(curl -s https://api.ipify.org || wget -qO- https://api.ipify.org || echo "")

if [ -n "$PUBLIC_IP" ]; then
  echo "[+] Detected VPS Public IP: $PUBLIC_IP"
  echo "NEKO_WEBRTC_NAT1TO1=$PUBLIC_IP" > .env
  echo "[+] Saved NAT IP configuration to .env"
else
  echo "[!] Failed to auto-detect public IP. WebRTC NAT config will fall back to default settings."
fi

# 6. Setup systemd service for Neko Orchestrator
echo "[-] Setting up neko-orchestrator systemd service..."
CURRENT_DIR=$(pwd)

cat <<EOF > /etc/systemd/system/neko-orchestrator.service
[Unit]
Description=Neko Browser Session Orchestrator
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=${CURRENT_DIR}
ExecStart=/usr/bin/node orchestrator.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo "[-] Starting and enabling neko-orchestrator service..."
systemctl daemon-reload
systemctl enable neko-orchestrator
systemctl restart neko-orchestrator

echo "============================================="
echo "[+] Setup Complete!"
echo "[+] Neko Orchestrator is running on port 3000"
echo "[+] Neko WebRTC player is ready to be spawned on demand!"
echo "============================================="
