/**
 * ============================================================================
 * FlirtEasy / Linksy Mobile Cloudflare Worker
 * File: mobile_worker.js
 * 
 * Tailored specifically for the Mobile App:
 *  - AI Chat Proxy (OpenAI GPT-4o / GPT-4o-mini) for automated dating replies
 *  - AI Dating Humanizer (Anthropic Claude / OpenAI) with Levenshtein guardrail
 *  - AI Dating Bio Generator endpoint
 *  - Hyperbeam Cloud Virtual Browser session management
 *  - Expo Push Notification dispatcher (matches, date confirmations, phone unlocks)
 *  - Mobile client diagnostic error reporting
 * ============================================================================
 */

// ── Default Humanizer Prompt Template ──────────────────────────────────────
const DEFAULT_HUMANIZER_TEMPLATE = `You are a subtle text editor for a dating app. Your ONLY job is to swap out any word or phrase that sounds robotic or AI-generated — while keeping everything else identical.

Style: {{style}}
Language: {{language}}{{genderLine}}

Here are examples of the EXACT level of change expected:

EXAMPLE 1 (minimal swap):
Original: "I really enjoy spending time outdoors and exploring new places!"
Edited:   "I really enjoy being outside and discovering new spots!"
Why: Only "spending time outdoors" → "being outside" and "exploring new places" → "discovering new spots" changed. Structure identical.

EXAMPLE 2 (already human — return unchanged):
Original: "haha yeah always around. so what's the plan for later?"
Edited:   "haha yeah always around. so what's the plan for later?"
Why: Already sounds natural. Nothing changed.

EXAMPLE 3 (Hebrew, minimal):
Original: "היה סבבה, עשיתי קצת עבודה. מה התוכניות לערב?"
Edited:   "היה סבבה, עבדתי קצת. מה התוכניות לערב?"
Why: Only "עשיתי קצת עבודה" tightened to "עבדתי קצת". Slang "סבבה" kept. Structure kept.

EXAMPLE 4 (Hebrew, already human — return unchanged):
Original: "יאללה, תשלחי לי ונמשיך שם! חחח"
Edited:   "יאללה, תשלחי לי ונמשיך שם! חחח"
Why: Casual and natural. Nothing changed.

Now edit this message:
Original: "{{message}}"

Output ONLY the edited message. No explanation. No quotes.`;

