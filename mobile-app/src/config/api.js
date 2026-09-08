// mobile-app/src/config/api.js
// Centralized API Configuration for FlirtEasy / Linksy Mobile

/**
 * Replace this URL with your deployed Cloudflare Worker URL:
 * e.g. 'https://linksy-mobile-ai.<your-cloudflare-subdomain>.workers.dev'
 */
export const DEFAULT_CLOUDFLARE_WORKER_URL = 'https://linksy-mobile-worker.chatgpt-miisco.workers.dev';

// Mobile shared secret (matches env.MOBILE_APP_SECRET in Cloudflare Worker)
export const DEFAULT_MOBILE_APP_SECRET = 'linksy-mobile-secret';

class ApiConfigManager {
  constructor() {
    this._workerBaseUrl = DEFAULT_CLOUDFLARE_WORKER_URL;
    this._appSecret = DEFAULT_MOBILE_APP_SECRET;
  }

  get workerBaseUrl() {
    return this._workerBaseUrl;
  }

  setWorkerBaseUrl(url) {
    if (url && typeof url === 'string') {
      this._workerBaseUrl = url.replace(/\/+$/, ''); // trim trailing slashes
    }
  }

  get appSecret() {
    return this._appSecret;
  }

  setAppSecret(secret) {
    if (secret && typeof secret === 'string') {
      this._appSecret = secret.trim();
    }
  }

  getEndpoints() {
    const base = this._workerBaseUrl;
    return {
      BASE: base,
      HEALTH: `${base}/health`,
      AI_CHAT: `${base}/api/ai/chat`,
      AI_REWRITE: `${base}/api/ai/rewrite`,
      AI_BIO: `${base}/api/ai/bio`,
      AUTH_SEND_OTP: `${base}/api/auth/send-otp`,
      HYPERBEAM_START: `${base}/api/hyperbeam/start-session`,
      HYPERBEAM_STOP: `${base}/api/hyperbeam/stop-session`,
      HYPERBEAM_TERMINATE_ALL: `${base}/api/hyperbeam/terminate-all`,
      PUSH_REGISTER_TOKEN: `${base}/push/register-token`,
      PUSH_SEND: `${base}/push/send`,
      ERROR_REPORT: `${base}/api/errors/report`,
    };
  }

  getHeaders(customHeaders = {}) {
    return {
      'Content-Type': 'application/json',
      'X-App-Secret': this._appSecret,
      'X-Client-Platform': 'mobile',
      ...customHeaders,
    };
  }
}

export const API_CONFIG = new ApiConfigManager();
export default API_CONFIG;
