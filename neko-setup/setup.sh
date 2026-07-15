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
  apt-get update && apt-get install -y docker-compose-plugin || yum install -y docker-compose-plugin || echo "Warning: Could not install docker-compose via package manager. Please install manually."
else
  echo "[+] Docker Compose v2 is available."
fi

# 4. Open Firewall Ports
echo "[-] Configuring Firewall Ports..."
if [ -x "$(command -v ufw)" ]; then
  echo "[*] UFW detected. Opening Neko ports..."
  ufw allow 8080/tcp comment 'Neko Web UI'
  ufw allow 52000:52100/udp comment 'Neko WebRTC'
  ufw reload
elif [ -x "$(command -v firewall-cmd)" ]; then
  echo "[*] Firewalld detected. Opening Neko ports..."
  firewall-cmd --permanent --add-port=8080/tcp
  firewall-cmd --permanent --add-port=52000-52100/udp
  firewall-cmd --reload
else
  echo "[!] No standard firewall (UFW/Firewalld) detected. Please ensure ports 8080/tcp and 52000-52100/udp are open in your Cloud Provider's console (Security Groups)."
fi

# 5. Start Neko Container
echo "[-] Launching Neko container via Docker Compose..."
if [ -f "docker-compose.yml" ]; then
  docker compose up -d
  echo "============================================="
  echo "[+] Neko is now deployed and running!"
  echo "[+] Access Web UI: http://your-vps-ip:8080"
  echo "============================================="
else
  echo "Error: docker-compose.yml not found in the current directory."
  echo "Please place docker-compose.yml in the same folder as this script and run it again."
  exit 1
fi
