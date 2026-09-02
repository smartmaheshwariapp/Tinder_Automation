// mobile-app/src/utils/sessionManager.js
// Centralized active session lifecycle manager ensuring only ONE session is active at a time.

const HYPERBEAM_KEY = 'sk_test_fsuC8naqJLF2lGcL8Vak2ogGyhYFldLzqCEbX2zQYf0';

let activeSession = null;

/**
 * Registers a newly launched session.
 * @param {object} sessionInfo
 * @param {string} sessionInfo.sessionId
 * @param {string} sessionInfo.embedUrl
 * @param {boolean} sessionInfo.isHyperbeam
 * @param {string} sessionInfo.orchestratorUrl
 * @param {string} sessionInfo.platform
 */
export const registerActiveSession = (sessionInfo) => {
  activeSession = {
    ...sessionInfo,
    startedAt: Date.now()
  };
  console.log('[SessionManager] Registered active session:', activeSession);
};

/**
 * Returns currently active session metadata if any.
 */
export const getActiveSession = () => {
  return activeSession;
};

/**
 * Closes all previously active sessions (both Hyperbeam Cloud VMs and local/VPS Neko containers)
 * before a new session is launched.
 * @param {string} [orchestratorUrl]
 * @param {string} [apiKey]
 */
export const terminatePreviousSessions = async (orchestratorUrl = null, apiKey = HYPERBEAM_KEY) => {
  console.log('[SessionManager] 🔄 Terminating all other/previous active sessions...');

  const previous = activeSession;
  activeSession = null;

  const promises = [];

  // 1. Query Hyperbeam Cloud Engine for all active VMs and delete them all
  try {
    const listResp = await fetch('https://engine.hyperbeam.com/v0/vm', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    if (listResp.ok) {
      const listData = await listResp.json();
      const vms = listData?.results || [];
      console.log(`[SessionManager] Found ${vms.length} active Hyperbeam VM(s) to terminate.`);
      for (const vm of vms) {
        if (vm.id) {
          console.log(`[SessionManager] Terminating Hyperbeam VM: ${vm.id}`);
          promises.push(
            fetch(`https://engine.hyperbeam.com/v0/vm/${vm.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${apiKey}`
              }
            }).catch(err => console.warn(`[SessionManager] Error deleting VM ${vm.id}:`, err.message))
          );
        }
      }
    }
  } catch (listErr) {
    console.warn('[SessionManager] Warning fetching active Hyperbeam VMs:', listErr.message);
  }

  // 2. Direct delete for previous session ID if not already covered
  if (previous?.sessionId) {
    promises.push(
      fetch(`https://engine.hyperbeam.com/v0/vm/${previous.sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }).catch(err => console.warn('[SessionManager] Hyperbeam direct DELETE warning:', err.message))
    );
  }

  // 3. Orchestrator stop-session endpoint (stops running Neko Docker container & CDP sessions)
  const targetOrchestrator = orchestratorUrl || previous?.orchestratorUrl;
  if (targetOrchestrator) {
    console.log(`[SessionManager] Calling /stop-session on ${targetOrchestrator}`);
    promises.push(
      fetch(`${targetOrchestrator}/stop-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.warn('[SessionManager] /stop-session warning:', err.message))
    );

    // Also call /hyperbeam/stop-session on orchestrator
    promises.push(
      fetch(`${targetOrchestrator}/hyperbeam/stop-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: previous?.sessionId, apiKey })
      }).catch(err => console.warn('[SessionManager] /hyperbeam/stop-session warning:', err.message))
    );
  }

  try {
    await Promise.allSettled(promises);
    console.log('[SessionManager] ✅ All previous sessions terminated.');
  } catch (_) {}
};

/**
 * Terminates the currently active session (e.g. when exiting BrowserScreen).
 */
export const cleanupCurrentSession = async () => {
  if (!activeSession) return;
  await terminatePreviousSessions();
};

/**
 * Starts a Hyperbeam Cloud VM session and returns { embedUrl, sessionId }.
 * @param {object} options
 * @param {string} [options.platform='tinder']
 * @param {string} [options.proxyIp]
 * @param {string} [options.orchestratorUrl]
 * @param {string} [options.apiKey]
 * @returns {Promise<{ embedUrl: string, sessionId: string }>}
 */
export const startHyperbeamCloudSession = async ({
  platform = 'tinder',
  proxyIp = '',
  orchestratorUrl = null,
  apiKey = HYPERBEAM_KEY,
} = {}) => {
  const platformKey = (platform || 'tinder').toLowerCase();
  const startUrl = platformKey === 'bumble' ? 'https://bumble.com' : 'https://tinder.com';
  const webWidth = 1280;
  const webHeight = 720;

  // 1. Terminate previous sessions first
  await terminatePreviousSessions(orchestratorUrl, apiKey);

  let embedUrl = null;
  let sessionId = null;

  // 2. Try orchestrator /hyperbeam/start-session if available
  if (orchestratorUrl) {
    try {
      const resp = await fetch(`${orchestratorUrl}/hyperbeam/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: platformKey,
          userId: 'dev_user_1',
          proxyIp: proxyIp || '',
          apiKey,
          width: webWidth,
          height: webHeight,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.embed_url) {
          embedUrl = data.embed_url;
          sessionId = data.session_id;
        }
      }
    } catch (_) {}
  }

  // 3. Direct Cloud API Fallback (Serverless Hyperbeam Engine)
  if (!embedUrl) {
    console.log('[SessionManager] Calling Hyperbeam Cloud Engine v0/vm...');
    const bodyPayload = {
      start_url: startUrl,
      width: webWidth,
      height: webHeight,
    };
    if (proxyIp) {
      bodyPayload.proxy = { server: proxyIp };
    }

    const cloudResp = await fetch('https://engine.hyperbeam.com/v0/vm', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    const cloudData = await cloudResp.json();
    if (cloudResp.ok && cloudData?.embed_url) {
      embedUrl = cloudData.embed_url;
      sessionId = cloudData.session_id;
    } else {
      const errMsg = cloudData?.message || cloudData?.error || `HTTP ${cloudResp.status}`;
      throw new Error(errMsg);
    }
  }

  registerActiveSession({
    sessionId,
    embedUrl,
    isHyperbeam: true,
    platform,
    orchestratorUrl,
  });

  return { embedUrl, sessionId };
};
