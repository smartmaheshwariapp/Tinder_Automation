# Neko Setup Guide for VPS & Live Streaming

This directory contains automated setup scripts and configurations to run **Neko** (a self-hosted virtual browser) inside a Docker container on your VPS, allowing you to use the browser and broadcast the browser session directly to streaming platforms like YouTube, Twitch, or TikTok via RTMP.

---

## 🛠️ Step 1: Customize Configuration

Before uploading files to your VPS, edit the [docker-compose.yml](file:///c:/Users/MIISCO/source/repos/Tinder/neko-setup/docker-compose.yml) file to update the following variables:

1. **`NEKO_WEBRTC_NAT1TO1`**: Replace `YOUR_VPS_PUBLIC_IP` with your VPS public IP address (e.g. `82.29.160.123`). This is critical for the WebRTC stream to connect.
2. **`NEKO_MEMBER_MULTIUSER_USER_PASSWORD` & `NEKO_MEMBER_MULTIUSER_ADMIN_PASSWORD`**: Replace `neko` and `admin` with strong passwords of your choice.
3. **`NEKO_BROADCAST_URL`**: Update this with your RTMP ingestion link and streaming key:
   - **YouTube Example**: `rtmp://a.rtmp.youtube.com/live2/your-stream-key`
   - **Twitch Example**: `rtmp://live.twitch.tv/app/your-stream-key`
4. **`NEKO_BROADCAST_AUTOSTART`**: 
   - Set to `"true"` if you want Neko to begin streaming to your RTMP URL immediately upon container boot.
   - Set to `"false"` (recommended) to start and stop it manually via the Neko admin interface.

---

## 🚀 Step 2: Upload Files to your VPS

Open your terminal (PowerShell, Command Prompt, or Git Bash) on your local computer and use `scp` to upload the setup directory to your VPS. 

Since you have an SSH key named `delight.pem` in your `.ssh` directory, run a command like this (replace `YOUR_VPS_IP` with your VPS IP address):

```bash
# Upload the setup files to your VPS home directory
scp -i ~/.ssh/delight.pem -r C:\Users\MIISCO\source\repos\Tinder\neko-setup ubuntu@YOUR_VPS_IP:~/neko-setup
```
*(If your VPS username is different, replace `ubuntu` with `root`, `debian`, etc.)*

---

## ⚙️ Step 3: Run the Setup on your VPS

1. Connect to your VPS via SSH:
   ```bash
   ssh -i ~/.ssh/delight.pem ubuntu@YOUR_VPS_IP
   ```
2. Navigate to the uploaded directory:
   ```bash
   cd ~/neko-setup
   ```
3. Make the setup script executable:
   ```bash
   chmod +x setup.sh
   ```
4. Run the script as root:
   ```bash
   sudo ./setup.sh
   ```

The script will automatically install Docker, Docker Compose, Node.js, configure the firewall, and register the Neko Orchestrator as a background daemon service (`neko-orchestrator`).

---

## 📺 Step 4: Access and Controls

1. The **Neko Session Orchestrator** is now running continuously in the background on port `3001`.
2. When you start a session from your mobile app, the app communicates with the orchestrator, which launches Neko.
3. The WebRTC stream can then be accessed directly from your mobile app WebView (connecting to port `8080` on the VPS).
4. If you want to check the status or view the logs of the background orchestrator service on your VPS, run:
   ```bash
   sudo systemctl status neko-orchestrator
   ```
