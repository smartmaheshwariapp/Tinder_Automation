# FlirtEasy — Hyperbeam Cloud & Neko Infrastructure Guide (200 Users Production Scaling)

This guide details the complete production architecture, session persistence, proxy strategies, cost calculations, and scaling operations for running **200 dating automation users** on **Hyperbeam Cloud** and **Self-Hosted Neko**.

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Session & Cookie Persistence (Zero-Waste Billing)](#2-session--cookie-persistence-zero-waste-billing)
3. [Proxy Strategy for 200 Dating Accounts](#3-proxy-strategy-for-200-dating-accounts)
4. [Cost Breakdown for 200 Users](#4-cost-breakdown-for-200-users)
5. [Hyperbeam Pro / Production Setup](#5-hyperbeam-pro--production-setup)
6. [Self-Hosted Neko Setup Alternative (Lowest Cost)](#6-self-hosted-neko-setup-alternative-lowest-cost)
7. [Production Best Practices & Anti-Ban Security](#7-production-best-practices--anti-ban-security)

---

## 1. Architecture Overview

FlirtEasy supports a **hybrid dual-engine architecture**:

```
                                  ┌──────────────────────────────┐
                                  │   FlirtEasy React Native App │
                                  │   (iOS / Android Client)     │
                                  └──────────────┬───────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
        ┌──────────────────────────────┐                  ┌──────────────────────────────┐
        │   Option A: Hyperbeam Cloud  │                  │   Option B: Self-Hosted Neko │
        │   (Serverless Cloud Browser) │                  │   (Docker + Dedicated VPS)   │
        ├──────────────────────────────┤                  ├──────────────────────────────┤
        │ • Zero server management     │                  │ • 100% Free & Unlimited      │
        │ • Instant auto-scaling       │                  │ • Flat $50–$70/mo server cost│
        │ • Pay per active minute only │                  │ • Complete hardware control  │
        │ • S3 Cloud Profile Storage   │                  │ • Local volume persistence   │
        └──────────────┬───────────────┘                  └──────────────┬───────────────┘
                       │                                                 │
                       └────────────────────────┬────────────────────────┘
                                                ▼
                               ┌──────────────────────────────────┐
                               │   Static ISP / Residential Proxy │
                               │   (1 Dedicated IP per User)      │
                               └────────────────┬─────────────────┘
                                                ▼
                               ┌──────────────────────────────────┐
                               │     Tinder / Bumble Web PWA      │
                               │   (Swipe / Match / AI Chat)      │
                               └──────────────────────────────────┘
```

---

## 2. Session & Cookie Persistence (Zero-Waste Billing)

### The Problem:
If virtual machines run 24/7 for 200 users, cloud costs multiply rapidly ($0.08/hr × 24 hrs × 30 days × 200 = **$11,520/mo**). Conversely, if you destroy VMs when users close the app, users risk getting logged out and having to re-verify OTP/SMS every time.

### The Solution: Profile Persistence Architecture

Both Hyperbeam and Neko support **stateful profile persistence**. The VM is only alive while the user is actively swiping/chatting.

#### Hyperbeam Profile Persistence Workflow
1. **First Launch (Create & Save Profile)**:
   ```json
   POST https://engine.hyperbeam.com/v0/vm
   {
     "start_url": "https://tinder.com",
     "profile": true,
     "width": 390,
     "height": 844,
     "proxy": { "server": "proxy.ip:port", "username": "...", "password": "..." }
   }
   ```
   Hyperbeam returns a `session_id`. Store this `session_id` in your user database as `user.hyperbeam_profile_id`.

2. **User Leaves / Closes App**:
   ```bash
   DELETE https://engine.hyperbeam.com/v0/vm/{session_id}
   ```
   - Hyperbeam encrypts Chromium cookies, `localStorage`, IndexedDB, and auth tokens, storing them in S3 cloud storage.
   - **The VM stops running, reducing billing to $0.00 while the user is away.**

3. **User Returns Later**:
   ```json
   POST https://engine.hyperbeam.com/v0/vm
   {
     "start_url": "https://tinder.com",
     "profile": "saved_session_id_from_step_1",
     "width": 390,
     "height": 844,
     "proxy": { "server": "proxy.ip:port", "username": "...", "password": "..." }
   }
   ```
   - Hyperbeam boots a fresh VM, decrypts the profile, and opens Tinder **already authenticated**. No OTP or login screen required.

---

## 3. Proxy Strategy for 200 Dating Accounts

Dating platforms (Tinder, Bumble, Hinge) employ strict anti-fraud detection. Using the wrong proxy type will trigger phone re-verification loops or account bans.

### Proxy Types Comparison

| Proxy Category | Ban Risk | Stability | Recommended Providers | Est. Price (200 IPs) |
| :--- | :--- | :--- | :--- | :--- |
| **Static ISP / Residential** ⭐ *(Required)* | **Very Low (<1%)** | Dedicated IP never changes; identical to home WiFi | Webshare, IPRoyal, Smartproxy, Rayobyte | **$300 – $400 / month** ($1.50–$2/IP) |
| **Rotating Residential (Per GB)** | Medium | IP changes each request (triggers Tinder suspicious login) | Bright Data, Oxylabs | ~$60 – $100 / month |
| **Datacenter / VPN IPs** | **High (>90%)** | Instantly flagged by Cloudflare/Datadome | DigitalOcean, AWS, NordVPN | *Not Recommended* |

### Best Practice for 200 Users:
- Allocate **1 Dedicated Static Residential IP per user**.
- Bind the proxy IP to the user's database record:
  ```javascript
  const userProxy = {
    server: `${user.proxy_host}:${user.proxy_port}`,
    username: user.proxy_username,
    password: user.proxy_password
  };
  ```

---

## 4. Cost Breakdown for 200 Users

Assuming:
- **Total User Base**: 200 Registered Users
- **Daily Usage**: Average 1.5 hours per user / day
- **Concurrent Peak Load**: 50 to 100 simultaneous sessions

### Cost Model A: Hyperbeam Cloud + Dedicated Static Proxies

| Expense Item | Calculation | Monthly Cost |
| :--- | :--- | :--- |
| **Hyperbeam Cloud Streaming** | 200 users × 1.5 hrs/day × 30 days = 9,000 hrs @ $0.08/hr | **$720.00** |
| **200 Static ISP Proxies** | 200 dedicated IPs × $1.75 / IP / month | **$350.00** |
| **Server Infrastructure** | Fully Serverless (0 servers to manage) | **$0.00** |
| **Total Monthly Cost** | | **$1,070.00 / month** |
| **Cost Per User / Month** | `$1,070 / 200` | **~$5.35 / user** |

---

### Cost Model B: Self-Hosted Neko Server + Dedicated Static Proxies *(Maximum Margin)*

| Expense Item | Calculation | Monthly Cost |
| :--- | :--- | :--- |
| **Dedicated High-Performance Server** | 1× Hetzner AX102 (AMD Ryzen 9, 128 GB RAM, 1 Gbps unmetered) | **$110.00** |
| **200 Static ISP Proxies** | 200 dedicated IPs × $1.75 / IP / month | **$350.00** |
| **Browser Streaming Fees** | Self-hosted Neko Docker (Unlimited hours) | **$0.00** |
| **Total Monthly Cost** | | **$460.00 / month** |
| **Cost Per User / Month** | `$460 / 200` | **~$2.30 / user** |

---

## 5. Hyperbeam Pro / Production Setup

To enable scaling past the 2-VM free tier limit:

1. **Activate Pay-As-You-Go**:
   - Log into [Hyperbeam Dashboard](https://hyperbeam.com).
   - Go to **Billing** and attach a credit/debit card.
   - Concurrency limits increase from 2 to unlimited simultaneous VMs.
2. **Generate Live Production Secret Key**:
   - Copy your key (`sk_live_...`).
3. **Configure Environment Variables**:
   - In `mobile-app/src/screens/PlatformConfigScreen.js`:
     ```javascript
     const HYPERBEAM_KEY = process.env.EXPO_PUBLIC_HYPERBEAM_KEY || 'sk_live_...';
     ```
   - In `neko-setup/.env`:
     ```env
     HYPERBEAM_API_KEY=sk_live_...
     ```

---

## 6. Self-Hosted Neko Setup Alternative (Lowest Cost)

If you prefer self-hosting on your own dedicated server:

### Hardware Sizing for 200 Users (50–100 Concurrent):
- **CPU**: 16 Cores / 32 Threads (AMD Ryzen 9 or AMD EPYC)
- **RAM**: 64 GB to 128 GB DDR4/DDR5
- **Network**: 1 Gbps unmetered port
- **Recommended Provider**: [Hetzner Dedicated](https://www.hetzner.com/dedicated-rootserver) (~$60–$110/mo) or OVH.

### Docker Multi-Container Architecture:
In `neko-setup/docker-compose.yml`:
```yaml
services:
  neko:
    image: "ghcr.io/m1k1o/neko/chromium:latest"
    container_name: neko
    shm_size: "2gb"
    environment:
      NEKO_DESKTOP_SCREEN: "390x844@30"
      NEKO_START_URL: "https://tinder.com"
      NEKO_WEBRTC_NAT1TO1: "YOUR_SERVER_PUBLIC_IP"
      NEKO_EPR: "52000-52100"
    volumes:
      - ./sessions/${USER_ID}:/home/neko/.config/chromium
```

---

## 7. Production Best Practices & Anti-Ban Security

1. **Safe Action Scheduling**:
   - Maximum 50–70 likes per session.
   - Minimum 1.5s – 3.5s randomized delay between swipes.
   - Natural typing simulation (100ms – 250ms per keystroke).
2. **Automated Teardown**:
   - Always invoke `DELETE /v0/vm/{sessionId}` when a user navigates away to prevent idle cloud billing.
3. **Session Mutual Exclusivity**:
   - Always run `terminatePreviousSessions()` before launching a new session to ensure clean slot management.
