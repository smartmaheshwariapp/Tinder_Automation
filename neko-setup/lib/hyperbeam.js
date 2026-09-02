// lib/hyperbeam.js — Hyperbeam Cloud Virtual Browser Integration for FlirtEasy
'use strict';

const https = require('https');
const path = require('path');
const fs = require('fs');
const { ZipArchive } = require('archiver');
const FormData = require('form-data');

// Test secret key provided by user
const DEFAULT_HYPERBEAM_API_KEY = process.env.HYPERBEAM_API_KEY || 'sk_test_fsuC8naqJLF2lGcL8Vak2ogGyhYFldLzqCEbX2zQYf0';

const PLATFORMS = {
  tinder: 'https://tinder.com',
  bumble: 'https://bumble.com'
};

// In-memory active session tracker to prevent exceeding VM limits
let activeHyperbeamSession = null;

/**
 * Packages the clean-extension directory into an in-memory zip Buffer.
 */
function createExtensionZipBuffer() {
  return new Promise((resolve, reject) => {
    const extDir = path.join(__dirname, '..', 'clean-extension');
    if (!fs.existsSync(extDir)) {
      return resolve(null);
    }
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const buffers = [];
    archive.on('data', chunk => buffers.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(buffers)));
    archive.on('error', err => reject(err));
    archive.directory(extDir, false);
    archive.finalize();
  });
}

/**
 * Parses a standard proxy string into Hyperbeam proxy format if available.
 */
function parseProxyForHyperbeam(proxyString) {
  if (!proxyString || !proxyString.trim()) return null;
  const str = proxyString.trim();

  // Match protocol://user:pass@host:port
  const authMatch = str.match(/^(https?|socks5?|socks):\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/);
  if (authMatch) {
    const [_, protocol, username, password, host, port] = authMatch;
    return {
      server: `${host}:${port}`,
      username: username,
      password: password
    };
  }

  // Match user:pass@host:port
  const userPassMatch = str.match(/^([^:]+):([^@]+)@([^:]+):(\d+)$/);
  if (userPassMatch) {
    const [_, username, password, host, port] = userPassMatch;
    return {
      server: `${host}:${port}`,
      username: username,
      password: password
    };
  }

  // Match plain host:port
  const plainMatch = str.match(/^([a-zA-Z0-9.-]+):(\d+)$/);
  if (plainMatch) {
    return {
      server: str
    };
  }

  return null;
}

/**
 * Starts a Hyperbeam Virtual Browser session.
 * @param {object} options
 * @param {string} options.platform - 'tinder' or 'bumble'
 * @param {string} options.userId - Unique user id
 * @param {string} options.proxyIp - Optional proxy
 * @param {string} options.apiKey - Optional API key override
 * @returns {Promise<{ success: boolean, session_id: string, embed_url: string, admin_token: string }>}
 */
