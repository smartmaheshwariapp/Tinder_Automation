# Technical Proposal: Scaling Multi-User Remote Browser Automation (100+ Sessions)

This document outlines the proposed architecture, hardware requirements, proxy strategy, and cost estimates for scaling our automated dating app assistant (using the FlirtEasy extension) to support 100+ concurrent user accounts.

---

## 1. Executive Summary
To execute swiping and message automation on behalf of 100+ users, we need to run 100+ isolated browser sessions. Running these locally or on standard single-IP cloud servers will trigger anti-bot measures (IP reputation and concurrent session checks). 

The recommended solution is a **Centrally Orchestrated Container Cluster (Neko/Docker)** running on a dedicated cloud server, with each container's network stack routed through a dedicated **Static Residential (ISP) Proxy**.

---

## 2. Proposed Architecture

```
                                  +------------------------------------+
                                  |            User Client             |
                                  +------------------------------------+
                                                     | (WebRTC Stream)
                                                     v
                                  +------------------------------------+
                                  |       Management Dashboard         |
                                  +------------------------------------+
                                                     | (Orchestrates)
                                                     v
                                  +------------------------------------+
                                  |    Central VPS / Dedicated Host    |
                                  +------------------------------------+
                                    |                |               |
             +----------------------+                |               +----------------------+
             | (Port 8081)                           | (Port 8082)                          | (Port 8100)
             v                                       v                                      v
+--------------------------+            +--------------------------+            +--------------------------+
|  Neko Container (User 1) |            |  Neko Container (User 2) |            | Neko Container (User 100)|
|  - Extension Preloaded   |            |  - Extension Preloaded   |            |  - Extension Preloaded   |
|  - Profile Volume Mount  |            |  - Profile Volume Mount  |            |  - Profile Volume Mount  |
+--------------------------+            +--------------------------+            +--------------------------+
             |                                       |                                      |
             | (SOCKS5/HTTP)                         | (SOCKS5/HTTP)                        | (SOCKS5/HTTP)
             v                                       v                                      v
+--------------------------+            +--------------------------+            +--------------------------+
|  Residential Proxy A     |            |  Residential Proxy B     |            |  Residential Proxy C     |
+--------------------------+            +--------------------------+            +--------------------------+
             |                                       |                                      |
             v                                       v                                      v
+--------------------------+            +--------------------------+            +--------------------------+
| Target Dating Platform   |            | Target Dating Platform   |            | Target Dating Platform   |
+--------------------------+            +--------------------------+            +--------------------------+
```

### Core Architecture Components
1. **Containerized Browsers (Neko)**:
   - Each user gets a dedicated Docker container running **Neko** (a self-hosted virtual browser that exposes a Chromium instance via WebRTC).
   - The FlirtEasy extension is pre-installed in the container image.
2. **Session Persistence**:
   - Chromium user data directories (`--user-data-dir`) are mapped to persistent Docker volumes on the host filesystem: `/data/sessions/user_{id}`.
   - When a user logs in, their cookies, localStorage, IndexedDB, and credentials remain saved. The container can be stopped and restarted without requiring re-authentication.
3. **Proxy Routing per Container**:
   - Chromium inside each container is configured on launch to route all outgoing requests through a dedicated proxy:
     ```bash
     chromium-browser --proxy-server="socks5://username:password@proxy_ip:port"
     ```

---

## 3. Network Strategy: Why Proxies Over Multiple VPSs?

We compared deploying 100+ separate small VPS nodes against running a single central server utilizing residential proxies:

| Attribute | Option A: Central Server + Proxies (Recommended) | Option B: 100+ Micro VPSs |
| :--- | :--- | :--- |
| **IP Address Quality** | **High (Residential/ISP)**. Appears as legitimate home/mobile connections. Low ban rates. | **Low (Datacenter)**. IPs associated with AWS, DigitalOcean, etc., are heavily flagged/blocked by dating platforms. |
| **Orchestration Complexity** | **Low**. Managed locally on one machine via Docker socket/API. | **High**. Requires distributed orchestration, multi-host sync, and massive network overhead. |
| **Maintenance** | **Low**. One OS to maintain and secure. | **High**. 100+ OS installations to patch, update, and manage. |
| **Estimated Cost** | **~$220 – $400 / month** | **~$500 – $600 / month** |

---

## 4. Hardware Resource & Sizing Requirements (For 100 Users)

Chromium is resource-intensive. Below is the hardware projection to handle 100 concurrent active browser instances.

* **RAM**: Chromium requires ~512MB to 1.5GB RAM per instance depending on the target site complexity. 
  * *Target*: **128 GB RAM** (provides headroom for peak usage).
* **CPU**: Encoding WebRTC streams for 100 active sessions takes significant CPU cycles. 
  * *Target*: **16 Cores / 32 Threads** (minimum) or **24 Cores / 48 Threads** (recommended).
* **Disk**: ~500MB per persistent browser profile.
  * *Target*: **500 GB NVMe SSD** (fast read/write speeds for browser databases).
* **Bandwidth**: 1Gbps unmetered port.

---

## 5. Recommended Providers & Cost Estimate

### Compute Providers (Central Server)
1. **Hetzner Dedicated Server (AX/EX Series)**:
   * *Specs*: AMD Ryzen 9 (12/16 Cores), 128 GB RAM, 2x 1.92 TB NVMe.
   * *Cost*: **~$75 – $95 / month**.
2. **Contabo (Cloud VPS XL)**:
   * *Specs*: 16 vCPU Cores, 60 GB RAM. (We would need 2 of these to balance load).
   * *Cost*: **~$70 / month** (for 2 nodes).

### Proxy Providers (Static Residential/ISP)
To bypass bot detection, we need static IPs assigned by real consumer ISPs (Comcast, AT&T, Verizon, etc.).
1. **Webshare (Static Residential / ISP)**:
   * *Specs*: SOCKS5/HTTP, unlimited bandwidth options, high uptime.
   * *Cost*: **~$1.50 – $3.00 / IP** (approx. **$150 – $300 / month** for 100 IPs).
2. **Proxy-Seller (ISP Proxies)**:
   * *Specs*: SOCKS5/HTTP, dedicated channel, multi-country selection.
   * *Cost*: **~$2.50 – $3.50 / IP** (approx. **$250 – $350 / month** for 100 IPs).

### Total Monthly Estimate: ~$225 – $400 USD / Month

---

## 6. Key Technical Challenges & Mitigation Strategies

### A. Anti-Bot and Fingerprint Leaks
Dating apps track advanced browser fingerprints (Canvas, WebGL, WebRTC leaks, AudioContext, and Navigator properties).
* **Mitigation**: 
  * Disable WebRTC direct IP leakage using Chromium flags (`--force-webrtc-ip-handling-policy=disable_non_proxied_udp`).
  * Preload a fingerprint randomized extension or use anti-detect browser binary bases (like GoLogin/Adspower engines) inside the container rather than vanilla Chromium.

### B. High Idle Resource Usage
Keeping 100 browsers running concurrently consumes substantial compute even when idle.
* **Mitigation (Auto-Scaling)**: 
  * Implement an automated lifecycle policy: Spin up the Neko container *only* when the user logs in or when the swiper agent is scheduled to run.
  * Hibernate/destroy containers after 15 minutes of inactivity, saving the Chrome profile to the persistent directory.

### C. Captchas and SMS Verifications
* **Mitigation**:
  * Because the browser runs in a container via WebRTC, when a user encounters a Captcha or SMS request, the app dashboard forwards the WebRTC feed. The user can interact with the browser directly through the WebRTC client to solve the captcha/SMS, after which the automated extension resumes task execution.
