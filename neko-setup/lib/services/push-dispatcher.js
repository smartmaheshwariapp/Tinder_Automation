// neko-setup/lib/services/push-dispatcher.js
// FlirtEasy Backend Push Notification Dispatcher (Expo Push API + Supabase)
'use strict';

const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://equzoqtuskwfqnulzpmh.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_PMjEcR2288eBBUEhID4vgw_1N7zeN7H';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send an Expo Push Notification to one or multiple device tokens
 */
async function sendExpoPushNotification({ tokens, title, body, data = {}, sound = 'default', priority = 'high', badge = 1 }) {
  if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
    console.log('[Push Dispatcher] No push tokens provided, skipping.');
    return { success: false, reason: 'no_tokens' };
  }

  const tokenList = Array.isArray(tokens) ? tokens : [tokens];
  const validTokens = tokenList.filter((t) => typeof t === 'string' && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken')));

  if (validTokens.length === 0) {
    console.log('[Push Dispatcher] No valid Expo Push Tokens found in list:', tokenList);
    return { success: false, reason: 'invalid_tokens' };
  }

  const messages = validTokens.map((to) => ({
    to,
    sound,
    title,
    body,
    data,
    priority,
    badge,
    channelId: data?.type === 'goal_unlocked' ? 'matches_and_goals' : 'default',
  }));

  return new Promise((resolve) => {
    const url = new URL(EXPO_PUSH_URL);
    const postData = JSON.stringify(messages);

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(responseBody);
          console.log('[Push Dispatcher] Expo Push Response status:', res.statusCode, json);
          resolve({ success: res.statusCode === 200, data: json });
        } catch (_) {
          resolve({ success: res.statusCode === 200, raw: responseBody });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Push Dispatcher] HTTP Error:', err.message);
      resolve({ success: false, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Trigger contextual dating app notifications
 */
async function notifyUser(userId, { type = 'new_match', title, body, data = {} }) {
  console.log(`[Push Dispatcher] Dispatching ${type} to user ${userId || 'anonymous'}`);

  // 1. Fetch user push token from Supabase
  let tokens = [];
  if (userId) {
    try {
      const snapRes = await new Promise((resolve, reject) => {
        const url = new URL(`/rest/v1/user_snapshots?user_id=eq.${userId}&select=settings`, SUPABASE_URL);
        https.get(url, {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }, (res) => {
          let d = '';
          res.on('data', (c) => (d += c));
          res.on('end', () => {
            try {
              resolve(JSON.parse(d));
            } catch (_) {
              resolve([]);
            }
          });
        }).on('error', reject);
      });

      const pushToken = snapRes?.[0]?.settings?.pushToken;
      if (pushToken) tokens.push(pushToken);
    } catch (err) {
      console.warn('[Push Dispatcher] Supabase token lookup note:', err.message);
    }
  }

  // 2. Dispatch via Expo Push API
  if (tokens.length > 0) {
    await sendExpoPushNotification({
      tokens,
      title,
      body,
      data: { ...data, type },
    });
  }

  return { success: true };
}

module.exports = {
  sendExpoPushNotification,
  notifyUser,
};