async function startHyperbeamSession(options = {}) {
  const {
    platform = 'tinder',
    userId = 'dev_user_1',
    proxyIp = '',
    profileId = null,
    apiKey = DEFAULT_HYPERBEAM_API_KEY,
    width = 1280,
    height = 720
  } = options;

  // 1. Terminate any active VMs on account before starting new one to prevent exceeding VM limits
  try {
    await stopAllHyperbeamVMs(apiKey);
  } catch (_) {}

  const platformKey = String(platform).toLowerCase();
  const startUrl = PLATFORMS[platformKey] || PLATFORMS.tinder;

  const vmPayload = {
    start_url: startUrl,
    width: parseInt(width, 10) || 1280,
    height: parseInt(height, 10) || 720
  };

  if (profileId) {
    vmPayload.profile = profileId;
  }

  const parsedProxy = parseProxyForHyperbeam(proxyIp);
  if (parsedProxy) {
    vmPayload.proxy = parsedProxy;
  }

  // 2. Attempt to package and upload Chrome Extension
  let zipBuffer = null;
  try {
    zipBuffer = await createExtensionZipBuffer();
    if (zipBuffer) {
      console.log(`[Hyperbeam] 📦 FlirtEasy Chrome Extension packaged (${zipBuffer.length} bytes)`);
    }
  } catch (extErr) {
    console.warn('[Hyperbeam] Extension packaging note:', extErr.message);
  }

  const sendRequest = (withExtension) => {
    return new Promise((resolve, reject) => {
      console.log(`[Hyperbeam] 🚀 Requesting Cloud Virtual Browser (${withExtension && zipBuffer ? 'with Chrome Extension' : 'standard'})...`);

      if (withExtension && zipBuffer) {
        const payloadWithExt = { ...vmPayload, extension: { field: 'ex' } };
        const form = new FormData();
        form.append('body', JSON.stringify(payloadWithExt));
        form.append('ex', zipBuffer, {
          filename: 'extension.zip',
          contentType: 'application/zip'
        });

        const headers = form.getHeaders();
        headers['Authorization'] = `Bearer ${apiKey}`;

        const req = https.request({
          hostname: 'engine.hyperbeam.com',
          port: 443,
          path: '/v0/vm',
          method: 'POST',
          headers: headers
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data || '{}');
              if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log(`[Hyperbeam] ✅ Virtual Browser with Extension ready! Session ID: ${parsed.session_id}`);
                activeHyperbeamSession = {
                  session_id: parsed.session_id,
                  embed_url: parsed.embed_url,
                  admin_token: parsed.admin_token,
                  platform: platformKey,
                  userId: userId,
                  startTime: Date.now()
                };
                resolve({
                  success: true,
                  session_id: parsed.session_id,
                  embed_url: parsed.embed_url,
                  admin_token: parsed.admin_token,
                  platform: platformKey,
                  start_url: startUrl
                });
              } else if (parsed.code === 'err_api_restricted') {
                console.warn('[Hyperbeam] Note: Extension upload restricted on free/test tier. Falling back to standard session with in-page DOM automation...');
                sendRequest(false).then(resolve).catch(reject);
              } else {
                reject(new Error(parsed.message || `Hyperbeam API error: HTTP ${res.statusCode}`));
              }
            } catch (err) {
              reject(new Error(`Failed to parse Hyperbeam response: ${err.message}`));
            }
          });
        });

        req.on('error', (err) => reject(err));
        form.pipe(req);
      } else {
        const payloadString = JSON.stringify(vmPayload);
        const req = https.request({
          hostname: 'engine.hyperbeam.com',
          port: 443,
          path: '/v0/vm',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payloadString)
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data || '{}');
              if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log(`[Hyperbeam] ✅ Virtual Browser ready! Session ID: ${parsed.session_id}`);
                activeHyperbeamSession = {
                  session_id: parsed.session_id,
                  embed_url: parsed.embed_url,
                  admin_token: parsed.admin_token,
                  platform: platformKey,
                  userId: userId,
                  startTime: Date.now()
                };
                resolve({
                  success: true,
                  session_id: parsed.session_id,
                  embed_url: parsed.embed_url,
                  admin_token: parsed.admin_token,
                  platform: platformKey,
                  start_url: startUrl
                });
              } else if (parsed.code === 'err_api_restricted') {
                if (vmPayload.profile) {
                  console.warn('[Hyperbeam] Profile persistence restricted on this key tier, retrying standard session without profile...');
                  delete vmPayload.profile;
                }
                console.warn('[Hyperbeam] Falling back to standard session with in-page DOM automation...');
                sendRequest(false).then(resolve).catch(reject);
              } else {
                reject(new Error(parsed.message || `Hyperbeam API error: HTTP ${res.statusCode}`));
              }
            } catch (err) {
              reject(new Error(`Failed to parse Hyperbeam response: ${err.message}`));
            }
          });
        });

        req.on('error', (err) => reject(err));
        req.write(payloadString);
        req.end();
      }
    });
  };

  return sendRequest(Boolean(zipBuffer));
}

/**
 * Stops an active Hyperbeam session.
 * @param {string} sessionId
 * @param {string} apiKey
 * @returns {Promise<boolean>}
 */
function stopHyperbeamSession(sessionId, apiKey = DEFAULT_HYPERBEAM_API_KEY) {
  const targetId = sessionId || (activeHyperbeamSession && activeHyperbeamSession.session_id);
  if (!targetId) return Promise.resolve(true);

  return new Promise((resolve) => {
    console.log(`[Hyperbeam] Terminating session ${targetId}...`);
    const req = https.request({
      hostname: 'engine.hyperbeam.com',
      port: 443,
      path: `/v0/vm/${targetId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`[Hyperbeam] ✅ Session ${targetId} terminated successfully.`);
        if (activeHyperbeamSession && activeHyperbeamSession.session_id === targetId) {
          activeHyperbeamSession = null;
        }
        resolve(true);
      } else {
        console.warn(`[Hyperbeam] Warning closing session ${targetId}: HTTP ${res.statusCode}`);
        if (activeHyperbeamSession && activeHyperbeamSession.session_id === targetId) {
          activeHyperbeamSession = null;
        }
        resolve(false);
      }
    });

    req.on('error', (err) => {
      console.warn('[Hyperbeam] Network warning terminating session:', err.message);
      resolve(false);
    });

    req.end();
  });
}

/**
 * Queries Hyperbeam for all active VMs and terminates every single one.
 * @param {string} apiKey
 * @returns {Promise<void>}
 */
function stopAllHyperbeamVMs(apiKey = DEFAULT_HYPERBEAM_API_KEY) {
  return new Promise((resolve) => {
    const listReq = https.request({
      hostname: 'engine.hyperbeam.com',
      port: 443,
      path: '/v0/vm',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const parsed = JSON.parse(data || '{}');
          const vms = parsed.results || [];
          console.log(`[Hyperbeam] Found ${vms.length} active VM(s) on account to terminate.`);
          const deletePromises = vms.map(vm => stopHyperbeamSession(vm.id, apiKey));
          await Promise.allSettled(deletePromises);
          activeHyperbeamSession = null;
          resolve();
        } catch (_) {
          resolve();
        }
      });
    });
    listReq.on('error', () => resolve());
    listReq.end();
  });
}

/**
 * Returns the currently active Hyperbeam session info if any.
 */
function getActiveHyperbeamSession() {
  return activeHyperbeamSession;
}

module.exports = {
  DEFAULT_HYPERBEAM_API_KEY,
  startHyperbeamSession,
  stopHyperbeamSession,
  stopAllHyperbeamVMs,
  getActiveHyperbeamSession,
  parseProxyForHyperbeam
};