// ── Levenshtein Distance Guardrail ──────────────────────────────────────────
function levenshtein(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// ── JSON Response Helper ───────────────────────────────────────────────────
function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// ── Mobile Worker Main Export ──────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Secret, X-User-Id, X-Client-Platform',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const method = request.method;

    // ── Optional Security Gate ─────────────────────────────────────────────
    // If MOBILE_APP_SECRET is configured in Cloudflare environment secrets,
    // verify the request header; otherwise permit (seamless development mode).
    if (env.MOBILE_APP_SECRET) {
      const authHeader = request.headers.get('Authorization') || '';
      const appSecret = request.headers.get('X-App-Secret') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      const isPublicEndpoint = url.pathname === '/' || url.pathname === '/health';
      if (!isPublicEndpoint && token !== env.MOBILE_APP_SECRET && appSecret !== env.MOBILE_APP_SECRET) {
        return jsonResponse({ success: false, error: 'Unauthorized: Invalid mobile app secret' }, 401, corsHeaders);
      }
    }

    try {
      // =====================================================================
      // 1. HEALTH CHECK & STATUS
      // =====================================================================
      if ((url.pathname === '/' || url.pathname === '/health') && method === 'GET') {
        return jsonResponse({
          status: 'ok',
          service: 'linksy-mobile-worker',
          version: '2.0.0',
          endpoints: [
            'POST /api/ai/chat',
            'POST /api/ai/rewrite',
            'POST /api/ai/bio',
            'POST /api/auth/send-otp',
            'POST /api/hyperbeam/start-session',
            'POST /api/hyperbeam/stop-session',
            'POST /api/hyperbeam/terminate-all',
            'POST /push/register-token',
            'POST /push/send',
            'POST /api/errors/report',
          ],
          hasOpenAIKey: Boolean(env.OPENAI_API_KEY),
          hasAnthropicKey: Boolean(env.ANTHROPIC_API_KEY),
          hasHyperbeamKey: Boolean(env.HYPERBEAM_API_KEY),
          hasZapierEmail: Boolean(env.ZAPIER_EMAIL_WEBHOOK_URL),
          hasResendKey: Boolean(env.RESEND_API_KEY),
        }, 200, corsHeaders);
      }

      // =====================================================================
      // 2. AI CHAT COMPLETIONS (OpenAI GPT-4o / GPT-4o-mini)
      // =====================================================================
      if (url.pathname === '/api/ai/chat' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const apiKey = env.OPENAI_API_KEY;

        if (!apiKey) {
          return jsonResponse({
            success: false,
            error: 'OPENAI_API_KEY is not configured in Cloudflare Worker environment variables.',
          }, 500, corsHeaders);
        }

        const model = body.model || 'gpt-4o-mini';
        const messages = body.messages || [];
        const temperature = body.temperature ?? 0.85;
        const maxTokens = body.max_tokens ?? 120;

        if (!Array.isArray(messages) || messages.length === 0) {
          return jsonResponse({ success: false, error: 'messages array is required' }, 400, corsHeaders);
        }

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
        });

        const openaiData = await openaiResponse.json();

        if (!openaiResponse.ok) {
          console.error('[OpenAI Proxy Error]', openaiData);
          return jsonResponse({
            success: false,
            error: openaiData.error?.message || 'OpenAI API error',
          }, openaiResponse.status, corsHeaders);
        }

        return jsonResponse({
          success: true,
          ...openaiData,
        }, 200, corsHeaders);
      }

      // =====================================================================
      // 3. AI DATING HUMANIZER (Anthropic Claude or OpenAI Fallback)
      // =====================================================================
      if (url.pathname === '/api/ai/rewrite' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const { message, style, language, matchGender, senderGender } = body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          return jsonResponse({ success: false, error: 'message string is required' }, 400, corsHeaders);
        }

        const styleLabel = style || 'casual';
        const languageLabel = language || 'the same language as the original message';

        const genderLine = (() => {
          if (!matchGender) return '';
          const mg = matchGender.toLowerCase();
          const matchIsFemale = mg === 'female' || mg === 'woman' || mg === 'f';
          const matchIsMale = mg === 'male' || mg === 'man' || mg === 'm';
          const matchLabel = matchIsFemale ? 'female (woman)' : matchIsMale ? 'male (man)' : matchGender;
          const sg = senderGender ? senderGender.toLowerCase() : null;
          const senderIsFemale = sg === 'female' || sg === 'woman' || sg === 'f';
          const senderIsMale = sg === 'male' || sg === 'man' || sg === 'm';
          const senderLabel = senderIsFemale ? 'female' : senderIsMale ? 'male' : null;
          const senderPart = senderLabel ? ` The sender is ${senderLabel}.` : '';
          return `\nMatch gender: ${matchLabel}.${senderPart} CRITICAL: use grammatically correct gendered forms throughout — verb conjugations, pronouns, adjectives must all match the match's gender. Do NOT default to masculine forms when addressing or referring to a female match.`;
        })();

        const rewritePrompt = DEFAULT_HUMANIZER_TEMPLATE
          .replace(/\{\{style\}\}/g, styleLabel)
          .replace(/\{\{language\}\}/g, languageLabel)
          .replace(/\{\{genderLine\}\}/g, genderLine)
          .replace(/\{\{message\}\}/g, message.trim());

        // Mode A: Anthropic Claude (Preferred humanizer engine)
        if (env.ANTHROPIC_API_KEY) {
          try {
            const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                model: body.model || 'claude-3-5-haiku-latest',
                max_tokens: 150,
                temperature: 0.3,
                messages: [{ role: 'user', content: rewritePrompt }],
              }),
            });

            if (claudeRes.ok) {
              const claudeData = await claudeRes.json();
              const rewritten = claudeData?.content?.[0]?.text?.trim();

              if (rewritten) {
                // Levenshtein Guardrail: If Claude changed > 45% of chars, avoid over-editing
                const original = message.trim();
                const maxDistance = Math.ceil(original.length * 0.45);
                const distance = levenshtein(original, rewritten);
                const finalMessage = distance > maxDistance ? original : rewritten;
                return jsonResponse({ success: true, message: finalMessage, original, source: 'claude' }, 200, corsHeaders);
              }
            }
          } catch (err) {
            console.warn('[Claude Humanizer Warning]', err.message);
          }
        }

        // Mode B: OpenAI Fallback for Humanizer
        if (env.OPENAI_API_KEY) {
          try {
            const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: rewritePrompt }],
                temperature: 0.3,
                max_tokens: 150,
              }),
            });

            if (gptRes.ok) {
              const gptData = await gptRes.json();
              const rewritten = gptData.choices?.[0]?.message?.content?.trim();
              if (rewritten) {
                const original = message.trim();
                const maxDistance = Math.ceil(original.length * 0.45);
                const distance = levenshtein(original, rewritten);
                const finalMessage = distance > maxDistance ? original : rewritten;
                return jsonResponse({ success: true, message: finalMessage, original, source: 'gpt-humanizer' }, 200, corsHeaders);
              }
            }
          } catch (err) {
            console.warn('[GPT Humanizer Warning]', err.message);
          }
        }

        // Safe Fallback: Return original message unaltered
        return jsonResponse({ success: true, message: message.trim(), source: 'fallback' }, 200, corsHeaders);
      }

      // =====================================================================
      // 4. AI DATING BIO GENERATOR
      // =====================================================================
      if (url.pathname === '/api/ai/bio' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const { userProfile, currentBioText } = body;
        const apiKey = env.OPENAI_API_KEY;

        if (!apiKey) {
          return jsonResponse({ success: false, error: 'OPENAI_API_KEY not configured' }, 500, corsHeaders);
        }

        const systemPrompt = `You are an elite modern dating coach and wingman. Write a charismatic, authentic, witty dating bio under 200 characters based on the user's profile.
Rules:
- Strictly under 220 characters.
- Natural, confident, conversational banter.
- NO clichés (never say "partner in crime", "fluent in sarcasm", "loves to laugh", "work hard play hard").
- Include a playful banter hook or conversation starter.
- Output ONLY the bio text. Do NOT wrap in quotes. No explanations.`;

        const parts = [];
        if (userProfile?.name) parts.push(`Name: ${userProfile.name}`);
        if (userProfile?.age) parts.push(`Age: ${userProfile.age}`);
        if (userProfile?.job) parts.push(`Job: ${userProfile.job}`);
        if (userProfile?.interests?.length) parts.push(`Passions: ${userProfile.interests.join(', ')}`);
        if (userProfile?.city) parts.push(`City: ${userProfile.city}`);
        if (userProfile?.lookingFor) parts.push(`Looking for: ${userProfile.lookingFor}`);

        const userPrompt = parts.length > 0
          ? `Profile attributes:\n${parts.join('\n')}\n\nCraft a catchy, high-converting bio that matches will want to reply to.`
          : `Craft a witty, confident, modern dating bio for a fun and spontaneous person.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 80,
            temperature: 0.9,
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          return jsonResponse({ success: false, error: err }, response.status, corsHeaders);
        }

        const data = await response.json();
        let bio = data.choices?.[0]?.message?.content?.trim() || '';
        bio = bio.replace(/^["'](.*)["']$/, '$1').trim();

        return jsonResponse({
          success: true,
          bio,
          source: 'gpt',
        }, 200, corsHeaders);
      }

      // =====================================================================
      // 5. HYPERBEAM CLOUD VIRTUAL BROWSER PROXY
      // =====================================================================
      if (url.pathname === '/api/hyperbeam/start-session' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const platform = String(body.platform || 'tinder').toLowerCase();
        const startUrl = platform === 'bumble' ? 'https://bumble.com' : 'https://tinder.com';
        const hbKey = env.HYPERBEAM_API_KEY;

        if (!hbKey) {
          return jsonResponse({ success: false, error: 'HYPERBEAM_API_KEY is not configured on worker' }, 500, corsHeaders);
        }

        const hbPayload = {
          start_url: startUrl,
        };
        if (body.profileId) {
          hbPayload.profile = { id: body.profileId };
        }

        const hbRes = await fetch('https://engine.hyperbeam.com/v0/vm', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hbKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(hbPayload),
        });

        const hbData = await hbRes.json();
        if (!hbRes.ok) {
          return jsonResponse({ success: false, error: hbData.message || 'Hyperbeam API error' }, hbRes.status, corsHeaders);
        }

        return jsonResponse({
          success: true,
          session_id: hbData.session_id,
          embed_url: hbData.embed_url,
          admin_token: hbData.admin_token,
          platform,
          start_url: startUrl,
        }, 200, corsHeaders);
      }

      if (url.pathname === '/api/hyperbeam/stop-session' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const sessionId = body.sessionId;
        const hbKey = env.HYPERBEAM_API_KEY;

        if (!sessionId) {
          return jsonResponse({ success: false, error: 'sessionId required' }, 400, corsHeaders);
        }

        if (!hbKey) {
          return jsonResponse({ success: false, error: 'HYPERBEAM_API_KEY not configured' }, 500, corsHeaders);
        }

        const hbRes = await fetch(`https://engine.hyperbeam.com/v0/vm/${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${hbKey}`,
          },
        });

        return jsonResponse({ success: hbRes.ok }, 200, corsHeaders);
      }

      if (url.pathname === '/api/hyperbeam/terminate-all' && method === 'POST') {
        const hbKey = env.HYPERBEAM_API_KEY;
        if (!hbKey) {
          return jsonResponse({ success: false, error: 'HYPERBEAM_API_KEY not configured' }, 500, corsHeaders);
        }

        const listResp = await fetch('https://engine.hyperbeam.com/v0/vm', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${hbKey}` },
        });

        if (!listResp.ok) {
          const errData = await listResp.text();
          return jsonResponse({ success: false, error: errData }, listResp.status, corsHeaders);
        }

        const listData = await listResp.json();
        const vms = listData?.results || [];
        const deletePromises = vms.map((vm) =>
          fetch(`https://engine.hyperbeam.com/v0/vm/${vm.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${hbKey}` },
          }).catch((e) => console.warn(`[Hyperbeam Delete VM ${vm.id}]`, e.message))
        );

        await Promise.all(deletePromises);
        return jsonResponse({ success: true, terminatedCount: vms.length }, 200, corsHeaders);
      }

      // =====================================================================
      // 6. EXPO PUSH NOTIFICATIONS DISPATCHER & TOKEN REGISTRATION
      // =====================================================================
      if (url.pathname === '/push/register-token' && method === 'POST') {
        const { userId, pushToken, platform: devPlatform } = await request.json().catch(() => ({}));
        if (!userId || !pushToken) {
          return jsonResponse({ success: false, error: 'userId and pushToken required' }, 400, corsHeaders);
        }

        // Optional Supabase integration if configured
        if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
          await fetch(`${env.SUPABASE_URL}/rest/v1/user_snapshots?user_id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              settings: { pushToken, pushPlatform: devPlatform || 'ios' },
              updated_at: new Date().toISOString(),
            }),
          }).catch(() => {});
        }

        return jsonResponse({ success: true, message: 'Push token registered successfully' }, 200, corsHeaders);
      }

      if (url.pathname === '/push/send' && method === 'POST') {
        const { userId, pushToken: directToken, title, body: notifBody, data, type } = await request.json().catch(() => ({}));

        if (!title || !notifBody) {
          return jsonResponse({ success: false, error: 'title and body are required' }, 400, corsHeaders);
        }

        let targetToken = directToken;

        // If direct push token was not passed, resolve from Supabase using userId
        if (!targetToken && userId && env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
          const snapRes = await fetch(`${env.SUPABASE_URL}/rest/v1/user_snapshots?user_id=eq.${userId}&select=settings`, {
            headers: {
              'apikey': env.SUPABASE_SERVICE_KEY,
              'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            },
          }).then((r) => r.json()).catch(() => []);
          targetToken = snapRes?.[0]?.settings?.pushToken;
        }

        if (!targetToken) {
          return jsonResponse({ success: false, error: 'Target pushToken could not be determined' }, 400, corsHeaders);
        }

        if (!targetToken.startsWith('ExponentPushToken') && !targetToken.startsWith('ExpoPushToken')) {
          return jsonResponse({ success: false, error: 'Invalid Expo push token format' }, 400, corsHeaders);
        }

        const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            to: targetToken,
            sound: 'default',
            title,
            body: notifBody,
            data: { ...(data || {}), type: type || 'new_match' },
            priority: 'high',
            channelId: type === 'goal_unlocked' ? 'matches_and_goals' : 'default',
          }]),
        });

        const pushData = await pushRes.json();
        return jsonResponse({ success: pushRes.ok, result: pushData }, pushRes.status, corsHeaders);
      }

      // =====================================================================
      // 7. AUTH EMAIL OTP DISPATCHER
      // =====================================================================
      if (url.pathname === '/api/auth/send-otp' && method === 'POST') {
        const { email, code, name } = await request.json().catch(() => ({}));

        if (!email || !code) {
          return jsonResponse({ success: false, error: 'email and code are required' }, 400, corsHeaders);
        }

        const zapierUrl = env.ZAPIER_EMAIL_WEBHOOK_URL || 'https://hooks.zapier.com/hooks/catch/27320666/ujl8uyu/';
        const resendKey = env.RESEND_API_KEY;

        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#0d0b14;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#161324;border-radius:16px;border:1px solid rgba(255,255,255,0.1);overflow:hidden;">
    <div style="background:linear-gradient(135deg,#FE3C72,#E8245C);padding:28px;text-align:center;">
      <h1 style="color:#FFFFFF;font-size:24px;font-weight:800;margin:0;letter-spacing:-0.5px;">Flint</h1>
    </div>
    <div style="padding:32px 24px;text-align:center;color:#D8D6E8;">
      <div style="font-size:18px;font-weight:600;color:#FFFFFF;margin-bottom:12px;">Hey ${name || 'there'},</div>
      <div style="font-size:14px;line-height:22px;color:#8E8DA3;margin-bottom:24px;">Here is your 6-digit verification code to sign in to Flint. This code expires in 10 minutes.</div>
      <div style="background:#1E1A30;border:1.5px solid #FE3C72;border-radius:12px;padding:18px 24px;display:inline-block;margin-bottom:24px;">
        <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#FFFFFF;font-family:monospace;">${code}</span>
      </div>
      <div style="font-size:13px;color:#8E8DA3;">If you didn't request this code, you can safely ignore this email.</div>
    </div>
    <div style="border-top:1px solid rgba(255,255,255,0.06);padding:16px;font-size:11px;color:#5A586E;text-align:center;">
      Secured by Flint AI Copilot • 256-Bit Encryption
    </div>
  </div>
</body>
</html>`;

        // Strategy A: Resend API (Recommended transactional provider)
        if (resendKey) {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: env.EMAIL_FROM || 'Flint <onboarding@resend.dev>',
              to: [email],
              subject: `${code} is your Flint verification code`,
              html: emailHtml,
            }),
          });
          const resendData = await resendRes.json();
          return jsonResponse({ success: resendRes.ok, data: resendData }, resendRes.status, corsHeaders);
        }

        // Strategy B: Zapier Webhook
        if (zapierUrl) {
          const zapRes = await fetch(zapierUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: email,
              subject: `${code} is your Flint verification code`,
              html: emailHtml,
              name: name || '',
              from_name: 'Flint',
            }),
          });
          return jsonResponse({ success: zapRes.ok }, 200, corsHeaders);
        }

        return jsonResponse({
          success: true,
          mock: true,
          message: 'No email service (RESEND_API_KEY or ZAPIER_EMAIL_WEBHOOK_URL) configured on worker.',
        }, 200, corsHeaders);
      }

      // =====================================================================
      // 8. CLIENT ERROR REPORTING
      // =====================================================================
      if (url.pathname === '/api/errors/report' && method === 'POST') {
        const errorPayload = await request.json().catch(() => ({}));
        console.warn('[Mobile Client Error Reported]', JSON.stringify(errorPayload));
        return jsonResponse({ success: true, received: true }, 200, corsHeaders);
      }

      // Fallthrough: Route not found
      return jsonResponse({ error: `Not Found: ${url.pathname}` }, 404, corsHeaders);

    } catch (fatalError) {
      console.error('[Worker Fatal Exception]', fatalError);
      return jsonResponse({
        success: false,
        error: fatalError.message || 'Internal Worker Error',
      }, 500, corsHeaders);
    }
  },
};
