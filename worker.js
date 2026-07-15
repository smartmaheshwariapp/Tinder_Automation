/**
 * FlirtEasy Auth Worker (Cloudflare Workers)
 * Connected to Supabase Database
 * Handles: Signup, Login, JWT Signing, Plan Verification, and AI Proxy
 */

// ============================================
// CONFIGURATION

// ============================================
const DEFAULT_PROMPT_TEMPLATE = `You are a subtle text editor for a dating app. Your ONLY job is to swap out any word or phrase that sounds robotic or AI-generated — while keeping everything else identical.

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

const SUPABASE_URL = 'https://ccfwoayuszifehykuwlg.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZndvYXl1c3ppZmVoeWt1d2xnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTc3NDI3OSwiZXhwIjoyMDg1MzUwMjc5fQ.qFpfDMjupfmRaem6Oen_o6S8bs3FwX8WbI27yRUMzkw';

// JWT Secret for signing tokens
const JWT_SECRET = 'fE$8kLm9Pq2#nR5wTx4yU6zV3aB0cD1eF7gH2jK4mN6pQ8rS0tU3vW5xY7zA9bC1dE3fG5hJ7kL9mN1pR3sT5uV7wX9yZ';

// OpenAI API Key
const OPENAI_API_KEY = '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';

// Anthropic API Key (Claude — used for the humanizer rewrite pass)
const ANTHROPIC_API_KEY = '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';

// Stripe Webhook Secret (Get this from Stripe Dashboard -> Developers -> Webhooks)
const STRIPE_WEBHOOK_SECRET = 'whsec_pm5k3doDcmpajXy2lJgdXEUaB0mEOp1N';

// Admin Secret (used by the admin panel — change this to something strong)
const ADMIN_SECRET = 'FE$adm!n#9xK2@mZ7qR4wL8vP1nT6yU3jB5cQ0hD';

// Zapier Webhook URL for email sending (Webhook → Gmail Zap)
const ZAPIER_EMAIL_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/27320666/ujl8uyu/';
const WHATSAPP_COMMUNITY_LINK = 'https://chat.whatsapp.com/E3Pi0wBW0BZGWmiebu79U4';

// Trial limits
const TRIAL_LIMITS = {
    likes: 300,
    messages: 30
};

export default {
    // Cloudflare Cron Trigger — runs on schedule set in Cloudflare dashboard
    async scheduled(event, env, ctx) {
        ctx.waitUntil(processEmailQueue());
    },

    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const method = request.method;

        // CORS Headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Secret, X-Admin-Email',
        };

        if (method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // ============================================
            // 1. SIGNUP ENDPOINT
            // ============================================
            if (url.pathname === '/auth/signup' && method === 'POST') {
                const { email, password, fullName } = await request.json();

                if (!email || !password) {
                    return jsonResponse({ success: false, error: 'Email and password required' }, 400, corsHeaders);
                }

                if (password.length < 6) {
                    return jsonResponse({ success: false, error: 'Password must be at least 6 characters' }, 400, corsHeaders);
                }

                // Check if user exists
                const existingUser = await supabaseQuery('users', 'email', email);

                // Check if the query itself failed
                if (existingUser && existingUser.error) {
                    return jsonResponse({ success: false, error: 'Database error: ' + existingUser.message }, 500, corsHeaders);
                }

                if (existingUser && existingUser.length > 0) {
                    return jsonResponse({ success: false, error: 'Email already registered' }, 409, corsHeaders);
                }

                // Hash password
                const passwordHash = await hashPassword(password);

                // Create user in Supabase
                const insertResult = await supabaseInsertWithError('users', {
                    email: email.toLowerCase(),
                    password_hash: passwordHash,
                    full_name: fullName || null,
                    plan: 'trial',
                    subscription_status: 'trial',
                    trial_started_at: new Date().toISOString(),
                    trial_likes_used: 0,
                    trial_messages_used: 0
                });

                if (insertResult.error) {
                    return jsonResponse({ success: false, error: 'Supabase error: ' + insertResult.error }, 500, corsHeaders);
                }

                // Queue welcome email sequence (fire-and-forget, don't block signup)
                const userId = insertResult.data?.id || insertResult.data?.[0]?.id;
                if (userId) {
                    const firstName = (fullName || email).split(' ')[0];
                    fetchEmailTemplatesFromConfig().then(configTemplates => {
                        const activeTemplates = (configTemplates || HARDCODED_EMAIL_TEMPLATES).filter(t => t.enabled !== false);
                        const enrollNow = new Date();
                        const emailRows = activeTemplates.map(t => {
                            const schedDate = new Date(enrollNow);
                            schedDate.setDate(schedDate.getDate() + (t.delay_days || 0));
                            return { user_id: userId, user_email: email.toLowerCase(), user_name: firstName, email_index: t.email_index, scheduled_at: schedDate.toISOString(), status: 'pending' };
                        });
                        if (emailRows.length === 0) return;
                        return fetch(`${SUPABASE_URL}/rest/v1/email_queue`, {
                            method: 'POST',
                            headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify(emailRows)
                        });
                    }).catch(() => {});
                }

                return jsonResponse({
                    success: true,
                    message: 'Account created successfully! Please sign in.'
                }, 201, corsHeaders);
            }

            // ============================================
            // SUPABASE WEBHOOK: New user inserted → queue emails
            // ============================================
            if (url.pathname === '/webhook/new-user' && method === 'POST') {
                const payload = await request.json();
                const record = payload.record;
                if (!record || !record.id || !record.email) {
                    return jsonResponse({ success: false, error: 'Invalid payload' }, 400, corsHeaders);
                }
                const firstName = (record.full_name || record.email).split(' ')[0];
                const configTemplates = await fetchEmailTemplatesFromConfig().catch(() => null);
                const activeTemplates = (configTemplates || HARDCODED_EMAIL_TEMPLATES).filter(t => t.enabled !== false);
                const enrollNow = new Date();
                const emailRows = activeTemplates.map(t => {
                    const schedDate = new Date(enrollNow);
                    schedDate.setDate(schedDate.getDate() + (t.delay_days || 0));
                    return { user_id: record.id, user_email: record.email.toLowerCase(), user_name: firstName, email_index: t.email_index, scheduled_at: schedDate.toISOString(), status: 'pending' };
                });
                if (emailRows.length > 0) {
                    await fetch(`${SUPABASE_URL}/rest/v1/email_queue`, {
                        method: 'POST',
                        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify(emailRows)
                    });
                }
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 2. LOGIN ENDPOINT
            // ============================================
            if (url.pathname === '/auth/login' && method === 'POST') {
                const { email, password } = await request.json();

                if (!email || !password) {
                    return jsonResponse({ success: false, error: 'Email and password required' }, 400, corsHeaders);
                }

                // Find user
                const users = await supabaseQuery('users', 'email', email.toLowerCase());
                if (!users || users.length === 0) {
                    return jsonResponse({ success: false, error: 'Invalid email or password' }, 401, corsHeaders);
                }

                const user = users[0];

                // Verify password
                const isValid = await verifyPassword(password, user.password_hash);
                if (!isValid) {
                    return jsonResponse({ success: false, error: 'Invalid email or password' }, 401, corsHeaders);
                }

                // Generate JWT + Refresh Token
                const token = await createJWT({
                    id: user.id,
                    email: user.email,
                    plan: user.plan
                });
                const refreshToken = await createRefreshToken({
                    id: user.id,
                    email: user.email,
                    plan: user.plan
                });

                // Remove from per-user force_reauth list on successful login
                try {
                    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.force_reauth_users&select=value`, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
                    const cfgRows = await cfgRes.json();
                    const existing = cfgRows?.[0]?.value?.user_ids || [];
                    if (existing.includes(user.id)) {
                        const updated_ids = existing.filter(id => id !== user.id);
                        await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.force_reauth_users`, { method: 'PATCH', headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify({ value: { user_ids: updated_ids }, updated_at: new Date().toISOString() }) });
                    }
                } catch (_) {}

                return jsonResponse({
                    success: true,
                    token: token,
                    refreshToken: refreshToken,
                    user: {
                        id: user.id,
                        email: user.email,
                        fullName: user.full_name,
                        plan: user.plan,
                        subscriptionStatus: user.subscription_status || 'trial',
                        planExpiresAt: user.plan_expires_at
                    },
                    plan: user.plan
                }, 200, corsHeaders);
            }

            // ============================================
            // 3. TOKEN REFRESH ENDPOINT
            // ============================================
            if (url.pathname === '/auth/refresh' && method === 'POST') {
                const { refreshToken } = await request.json().catch(() => ({}));
                if (!refreshToken) {
                    return jsonResponse({ success: false, error: 'Refresh token required' }, 400, corsHeaders);
                }

                const payload = await verifyJWT(refreshToken);
                if (!payload || payload.type !== 'refresh') {
                    return jsonResponse({ success: false, error: 'Invalid or expired refresh token' }, 401, corsHeaders);
                }

                const users = await supabaseQuery('users', 'id', payload.id);
                if (!users || users.length === 0) {
                    return jsonResponse({ success: false, error: 'User not found' }, 401, corsHeaders);
                }

                const user = users[0];
                const newToken = await createJWT({ id: user.id, email: user.email, plan: user.plan });
                const newRefreshToken = await createRefreshToken({ id: user.id, email: user.email, plan: user.plan });

                return jsonResponse({
                    success: true,
                    token: newToken,
                    refreshToken: newRefreshToken,
                    plan: user.plan
                }, 200, corsHeaders);
            }

            // ============================================
            // 4. REAUTH ACK ENDPOINT (tracks global sign-out progress)
            // ============================================
            if (url.pathname === '/auth/reauth-ack' && method === 'POST') {
                try {
                    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.feature_flags&select=value`, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
                    const cfgRows = await cfgRes.json();
                    if (cfgRows?.[0]) {
                        const val = { ...cfgRows[0].value };
                        // Only count if flag is still active and within 24h window
                        if (val.force_reauth && val.force_reauth_enabled_at && (Date.now() - val.force_reauth_enabled_at <= 24 * 60 * 60 * 1000)) {
                            val.force_reauth_signed_out = (val.force_reauth_signed_out || 0) + 1;
                            await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.feature_flags`, { method: 'PATCH', headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify({ value: val, updated_at: new Date().toISOString() }) });
                        }
                    }
                } catch (_) {}
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            if (url.pathname === '/auth/forgot-password' && method === 'POST') {
                const { email } = await request.json();

                if (!email) {
                    return jsonResponse({ success: false, error: 'Email is required' }, 400, corsHeaders);
                }

                const users = await supabaseQuery('users', 'email', email.toLowerCase());

                // Always return success to avoid user enumeration
                if (!users || users.length === 0) {
                    return jsonResponse({ success: true }, 200, corsHeaders);
                }

                const user = users[0];

                // Generate a secure 32-byte hex token
                const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
                const resetToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
                const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

                const updateResp = await fetch(
                    `${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({ reset_token: resetToken, reset_token_expires_at: expiresAt })
                    }
                );

                if (!updateResp.ok) {
                    const errBody = await updateResp.text();
                    return jsonResponse({ success: false, error: `DB update failed: ${updateResp.status} ${errBody}` }, 500, corsHeaders);
                }

                const firstName = user.full_name ? user.full_name.split(' ')[0] : 'there';
                const resetLink = `https://flirteasy.io/ResetPassword?token=${resetToken}`;

                const emailHtml = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
  <div style="background:linear-gradient(135deg,#e91e8c,#9c27b0);padding:28px 32px;">
    <h1 style="color:white;margin:0;font-size:22px;font-weight:700;">FlirtEasy</h1>
  </div>
  <div style="padding:32px;">
    <h2 style="margin:0 0 8px;font-size:20px;color:#1a1a2e;">Hi ${firstName},</h2>
    <p style="color:#555;line-height:1.6;margin:16px 0;">If you requested a password reset, click the button below to complete the process. If you didn't make this request, you can safely ignore this email.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetLink}" style="background:linear-gradient(135deg,#e91e8c,#9c27b0);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">Set New Password</a>
    </div>
    <p style="color:#888;font-size:13px;line-height:1.5;">If the button doesn't work, copy and paste this URL into your browser:<br><a href="${resetLink}" style="color:#e91e8c;word-break:break-all;">${resetLink}</a></p>
    <p style="color:#888;font-size:13px;margin-top:24px;">This link expires in <strong>1 hour</strong>.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
    <p style="color:#aaa;font-size:12px;margin:0;">Stay safe,<br>The FlirtEasy Team</p>
  </div>
</div>
</body></html>`;

                await fetch(ZAPIER_EMAIL_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: user.email,
                        subject: "Let's reset your FlirtEasy password",
                        html: emailHtml,
                        name: user.full_name || '',
                        from_name: 'FlirtEasy',
                        from_email: 'flirteasyio@gmail.com',
                    })
                }).catch(() => {});

                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 3b. RESET PASSWORD ENDPOINT
            // ============================================
            if (url.pathname === '/auth/reset-password' && method === 'POST') {
                const { token, newPassword } = await request.json();

                if (!token || !newPassword) {
                    return jsonResponse({ success: false, error: 'Token and new password are required' }, 400, corsHeaders);
                }

                // Password strength validation
                const pwErrors = [];
                if (newPassword.length < 10) pwErrors.push('At least 10 characters');
                if (!/[0-9]/.test(newPassword)) pwErrors.push('At least 1 number');
                if (!/[^A-Za-z0-9]/.test(newPassword)) pwErrors.push('At least 1 special character');
                if (!/[a-z]/.test(newPassword)) pwErrors.push('At least 1 lowercase letter');
                if (!/[A-Z]/.test(newPassword)) pwErrors.push('At least 1 uppercase letter');
                if (/(.)\1\1/.test(newPassword)) pwErrors.push('No 3+ repeating characters');

                if (pwErrors.length > 0) {
                    return jsonResponse({ success: false, error: pwErrors.join(', ') }, 400, corsHeaders);
                }

                // Find user by reset token
                const tokenRows = await fetch(
                    `${SUPABASE_URL}/rest/v1/users?reset_token=eq.${encodeURIComponent(token)}&select=id,reset_token_expires_at`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                ).then(r => r.json()).catch(() => []);

                if (!tokenRows || tokenRows.length === 0) {
                    return jsonResponse({ success: false, error: 'Invalid or expired reset link' }, 400, corsHeaders);
                }

                const userRow = tokenRows[0];

                if (!userRow.reset_token_expires_at || new Date() > new Date(userRow.reset_token_expires_at)) {
                    return jsonResponse({ success: false, error: 'Reset link has expired. Please request a new one.' }, 400, corsHeaders);
                }

                const newHash = await hashPassword(newPassword);
                await supabaseUpdate('users', userRow.id, {
                    password_hash: newHash,
                    reset_token: null,
                    reset_token_expires_at: null
                });

                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 4. VERIFY TOKEN ENDPOINT
            // ============================================
            if (url.pathname === '/auth/verify' && method === 'GET') {
                const authHeader = request.headers.get('Authorization');
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const token = authHeader.split(' ')[1];
                const payload = await verifyJWT(token);

                if (payload) {
                    // Get fresh user data from DB
                    const users = await supabaseQuery('users', 'id', payload.id);
                    if (users && users.length > 0) {
                        const user = users[0];
                        return jsonResponse({
                            success: true,
                            user: {
                                id: user.id,
                                email: user.email,
                                fullName: user.full_name,
                                plan: user.plan
                            }
                        }, 200, corsHeaders);
                    }
                }

                return jsonResponse({ success: false, error: 'Invalid token' }, 401, corsHeaders);
            }

            // ============================================
            // 4. USER STATUS ENDPOINT
            // ============================================
            if (url.pathname === '/user/status' && method === 'GET') {
                const authHeader = request.headers.get('Authorization');
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const token = authHeader.split(' ')[1];
                const payload = await verifyJWT(token);

                if (!payload) {
                    return jsonResponse({ success: false, error: 'Invalid token' }, 401, corsHeaders);
                }

                const users = await supabaseQuery('users', 'id', payload.id);
                if (!users || users.length === 0) {
                    return jsonResponse({ success: false, error: 'User not found' }, 404, corsHeaders);
                }

                const user = users[0];

                let statusTrialDurationHours = 72;
                let userForceReauth = false;
                try {
                    const [trialCfg, reauthCfg] = await Promise.all([
                        fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.trial_settings&select=value`, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }).then(r => r.json()),
                        fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.force_reauth_users&select=value`, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }).then(r => r.json())
                    ]);
                    if (trialCfg?.[0]?.value?.trial_duration_hours) {
                        statusTrialDurationHours = trialCfg[0].value.trial_duration_hours;
                    }
                    const reauthIds = reauthCfg?.[0]?.value?.user_ids || [];
                    userForceReauth = reauthIds.includes(user.id);
                } catch (_) {}

                return jsonResponse({
                    success: true,
                    plan: user.plan,
                    subscriptionStatus: user.subscription_status || 'trial',
                    planExpiresAt: user.plan_expires_at,
                    trialStartedAt: user.trial_started_at,
                    trialLikesUsed: user.trial_likes_used,
                    trialMessagesUsed: user.trial_messages_used,
                    trialDurationHours: statusTrialDurationHours,
                    force_reauth: userForceReauth
                }, 200, corsHeaders);
            }

            // ============================================
            // 5. UPGRADE TO PRO ENDPOINT (for Stripe webhook)
            // ============================================
            if (url.pathname === '/user/upgrade' && method === 'POST') {
                const { userId, stripeCustomerId } = await request.json();

                if (!userId) {
                    return jsonResponse({ success: false, error: 'User ID required' }, 400, corsHeaders);
                }

                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 32); // 32 days for safety buffer

                const updated = await supabaseUpdate('users', userId, {
                    plan: 'pro',
                    subscription_status: 'active',
                    plan_expires_at: expiresAt.toISOString(),
                    stripe_customer_id: stripeCustomerId || null,
                    updated_at: new Date().toISOString()
                });

                if (updated) {
                    return jsonResponse({ success: true, message: 'Upgraded to PRO!' }, 200, corsHeaders);
                }

                return jsonResponse({ success: false, error: 'Failed to upgrade' }, 500, corsHeaders);
            }

            // ============================================
            // 6. AI CHAT COMPLETION ENDPOINT (NEW!)
            // ============================================
            if (url.pathname === '/api/ai/chat' && method === 'POST') {
                // 1. Verify authentication
                const authHeader = request.headers.get('Authorization');
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const token = authHeader.split(' ')[1];
                const payload = await verifyJWT(token);

                if (!payload) {
                    return jsonResponse({ success: false, error: 'Invalid token' }, 401, corsHeaders);
                }

                // 2. Get fresh user data, rate limits, and AI config in parallel
                const [users, rateLimitRows, aiConfigRows, trialSettingRows] = await Promise.all([
                    supabaseQuery('users', 'id', payload.id),
                    fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.rate_limits&select=value`, {
                        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                    }).then(r => r.json()).catch(() => []),
                    fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.ai_settings&select=value`, {
                        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                    }).then(r => r.json()).catch(() => []),
                    fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.trial_settings&select=value`, {
                        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                    }).then(r => r.json()).catch(() => [])
                ]);

                if (!users || users.length === 0) {
                    return jsonResponse({ success: false, error: 'User not found' }, 404, corsHeaders);
                }

                const user = users[0];
                const rateLimitConfig = (rateLimitRows && rateLimitRows[0]) ? rateLimitRows[0].value : null;
                const trialMsgLimit = rateLimitConfig?.trial?.lifetime_messages ?? TRIAL_LIMITS.messages;
                const aiSettings = (aiConfigRows && aiConfigRows[0]) ? aiConfigRows[0].value : null;
                const activeModel = aiSettings?.model || 'gpt-4o';
                const activeApiKey = aiSettings?.api_key || OPENAI_API_KEY;
                const trialSettings = (trialSettingRows && trialSettingRows[0]) ? trialSettingRows[0].value : null;
                const trialDurationHours = trialSettings?.trial_duration_hours ?? 72;
                const trialEnabled = trialSettings?.trial_enabled !== false;

                // 3. Check subscription status
                const isPro = user.plan === 'pro';
                const isTrial = user.plan === 'trial';

                // 3.1 Strict Pro Expiration Check
                if (isPro) {
                    const now = new Date();
                    const expiry = user.plan_expires_at ? new Date(user.plan_expires_at) : null;

                    if (expiry && now > expiry) {
                        return jsonResponse({
                            success: false,
                            error: 'Subscription expired. Please renew your plan.',
                            code: 'SUBSCRIPTION_EXPIRED'
                        }, 403, corsHeaders);
                    }
                }

                // Check if trial is still valid (duration from remote config, default 72h)
                if (isTrial && !trialEnabled) {
                    return jsonResponse({
                        success: false,
                        error: 'Trial access is currently disabled. Please upgrade to Pro.',
                        code: 'TRIAL_DISABLED'
                    }, 403, corsHeaders);
                }

                // 4. Parse the request body (must be before trial checks so visual_analysis flag can bypass message limits)
                const requestBody = await request.json();
                const isVisualAnalysis = requestBody.visual_analysis === true;

                if (isTrial && user.trial_started_at) {
                    const trialStart = new Date(user.trial_started_at);
                    const now = new Date();
                    const hoursSinceStart = (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60);

                    if (hoursSinceStart > trialDurationHours) {
                        return jsonResponse({
                            success: false,
                            error: 'Trial expired',
                            code: 'TRIAL_EXPIRED'
                        }, 403, corsHeaders);
                    }

                    // Check trial message limits — visual analysis calls are exempt
                    if (!isVisualAnalysis && (user.trial_messages_used || 0) >= trialMsgLimit) {
                        return jsonResponse({
                            success: false,
                            error: 'Trial message limit reached',
                            code: 'TRIAL_LIMIT_REACHED'
                        }, 403, corsHeaders);
                    }
                }

                // If not pro and not valid trial, deny access
                if (!isPro && !isTrial) {
                    return jsonResponse({
                        success: false,
                        error: 'Subscription required',
                        code: 'SUBSCRIPTION_REQUIRED'
                    }, 403, corsHeaders);
                }

                // Ensure we're using our controlled model (remote config takes priority)
                const aiRequest = {
                    model: activeModel,
                    messages: requestBody.messages,
                    max_tokens: requestBody.max_tokens || 500,
                    temperature: requestBody.temperature || 0.8
                };

                // 5. Make the OpenAI API call
                const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${activeApiKey}`
                    },
                    body: JSON.stringify(aiRequest)
                });

                const openaiResult = await openaiResponse.json();

                // 6. Check for OpenAI errors
                if (!openaiResponse.ok) {
                    console.error('OpenAI Error:', openaiResult);
                    return jsonResponse({
                        success: false,
                        error: openaiResult.error?.message || 'AI service error'
                    }, 500, corsHeaders);
                }

                if (openaiResult?.usage) {
                    ctx.waitUntil(updateTokenStats('openai', openaiResult.usage.prompt_tokens, openaiResult.usage.completion_tokens, activeModel));
                }

                // 7. Increment trial message count if applicable (visual analysis calls are exempt)
                if (isTrial && !isVisualAnalysis) {
                    await supabaseUpdate('users', user.id, {
                        trial_messages_used: (user.trial_messages_used || 0) + 1
                    });
                }

                // 8. Return the AI response
                return jsonResponse({
                    success: true,
                    ...openaiResult
                }, 200, corsHeaders);
            }

            // ============================================
            // 7. AI REWRITE ENDPOINT (Claude Haiku humanizer pass)
            // ============================================
            if (url.pathname === '/api/ai/rewrite' && method === 'POST') {
                const authHeader = request.headers.get('Authorization');
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const token = authHeader.split(' ')[1];
                const payload = await verifyJWT(token);
                if (!payload) {
                    return jsonResponse({ success: false, error: 'Invalid token' }, 401, corsHeaders);
                }

                const body = await request.json();
                const { message, style, language, matchGender, senderGender } = body;

                if (!message || typeof message !== 'string' || message.trim().length === 0) {
                    return jsonResponse({ success: false, error: 'message is required' }, 400, corsHeaders);
                }

                // Load dynamic config from Supabase (with hardcoded fallback)
                let claudeConfig = {
                    enabled: true,
                    model: 'claude-opus-4-5',
                    timeout_ms: 5000,
                    prompt_template: null,
                    temperature: 0.3,
                    max_tokens: 200,
                };
                let activeAnthropicKey = ANTHROPIC_API_KEY;
                try {
                    const [cfgRes, humRes] = await Promise.all([
                        fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.claude_rewrite_config&select=value`,
                            { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }),
                        fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.humanizer_config&select=value`,
                            { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }),
                    ]);
                    const cfgRows = await cfgRes.json();
                    if (cfgRes.ok && cfgRows && cfgRows.length > 0) {
                        claudeConfig = { ...claudeConfig, ...cfgRows[0].value };
                    }
                    const humRows = await humRes.json();
                    if (humRes.ok && humRows && humRows.length > 0 && humRows[0].value?.api_key) {
                        activeAnthropicKey = humRows[0].value.api_key;
                    }
                } catch (_) {}

                if (!claudeConfig.enabled) {
                    return jsonResponse({ success: true, message: message.trim() }, 200, corsHeaders);
                }

                const styleLabel = style || 'casual';
                const languageLabel = language || 'the same language as the original message';

                const genderLine = (() => {
                    if (!matchGender) return '';
                    const mg = matchGender.toLowerCase();
                    const matchIsFemale = mg === 'female' || mg === 'woman' || mg === 'f';
                    const matchIsMale   = mg === 'male'   || mg === 'man'   || mg === 'm';
                    const matchLabel = matchIsFemale ? 'female (woman)' : matchIsMale ? 'male (man)' : matchGender;
                    const sg = senderGender ? senderGender.toLowerCase() : null;
                    const senderIsFemale = sg === 'female' || sg === 'woman' || sg === 'f';
                    const senderIsMale   = sg === 'male'   || sg === 'man'   || sg === 'm';
                    const senderLabel = senderIsFemale ? 'female' : senderIsMale ? 'male' : null;
                    const senderPart = senderLabel ? ` The sender is ${senderLabel}.` : '';
                    return `\nMatch gender: ${matchLabel}.${senderPart} CRITICAL: use grammatically correct gendered forms throughout — verb conjugations, pronouns, adjectives must all match the match's gender. Do NOT default to masculine forms when addressing or referring to a female match.`;
                })();



                const templateSrc = (claudeConfig.prompt_template && claudeConfig.prompt_template.trim().length > 0)
                    ? claudeConfig.prompt_template
                    : DEFAULT_PROMPT_TEMPLATE;

                let rewritePrompt = templateSrc
                    .replace(/\{\{style\}\}/g, styleLabel)
                    .replace(/\{\{language\}\}/g, languageLabel)
                    .replace(/\{\{genderLine\}\}/g, genderLine)
                    .replace(/\{\{message\}\}/g, message.trim());

                // If genderLine has content but {{genderLine}} was NOT in the template
                // (e.g. admin saved a custom template before this variable existed),
                // inject it automatically so gender context is never silently dropped.
                if (genderLine && !templateSrc.includes('{{genderLine}}')) {
                    const insertMarker = 'Original message:';
                    const markerIdx = rewritePrompt.indexOf(insertMarker);
                    if (markerIdx !== -1) {
                        rewritePrompt = rewritePrompt.slice(0, markerIdx) + genderLine.trimStart() + '\n' + rewritePrompt.slice(markerIdx);
                    } else {
                        rewritePrompt = rewritePrompt + '\n' + genderLine.trimStart();
                    }
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), claudeConfig.timeout_ms || 5000);

                try {
                    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: {
                            'x-api-key': activeAnthropicKey,
                            'anthropic-version': '2023-06-01',
                            'content-type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: claudeConfig.model || 'claude-opus-4-5',
                            max_tokens: claudeConfig.max_tokens || 200,
                            temperature: claudeConfig.temperature ?? 0.3,
                            messages: [{ role: 'user', content: rewritePrompt }],
                        }),
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);

                    if (!claudeRes.ok) {
                        return jsonResponse({ success: true, message: message.trim() }, 200, corsHeaders);
                    }

                    const claudeData = await claudeRes.json();

                    if (claudeData?.usage) {
                        ctx.waitUntil(updateTokenStats('claude', claudeData.usage.input_tokens, claudeData.usage.output_tokens, claudeConfig.model || 'claude-opus-4-5'));
                    }

                    const rewritten = claudeData?.content?.[0]?.text?.trim();

                    if (!rewritten || rewritten.length === 0) {
                        console.warn('[Claude Rewrite] Empty response — returning original');
                        return jsonResponse({ success: true, message: message.trim() }, 200, corsHeaders);
                    }

                    // Guardrail 1: structural — if Claude changed >40% of characters, reject
                    const original = message.trim();
                    const maxAllowedDistance = Math.ceil(original.length * (claudeConfig.max_diff_ratio ?? 0.4));
                    const editDistance = levenshtein(original, rewritten);
                    const structuralOverEdit = editDistance > maxAllowedDistance;

                    // Guardrail 2: semantic — if >1 content word (len≥4) from original is absent in rewrite, reject
                    const maxMissingWords = claudeConfig.max_missing_words ?? 1;
                    const missingWords = contentWordsMissing(original, rewritten);
                    const semanticOverEdit = missingWords > maxMissingWords;

                    const overEdited = structuralOverEdit || semanticOverEdit;
                    const finalMessage = overEdited ? original : rewritten;
                    const changed = finalMessage !== original;

                    const modelUsed = claudeConfig.model || 'claude-opus-4-5';
                    console.log(`[Claude Rewrite] model=${modelUsed} lang=${languageLabel} style=${styleLabel} changed=${changed} editDist=${editDistance}/${maxAllowedDistance} missingWords=${missingWords}/${maxMissingWords} overEdited=${overEdited}(struct=${structuralOverEdit},sem=${semanticOverEdit})`);
                    if (changed) {
                        console.log(`[Claude Rewrite] BEFORE: ${original}`);
                        console.log(`[Claude Rewrite] AFTER:  ${finalMessage}`);
                    }

                    return jsonResponse({ success: true, message: finalMessage }, 200, corsHeaders);
                } catch (err) {
                    clearTimeout(timeoutId);
                    console.error('[Claude Rewrite] Error:', err.message || err);
                    return jsonResponse({ success: true, message: message.trim() }, 200, corsHeaders);
                }
            }

            // ============================================
            // 8. INCREMENT USAGE ENDPOINT (for swipes/likes)
            // ============================================
            if (url.pathname === '/api/usage/increment' && method === 'POST') {
                const authHeader = request.headers.get('Authorization');
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const token = authHeader.split(' ')[1];
                const payload = await verifyJWT(token);

                if (!payload) {
                    return jsonResponse({ success: false, error: 'Invalid token' }, 401, corsHeaders);
                }

                const { type, count } = await request.json();

                if (!type || !['likes', 'messages'].includes(type)) {
                    return jsonResponse({ success: false, error: 'Invalid usage type' }, 400, corsHeaders);
                }

                const users = await supabaseQuery('users', 'id', payload.id);
                if (!users || users.length === 0) {
                    return jsonResponse({ success: false, error: 'User not found' }, 404, corsHeaders);
                }

                const user = users[0];
                const fieldName = type === 'likes' ? 'trial_likes_used' : 'trial_messages_used';
                const currentCount = user[fieldName] || 0;
                const incrementBy = count || 1;

                await supabaseUpdate('users', user.id, {
                    [fieldName]: currentCount + incrementBy
                });

                return jsonResponse({
                    success: true,
                    [fieldName]: currentCount + incrementBy
                }, 200, corsHeaders);
            }

            // ============================================
            // 8. STRIPE WEBHOOK ENDPOINT
            // ============================================
            if (url.pathname === '/webhook/stripe' && method === 'POST') {
                const body = await request.text();
                const sig = request.headers.get('stripe-signature');

                if (!sig) {
                    return jsonResponse({ success: false, error: 'Missing signature' }, 400, corsHeaders);
                }

                // PRODUCTION SECURITY: Verify that the request actually came from Stripe
                const isValid = await verifyStripeSignature(body, sig, STRIPE_WEBHOOK_SECRET);

                if (!isValid) {
                    console.error('[Stripe] Invalid signature detected!');
                    return jsonResponse({ success: false, error: 'Invalid signature' }, 400, corsHeaders);
                }

                let event;
                try {
                    event = JSON.parse(body);
                } catch (err) {
                    return jsonResponse({ success: false, error: 'JSON Parse Error' }, 400, corsHeaders);
                }

                if (event.type === 'checkout.session.completed') {
                    const session = event.data.object;
                    const customerEmail = session.customer_details?.email?.toLowerCase();
                    const stripeCustomerId = session.customer;

                    // SMARTER LOGIC: Only upgrade if this specific product metadata matches
                    const isCorrectProduct = session.metadata?.product_type === 'flirteasy_pro' ||
                        session.client_reference_id === 'flirteasy_pro'; // Fallback check

                    if (!isCorrectProduct) {
                        console.log('[Stripe] Payment received for a different product. Ignoring upgrade.');
                        return jsonResponse({ received: true, ignored: true }, 200, corsHeaders);
                    }

                    if (customerEmail) {
                        // Find user by email
                        const users = await supabaseQuery('users', 'email', customerEmail);

                        if (users && users.length > 0) {
                            const user = users[0];
                            const expiresAt = new Date();
                            expiresAt.setDate(expiresAt.getDate() + 31); // Add 31 days

                            // Upgrade user to PRO
                            await supabaseUpdate('users', user.id, {
                                plan: 'pro',
                                subscription_status: 'active',
                                plan_expires_at: expiresAt.toISOString(),
                                stripe_customer_id: stripeCustomerId,
                                updated_at: new Date().toISOString()
                            });
                            console.log(`[Stripe] Upgraded user ${customerEmail} to PRO (Expires: ${expiresAt.toISOString()})`);
                        }
                    }
                }
                else if (event.type === 'customer.subscription.deleted') {
                    const subscription = event.data.object;
                    const stripeCustomerId = subscription.customer;

                    // User's subscription ended or was revoked
                    const users = await supabaseQuery('users', 'stripe_customer_id', stripeCustomerId);
                    if (users && users.length > 0) {
                        const user = users[0];
                        await supabaseUpdate('users', user.id, {
                            plan: 'trial',
                            subscription_status: 'expired',
                            plan_expires_at: new Date().toISOString() // Expire immediately
                        });
                        console.log(`[Stripe] Downgraded user ${user.email} (Subscription Deleted)`);
                    }
                }

                return jsonResponse({ received: true }, 200, corsHeaders);
            }

            // ============================================
            // 9. ADMIN — VERIFY (email + secret + is_admin check)
            // ============================================
            if (url.pathname === '/admin/verify' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Invalid admin secret' }, 401, corsHeaders);
                }
                const body = await request.json().catch(() => ({}));
                const email = (body.email || '').trim().toLowerCase();
                if (!email) {
                    return jsonResponse({ success: false, error: 'Email is required' }, 400, corsHeaders);
                }
                const userRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=is_admin`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const users = await userRes.json();
                if (!userRes.ok || !users || users.length === 0) {
                    return jsonResponse({ success: false, error: 'Account not found' }, 401, corsHeaders);
                }
                if (!users[0].is_admin) {
                    return jsonResponse({ success: false, error: 'Access denied — not an admin account' }, 403, corsHeaders);
                }
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'admin_login',
                    targetType: 'session',
                    targetId: null,
                    targetLabel: email,
                    details: {},
                    adminEmail: email,
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 10. ADMIN — GET PROMPTS
            // ============================================
            if (url.pathname === '/admin/prompts' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const key = url.searchParams.get('key') || 'prompt_modes';
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.${encodeURIComponent(key)}&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const rows = await res.json();
                if (!res.ok || !rows || rows.length === 0) {
                    return jsonResponse({ success: false, error: 'Config key not found' }, 404, corsHeaders);
                }
                return jsonResponse({ success: true, prompts: rows[0].value }, 200, corsHeaders);
            }

            // ============================================
            // 10. ADMIN — SAVE PROMPTS
            // ============================================
            if (url.pathname === '/admin/prompts' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const body = await request.json();
                const key = body.key || 'prompt_modes';
                const prompts = body.prompts;

                if (!prompts) {
                    return jsonResponse({ success: false, error: 'Missing prompts in body' }, 400, corsHeaders);
                }

                // Fetch existing value to diff — only log what actually changed
                let oldValue = {};
                try {
                    const oldRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/config?key=eq.${encodeURIComponent(key)}&select=value`,
                        { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                    );
                    const oldRows = await oldRes.json();
                    if (oldRes.ok && oldRows && oldRows.length > 0) oldValue = oldRows[0].value || {};
                } catch (_) {}

                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'resolution=merge-duplicates'
                        },
                        body: JSON.stringify({ key, value: prompts, updated_at: new Date().toISOString() })
                    }
                );

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Supabase update failed' }, 500, corsHeaders);
                }

                // Build diff — only keys whose value actually changed
                const changedKeys = Object.keys(prompts).filter(k => {
                    const oldStr = typeof oldValue[k] === 'string' ? oldValue[k] : JSON.stringify(oldValue[k] ?? '');
                    const newStr = typeof prompts[k] === 'string' ? prompts[k] : JSON.stringify(prompts[k] ?? '');
                    return oldStr !== newStr;
                });
                const changedValues = {};
                changedKeys.forEach(k => { changedValues[k] = { old: oldValue[k] ?? null, new: prompts[k] }; });

                const adminEmailForLog = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'update_prompts', targetType: 'config', targetId: key,
                    targetLabel: key === 'language_slang_guide' ? 'Language Voices' : key === 'prompt_modes' ? 'Prompt Modes' : key,
                    details: { key, changed_count: changedKeys.length, changed_keys: changedKeys, changes: changedValues },
                    adminEmail: adminEmailForLog
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — GET CLAUDE REWRITE DEFAULT PROMPT
            // ============================================
            if (url.pathname === '/admin/claude-rewrite/default-prompt' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                return jsonResponse({ success: true, defaultPrompt: DEFAULT_PROMPT_TEMPLATE }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — GET CLAUDE REWRITE CONFIG
            // ============================================
            if (url.pathname === '/admin/claude-rewrite' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.claude_rewrite_config&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const rows = await res.json();
                const saved = (res.ok && rows && rows.length > 0) ? rows[0].value : null;
                return jsonResponse({ success: true, config: saved }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — SAVE CLAUDE REWRITE CONFIG
            // ============================================
            if (url.pathname === '/admin/claude-rewrite' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json();
                const { config: claudeConfigBody } = body;
                if (!claudeConfigBody || typeof claudeConfigBody !== 'object') {
                    return jsonResponse({ success: false, error: 'config object required' }, 400, corsHeaders);
                }
                const ALLOWED_CLAUDE_KEYS = ['enabled', 'model', 'timeout_ms', 'prompt_template', 'temperature', 'max_tokens'];
                const sanitized = {};
                for (const k of ALLOWED_CLAUDE_KEYS) {
                    if (k in claudeConfigBody) sanitized[k] = claudeConfigBody[k];
                }
                const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/config`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates',
                    },
                    body: JSON.stringify({ key: 'claude_rewrite_config', value: sanitized, updated_at: new Date().toISOString() }),
                });
                if (!saveRes.ok) {
                    const err = await saveRes.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Save failed' }, 500, corsHeaders);
                }
                const adminEmailClaudeLog = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'update_claude_rewrite_config', targetType: 'config', targetId: 'claude_rewrite_config',
                    targetLabel: 'Claude Rewrite Config',
                    details: { enabled: sanitized.enabled, model: sanitized.model, timeout_ms: sanitized.timeout_ms },
                    adminEmail: adminEmailClaudeLog,
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — STYLE TRAINING SIMULATION
            // ============================================
            if (url.pathname === '/admin/style-training/simulate' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const simBody = await request.json();
                const {
                    conversation = [],
                    personaName = 'Mia',
                    language = 'en',
                    isFinal = false,
                    lastWasGarbage = false,
                    systemPromptOverride = null,
                    finalPromptOverride = null,
                    temperature = null,
                    maxTokens = null,
                    personaEmojiEnabled = true,
                } = simBody;

                const emojiInstruction = personaEmojiEnabled ? '' : '\nDo NOT use any emojis in your reply.';

                // Fetch AI settings from Supabase (model + key)
                let simModel = 'gpt-4o-mini';
                let simApiKey = OPENAI_API_KEY;
                try {
                    const aiCfgRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/config?key=eq.ai_settings&select=value`,
                        { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                    );
                    const aiCfgRows = await aiCfgRes.json();
                    if (aiCfgRes.ok && aiCfgRows?.[0]?.value?.model) simModel = aiCfgRows[0].value.model;
                    if (aiCfgRes.ok && aiCfgRows?.[0]?.value?.api_key) simApiKey = aiCfgRows[0].value.api_key;
                } catch (_) {}

                const LANG_MAP = {
                    en:'English', es:'Spanish', fr:'French', de:'German', it:'Italian',
                    pt:'Portuguese', ru:'Russian', zh:'Chinese', ja:'Japanese', ko:'Korean',
                    ar:'Arabic', hi:'Hindi', nl:'Dutch', pl:'Polish', tr:'Turkish',
                    sv:'Swedish', da:'Danish', fi:'Finnish', nb:'Norwegian', cs:'Czech',
                    ro:'Romanian', hu:'Hungarian', el:'Greek', he:'Hebrew',
                    uk:'Ukrainian', id:'Indonesian', vi:'Vietnamese', th:'Thai',
                    fa:'Persian', ur:'Urdu', sw:'Swahili', bn:'Bengali',
                };
                const ROMANIZED_LANGS = {
                    hi: 'Hinglish (Hindi in Latin script — e.g. "kese ho", "bahut badhiya")',
                    ur: 'Urdu in Latin script — e.g. "kya haal hai", "bohat acha"',
                    bn: 'Bengali in Latin script — e.g. "ki korcho", "bhalo acho"',
                };
                const langInstruction = ROMANIZED_LANGS[language]
                    ? `\nIMPORTANT: Write ALL messages in ${ROMANIZED_LANGS[language]}. Latin letters only.`
                    : (language && language !== 'en' && LANG_MAP[language])
                        ? `\nIMPORTANT: Write ALL messages in ${LANG_MAP[language]}. Every word must be in ${LANG_MAP[language]}.`
                        : '';

                const garbageInstruction = lastWasGarbage
                    ? `\nIMPORTANT: The user just sent gibberish. React naturally — tease lightly or call it out, then ask a real question. Do NOT play along.`
                    : '';

                const defaultSystemPrompt = `You are ${personaName}, an attractive person on a dating app (Tinder/Bumble) having a real conversation with someone you're interested in.\nYour goal is to keep the conversation fun, flirty, and naturally build attraction — like a real date would.\nGuidelines:\n- React to what they said, then pivot toward getting to know them better romantically or personally\n- Mix light flirting with genuine curiosity about them as a person\n- Occasionally tease playfully or drop a subtle compliment\n- Keep replies SHORT (1-2 sentences). Casual texting style, no formal punctuation\n- Ask questions that move toward meeting up, learning their vibe, or finding chemistry\n- Topics: lifestyle, personality, humor, adventures, attraction — NOT just logistics or food facts\nNEVER mention you are an AI or a simulation. Sound like a real attractive person who's interested.`;
                const defaultFinalPrompt = `You are ${personaName}, an attractive person on a dating app wrapping up a great conversation.\nReact warmly and genuinely to their last message. Keep it short (1 sentence), casual, and real. No questions. No formal goodbyes. Just a natural, warm closing moment.`;

                let simSystemPrompt;
                if (isFinal) {
                    const tpl = (finalPromptOverride && finalPromptOverride.trim()) ? finalPromptOverride : defaultFinalPrompt;
                    simSystemPrompt = tpl.replace(/\{personaName\}/g, personaName) + langInstruction + emojiInstruction;
                } else {
                    const tpl = (systemPromptOverride && systemPromptOverride.trim()) ? systemPromptOverride : defaultSystemPrompt;
                    simSystemPrompt = tpl.replace(/\{personaName\}/g, personaName) + garbageInstruction + langInstruction + emojiInstruction;
                }

                const historyLines = (conversation || [])
                    .slice(-8)
                    .map(m => `${m.role === 'user' ? 'User' : personaName}: ${m.text}`)
                    .join('\n');
                const userPrompt = `Here is the conversation so far:\n${historyLines}\n\nWrite ${personaName}'s next reply. Output ONLY the message text, no name prefix, no quotes:`;

                try {
                    const oRes = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${simApiKey}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            model: simModel,
                            temperature: (typeof temperature === 'number') ? temperature : 0.85,
                            max_tokens: (typeof maxTokens === 'number') ? maxTokens : 80,
                            messages: [
                                { role: 'system', content: simSystemPrompt },
                                { role: 'user',   content: userPrompt },
                            ],
                        }),
                    });
                    if (!oRes.ok) {
                        const oErr = await oRes.json().catch(() => ({}));
                        return jsonResponse({ success: false, error: oErr?.error?.message || `OpenAI HTTP ${oRes.status}` }, 200, corsHeaders);
                    }
                    const oData = await oRes.json();
                    let reply = oData?.choices?.[0]?.message?.content?.trim() || '';
                    reply = reply.replace(/^["'\u2018\u2019\u201c\u201d]+|["'\u2018\u2019\u201c\u201d]+$/g, '').trim();
                    reply = reply.replace(new RegExp(`^${personaName}\\s*:\\s*`, 'i'), '').trim();
                    return jsonResponse({ success: true, reply, model: simModel }, 200, corsHeaders);
                } catch (simErr) {
                    return jsonResponse({ success: false, error: simErr.message || 'OpenAI call failed' }, 200, corsHeaders);
                }
            }

            // ============================================
            // ADMIN — TEST CLAUDE REWRITE
            // ============================================
            if (url.pathname === '/admin/claude-rewrite/test' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const testBody = await request.json();
                const { message: testMsg, style: testStyle, language: testLang, prompt_template: promptOverride } = testBody;
                if (!testMsg || typeof testMsg !== 'string' || !testMsg.trim()) {
                    return jsonResponse({ success: false, error: 'message is required' }, 400, corsHeaders);
                }
                let testCfg = {
                    model: 'claude-opus-4-5',
                    temperature: 0.3,
                    max_tokens: 200,
                    max_diff_ratio: 0.4,
                    max_missing_words: 1,
                    prompt_template: null,
                };
                let testAnthropicKey = ANTHROPIC_API_KEY;
                try {
                    const [cfgR, humR] = await Promise.all([
                        fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.claude_rewrite_config&select=value`,
                            { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }),
                        fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.humanizer_config&select=value`,
                            { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }),
                    ]);
                    const cfgR2 = await cfgR.json();
                    if (cfgR.ok && cfgR2 && cfgR2.length > 0) testCfg = { ...testCfg, ...cfgR2[0].value };
                    const humR2 = await humR.json();
                    if (humR.ok && humR2 && humR2.length > 0 && humR2[0].value?.api_key) testAnthropicKey = humR2[0].value.api_key;
                } catch (_) {}
                const tplSrc = (promptOverride && promptOverride.trim())
                    ? promptOverride
                    : (testCfg.prompt_template && testCfg.prompt_template.trim())
                        ? testCfg.prompt_template
                        : DEFAULT_PROMPT_TEMPLATE;
                const styleLabel = testStyle || 'casual';
                const langLabel = testLang || 'the same language as the original message';
                const testPrompt = tplSrc
                    .replace(/\{\{style\}\}/g, styleLabel)
                    .replace(/\{\{language\}\}/g, langLabel)
                    .replace(/\{\{genderLine\}\}/g, '')
                    .replace(/\{\{message\}\}/g, testMsg.trim());
                try {
                    const tRes = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: { 'x-api-key': testAnthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
                        body: JSON.stringify({
                            model: testCfg.model,
                            max_tokens: testCfg.max_tokens || 200,
                            temperature: testCfg.temperature ?? 0.3,
                            messages: [{ role: 'user', content: testPrompt }],
                        }),
                    });
                    if (!tRes.ok) {
                        const tErr = await tRes.json().catch(() => ({}));
                        return jsonResponse({ success: false, error: tErr?.error?.message || `Claude returned HTTP ${tRes.status}` }, 200, corsHeaders);
                    }
                    const tData = await tRes.json();
                    const rewritten = tData?.content?.[0]?.text?.trim();
                    if (!rewritten) {
                        return jsonResponse({ success: false, error: 'Claude returned empty response' }, 200, corsHeaders);
                    }
                    const original = testMsg.trim();
                    const maxDist = Math.ceil(original.length * (testCfg.max_diff_ratio ?? 0.4));
                    const editDist = levenshtein(original, rewritten);
                    const structOverEdit = editDist > maxDist;
                    const maxMissing = testCfg.max_missing_words ?? 1;
                    const missingW = contentWordsMissing(original, rewritten);
                    const semOverEdit = missingW > maxMissing;
                    const overEdited = structOverEdit || semOverEdit;
                    return jsonResponse({
                        success: true,
                        original,
                        rewritten,
                        final: overEdited ? original : rewritten,
                        changed: !overEdited && rewritten !== original,
                        overEdited,
                        structuralOverEdit: structOverEdit,
                        semanticOverEdit: semOverEdit,
                        editDistance: editDist,
                        maxAllowedDistance: maxDist,
                        missingWords: missingW,
                        maxMissingWords: maxMissing,
                        model: testCfg.model,
                        usage: tData.usage,
                    }, 200, corsHeaders);
                } catch (err) {
                    return jsonResponse({ success: false, error: err.message }, 200, corsHeaders);
                }
            }

            // ============================================
            // ADMIN — GET HUMANIZER CONFIG (Anthropic key)
            // ============================================
            if (url.pathname === '/admin/humanizer-config' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.humanizer_config&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const rows = await res.json();
                const saved = (res.ok && rows && rows.length > 0) ? rows[0].value : null;
                const rawKey = saved?.api_key || null;
                const maskedKey = rawKey
                    ? rawKey.slice(0, 10) + '•'.repeat(Math.max(0, rawKey.length - 14)) + rawKey.slice(-4)
                    : null;
                return jsonResponse({
                    success: true,
                    config: { api_key_masked: maskedKey, api_key_set: !!rawKey },
                }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — SAVE HUMANIZER CONFIG (Anthropic key)
            // ============================================
            if (url.pathname === '/admin/humanizer-config' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json();
                const { api_key } = body;
                if (!api_key || typeof api_key !== 'string' || !api_key.startsWith('sk-ant-')) {
                    return jsonResponse({ success: false, error: 'api_key must start with sk-ant-' }, 400, corsHeaders);
                }
                const existingRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.humanizer_config&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const existingRows = await existingRes.json();
                const existing = (existingRes.ok && existingRows && existingRows.length > 0) ? existingRows[0].value : {};
                const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/config`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates',
                    },
                    body: JSON.stringify({ key: 'humanizer_config', value: { ...existing, api_key }, updated_at: new Date().toISOString() }),
                });
                if (!saveRes.ok) {
                    const err = await saveRes.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Save failed' }, 500, corsHeaders);
                }
                const adminEmailHum = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'update_humanizer_config', targetType: 'config', targetId: 'humanizer_config',
                    targetLabel: 'Humanizer Config', details: { api_key_updated: true }, adminEmail: adminEmailHum,
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — VALIDATE ANTHROPIC API KEY
            // ============================================
            if (url.pathname === '/admin/humanizer-config/validate' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const valBody = await request.json();
                const { api_key: valKey } = valBody;
                if (!valKey || typeof valKey !== 'string' || !valKey.startsWith('sk-ant-')) {
                    return jsonResponse({ success: true, valid: false, error: 'Key must start with sk-ant-' }, 200, corsHeaders);
                }
                try {
                    const valRes = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: { 'x-api-key': valKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
                        body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 5, messages: [{ role: 'user', content: 'Hi' }] }),
                    });
                    const valData = await valRes.json();
                    if (valRes.ok) {
                        return jsonResponse({ success: true, valid: true, model: valData.model }, 200, corsHeaders);
                    }
                    return jsonResponse({ success: true, valid: false, error: valData?.error?.message || `HTTP ${valRes.status}` }, 200, corsHeaders);
                } catch (err) {
                    return jsonResponse({ success: true, valid: false, error: err.message }, 200, corsHeaders);
                }
            }

            // ============================================
            // ADMIN — GET TOKEN STATS
            // ============================================
            if (url.pathname === '/admin/token-stats' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.humanizer_token_stats&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const rows = await res.json();
                const stats = (res.ok && rows && rows.length > 0) ? rows[0].value : null;
                return jsonResponse({ success: true, stats }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — RESET TOKEN STATS
            // ============================================
            if (url.pathname === '/admin/token-stats/reset' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const resetValue = {
                    claude: { input_tokens: 0, output_tokens: 0, requests: 0 },
                    openai: { input_tokens: 0, output_tokens: 0, requests: 0 },
                    last_reset_at: new Date().toISOString(),
                };
                await fetch(`${SUPABASE_URL}/rest/v1/config`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates',
                    },
                    body: JSON.stringify({ key: 'humanizer_token_stats', value: resetValue, updated_at: new Date().toISOString() }),
                });
                const adminEmailReset = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'reset_token_stats', targetType: 'config', targetId: 'humanizer_token_stats',
                    targetLabel: 'Token Stats', details: {}, adminEmail: adminEmailReset,
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — GET OPENAI BALANCE
            // ============================================
            if (url.pathname === '/admin/balance/openai' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const aiCfgRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.ai_settings&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const aiCfgRows = await aiCfgRes.json();
                const openAiKey = (aiCfgRes.ok && aiCfgRows && aiCfgRows.length > 0 && aiCfgRows[0].value?.api_key)
                    ? aiCfgRows[0].value.api_key
                    : OPENAI_API_KEY;
                try {
                    const balRes = await fetch('https://api.openai.com/v1/organization/balance', {
                        headers: { 'Authorization': `Bearer ${openAiKey}` },
                    });
                    const balData = await balRes.json();
                    return jsonResponse({ success: balRes.ok, balance: balData, http_status: balRes.status }, 200, corsHeaders);
                } catch (err) {
                    return jsonResponse({ success: false, error: err.message }, 200, corsHeaders);
                }
            }

            // ============================================
            // ADMIN — GET STYLE AI PARAMS
            // ============================================
            if (url.pathname === '/admin/style-tuning' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.style_ai_params&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const rows = await res.json();
                const saved = (res.ok && rows && rows.length > 0) ? rows[0].value : null;
                return jsonResponse({ success: true, params: saved }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — SAVE STYLE AI PARAMS
            // ============================================
            if (url.pathname === '/admin/style-tuning' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json();
                const { params } = body;
                if (!params || typeof params !== 'object') {
                    return jsonResponse({ success: false, error: 'params object required' }, 400, corsHeaders);
                }
                const VALID_STYLES = ['freestyle','playful','witty','flirty','confident','bold','charming','gentle','serious','romantic'];
                const sanitizedParams = {};
                for (const style of VALID_STYLES) {
                    if (params[style] && typeof params[style] === 'object') {
                        const t = parseFloat(params[style].temperature);
                        const m = parseInt(params[style].max_tokens, 10);
                        if (!isNaN(t) && t >= 0 && t <= 2 && !isNaN(m) && m > 0 && m <= 500) {
                            sanitizedParams[style] = { temperature: t, max_tokens: m };
                        }
                    }
                }
                const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/config`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates',
                    },
                    body: JSON.stringify({ key: 'style_ai_params', value: sanitizedParams, updated_at: new Date().toISOString() }),
                });
                if (!saveRes.ok) {
                    const err = await saveRes.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Save failed' }, 500, corsHeaders);
                }
                const adminEmailStyleLog = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'update_style_ai_params', targetType: 'config', targetId: 'style_ai_params',
                    targetLabel: 'Style AI Parameters',
                    details: { styles_updated: Object.keys(sanitizedParams) },
                    adminEmail: adminEmailStyleLog,
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 11. ADMIN — LIST USERS
            // ============================================
            if (url.pathname === '/api/users' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/users?select=id,email,full_name,plan,subscription_status,plan_expires_at,trial_likes_used,trial_messages_used,trial_started_at,stripe_customer_id,stripe_subscription_id,cancelled_at,is_banned,is_admin,created_at,updated_at,whatsapp_number&order=created_at.desc`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const users = await res.json();
                if (!res.ok) {
                    const errMsg = users?.message || users?.error || 'Failed to fetch users';
                    return jsonResponse({ success: false, error: errMsg }, 500, corsHeaders);
                }

                // Fetch trial duration from config to compute trial expiry for trial users
                let trialDurationHours = 120;
                try {
                    const cfgRows = await fetch(
                        `${SUPABASE_URL}/rest/v1/config?key=eq.trial_settings&select=value`,
                        { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                    ).then(r => r.json());
                    if (cfgRows?.[0]?.value?.trial_duration_hours) {
                        trialDurationHours = cfgRows[0].value.trial_duration_hours;
                    }
                } catch (_) {}

                const now = new Date();
                const enrichedUsers = users.map(u => {
                    const isTrial = u.plan === 'trial' || u.subscription_status === 'trial' || u.subscription_status === 'trialing';
                    if (isTrial && !u.plan_expires_at && u.trial_started_at) {
                        const expiry = new Date(new Date(u.trial_started_at).getTime() + trialDurationHours * 60 * 60 * 1000);
                        const isExpired = now > expiry;
                        return {
                            ...u,
                            plan_expires_at: expiry.toISOString(),
                            subscription_status: isExpired ? 'expired' : (u.subscription_status === 'trialing' ? 'trial' : u.subscription_status)
                        };
                    }
                    return u;
                });

                return jsonResponse({ success: true, users: enrichedUsers }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — UPDATE USER (upgrade/downgrade/ban/reset)
            // ============================================
            if (url.pathname === '/admin/users' && method === 'PATCH') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const reqBody = await request.json();
                const { userId, action, userEmail, userLabel } = reqBody;
                if (!userId || !action) {
                    return jsonResponse({ success: false, error: 'Missing userId or action' }, 400, corsHeaders);
                }

                let updateData = {};
                const now = new Date().toISOString();

                if (action === 'upgrade') {
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 30);
                    updateData = { plan: 'pro', subscription_status: 'active', plan_expires_at: expiresAt.toISOString(), updated_at: now };
                } else if (action === 'downgrade') {
                    updateData = { plan: 'trial', subscription_status: 'expired', plan_expires_at: null, updated_at: now };
                } else if (action === 'reset_trial') {
                    updateData = { plan: 'trial', subscription_status: 'trial', trial_started_at: now, trial_likes_used: 0, trial_messages_used: 0, plan_expires_at: null, updated_at: now };
                } else if (action === 'ban') {
                    updateData = { is_banned: true, updated_at: now };
                } else if (action === 'unban') {
                    updateData = { is_banned: false, updated_at: now };
                } else if (action === 'grant_admin') {
                    updateData = { is_admin: true, updated_at: now };
                } else if (action === 'revoke_admin') {
                    updateData = { is_admin: false, updated_at: now };
                } else if (action === 'force_reauth') {
                    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.force_reauth_users&select=value`, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
                    const cfgRows = await cfgRes.json();
                    const existing = cfgRows?.[0]?.value?.user_ids || [];
                    const updated_ids = existing.includes(userId) ? existing : [...existing, userId];
                    if (cfgRows?.[0]) {
                        await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.force_reauth_users`, { method: 'PATCH', headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify({ value: { user_ids: updated_ids }, updated_at: now }) });
                    } else {
                        await fetch(`${SUPABASE_URL}/rest/v1/config`, { method: 'POST', headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' }, body: JSON.stringify({ key: 'force_reauth_users', value: { user_ids: updated_ids }, updated_at: now }) });
                    }
                    const adminEmailForLog2 = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                    await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, { action: 'user_force_reauth', targetType: 'user', targetId: userId, targetLabel: userEmail || userId, details: { action_description: 'Forced Re-Login', user_email: userEmail, user_id: userId, user_name: userLabel }, adminEmail: adminEmailForLog2 });
                    return jsonResponse({ success: true }, 200, corsHeaders);
                } else {
                    return jsonResponse({ success: false, error: 'Unknown action' }, 400, corsHeaders);
                }

                const updated = await supabaseUpdate('users', userId, updateData);
                if (!updated) {
                    return jsonResponse({ success: false, error: 'Failed to update user' }, 500, corsHeaders);
                }

                const adminEmailForLog = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                const actionLabels = {
                    upgrade: 'Upgraded to Pro (30 days)', downgrade: 'Downgraded to Trial',
                    reset_trial: 'Trial Reset', ban: 'Account Banned', unban: 'Account Unbanned',
                    grant_admin: 'Admin Access Granted', revoke_admin: 'Admin Access Revoked'
                };
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: `user_${action}`, targetType: 'user', targetId: userId,
                    targetLabel: userEmail || userId,
                    details: { action_description: actionLabels[action] || action, user_email: userEmail, user_id: userId, user_name: userLabel },
                    adminEmail: adminEmailForLog
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 12. ADMIN — DIRECT EDIT USER FIELDS
            // ============================================
            if (url.pathname.startsWith('/admin/users/') && url.pathname.endsWith('/edit') && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const userId = url.pathname.split('/')[3];
                if (!userId) return jsonResponse({ success: false, error: 'Missing userId in path' }, 400, corsHeaders);

                const body = await request.json();
                const { fields } = body;
                if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
                    return jsonResponse({ success: false, error: 'fields object is required' }, 400, corsHeaders);
                }

                const ALLOWED_FIELDS = ['name', 'email', 'plan', 'subscription_status',
                    'trial_likes_used', 'trial_messages_used', 'expired_at',
                    'stripe_customer_id', 'stripe_subscription_id'];

                // Map frontend field names → actual DB column names
                const FIELD_MAP = {
                    name: 'full_name',
                    expired_at: 'plan_expires_at',
                };

                const updateData = { updated_at: new Date().toISOString() };
                for (const [k, v] of Object.entries(fields)) {
                    if (ALLOWED_FIELDS.includes(k)) {
                        const dbKey = FIELD_MAP[k] || k;
                        updateData[dbKey] = v;
                    }
                }

                if (Object.keys(updateData).length === 1) {
                    return jsonResponse({ success: false, error: 'No valid fields to update' }, 400, corsHeaders);
                }

                const updated = await supabaseUpdate('users', userId, updateData);
                if (!updated) {
                    return jsonResponse({ success: false, error: 'Failed to update user' }, 500, corsHeaders);
                }

                const adminEmailEdit = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                const changedKeys = Object.keys(fields).filter(k => ALLOWED_FIELDS.includes(k));
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'edit_user', targetType: 'user', targetId: userId,
                    targetLabel: fields.email || userId,
                    details: { changed_fields: changedKeys, new_values: fields },
                    adminEmail: adminEmailEdit
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 13. GET REMOTE CONFIG (prompts, etc.)
            // ============================================
            if (url.pathname === '/api/config/prompts' && method === 'GET') {
                const response = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=in.(prompt_modes,language_slang_guide,legacy_templates,style_ai_params,style_enhancements,claude_rewrite_config,style_training_config,contact_sharing_rules)&select=key,value`,
                    {
                        headers: {
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const rows = await response.json();

                if (!response.ok) {
                    return jsonResponse({ success: false, error: 'Config not found' }, 404, corsHeaders);
                }

                const config = {};
                (rows || []).forEach(row => { config[row.key] = row.value; });

                return jsonResponse({
                    success: true,
                    promptModes: config.prompt_modes || null,
                    languageSlangGuide: config.language_slang_guide || null,
                    legacyTemplates: config.legacy_templates || null,
                    styleAiParams: config.style_ai_params || null,
                    styleEnhancements: config.style_enhancements || null,
                    claudeRewriteConfig: config.claude_rewrite_config || null,
                    styleTrainingConfig: config.style_training_config || null,
                    contactSharingRules: config.contact_sharing_rules || null,
                }, 200, corsHeaders);
            }

            // ============================================
            // 13. PUBLIC — GET RATE LIMITS CONFIG (extension reads on startup)
            // ============================================
            if (url.pathname === '/api/config/rate-limits' && method === 'GET') {
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.rate_limits&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const rows = await res.json();
                if (!res.ok || !rows || rows.length === 0) {
                    return jsonResponse({
                        success: true,
                        rateLimits: {
                            trial:     { lifetime_likes: TRIAL_LIMITS.likes, lifetime_messages: TRIAL_LIMITS.messages },
                            safety:    { hourly_likes: 50, hourly_messages: 50 },
                            humanizer: { swipe_min_ms: 2000, swipe_max_ms: 4000 }
                        }
                    }, 200, corsHeaders);
                }
                return jsonResponse({ success: true, rateLimits: rows[0].value }, 200, corsHeaders);
            }

            // ============================================
            // 14. PUBLIC — GET FEATURE FLAGS CONFIG (extension reads on startup)
            // ============================================
            if (url.pathname === '/api/config/feature-flags' && method === 'GET') {
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.feature_flags&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const rows = await res.json();
                const defaults = {
                    auto_swiping_enabled: true,
                    ai_messaging_enabled: true,
                    follow_up_messages_enabled: true,
                    bumble_support_enabled: true,
                    move_off_app_enabled: true,
                    achievements_enabled: true,
                    force_reauth: false,
                };
                if (!res.ok || !rows || rows.length === 0) {
                    return jsonResponse({ success: true, featureFlags: defaults }, 200, corsHeaders);
                }
                const flags = { ...defaults, ...rows[0].value };
                // Auto-expire force_reauth after 24h
                if (flags.force_reauth && flags.force_reauth_enabled_at) {
                    if (Date.now() - flags.force_reauth_enabled_at > 24 * 60 * 60 * 1000) {
                        flags.force_reauth = false;
                    }
                }
                return jsonResponse({ success: true, featureFlags: flags }, 200, corsHeaders);
            }

            // ============================================
            // 15. ADMIN — GET RATE LIMITS
            // ============================================
            if (url.pathname === '/admin/rate-limits' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.rate_limits&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const rows = await res.json();
                if (!res.ok || !rows || rows.length === 0) {
                    return jsonResponse({ success: false, error: 'rate_limits config not found in Supabase. Run the seed SQL first.' }, 404, corsHeaders);
                }
                return jsonResponse({ success: true, rateLimits: rows[0].value }, 200, corsHeaders);
            }

            // ============================================
            // 15. ADMIN — SAVE RATE LIMITS
            // ============================================
            if (url.pathname === '/admin/rate-limits' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json();
                const { trial, safety, humanizer } = body.rateLimits || {};
                if (!trial || !safety || !humanizer) {
                    return jsonResponse({ success: false, error: 'rateLimits must include trial, safety, and humanizer keys' }, 400, corsHeaders);
                }
                if (
                    typeof trial.lifetime_likes !== 'number' || typeof trial.lifetime_messages !== 'number' ||
                    typeof safety.hourly_likes !== 'number'  || typeof safety.hourly_messages !== 'number' ||
                    typeof humanizer.swipe_min_ms !== 'number' || typeof humanizer.swipe_max_ms !== 'number'
                ) {
                    return jsonResponse({ success: false, error: 'All rate limit values must be numbers' }, 400, corsHeaders);
                }
                if (humanizer.swipe_min_ms >= humanizer.swipe_max_ms) {
                    return jsonResponse({ success: false, error: 'swipe_min_ms must be less than swipe_max_ms' }, 400, corsHeaders);
                }
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'resolution=merge-duplicates'
                        },
                        body: JSON.stringify({ key: 'rate_limits', value: body.rateLimits, updated_at: new Date().toISOString() })
                    }
                );
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Supabase update failed' }, 500, corsHeaders);
                }
                const adminEmailRL = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'update_rate_limits', targetType: 'config', targetId: 'rate_limits', targetLabel: 'Rate Limits',
                    details: body.rateLimits, adminEmail: adminEmailRL
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 16. ADMIN — GET AI SETTINGS
            // ============================================
            if (url.pathname === '/admin/ai-settings' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.ai_settings&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const rows = await res.json();
                if (!res.ok || !rows || rows.length === 0) {
                    return jsonResponse({
                        success: true,
                        aiSettings: { model: 'gpt-4o', api_key: '' }
                    }, 200, corsHeaders);
                }
                const val = rows[0].value;
                return jsonResponse({
                    success: true,
                    aiSettings: { model: val.model || 'gpt-4o', api_key: val.api_key || '' }
                }, 200, corsHeaders);
            }

            // ============================================
            // 17. ADMIN — SAVE AI SETTINGS
            // ============================================
            if (url.pathname === '/admin/ai-settings' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json();
                const { model, api_key } = body.aiSettings || {};
                if (!model || typeof model !== 'string' || model.trim() === '') {
                    return jsonResponse({ success: false, error: 'model is required and must be a non-empty string' }, 400, corsHeaders);
                }
                if (!api_key || typeof api_key !== 'string' || !api_key.startsWith('sk-')) {
                    return jsonResponse({ success: false, error: 'api_key is required and must start with sk-' }, 400, corsHeaders);
                }
                const payload = { model: model.trim(), api_key: api_key.trim() };
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'resolution=merge-duplicates'
                        },
                        body: JSON.stringify({ key: 'ai_settings', value: payload, updated_at: new Date().toISOString() })
                    }
                );
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Supabase update failed' }, 500, corsHeaders);
                }
                const adminEmailAI = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'update_ai_settings', targetType: 'config', targetId: 'ai_settings', targetLabel: 'AI Settings',
                    details: { model: model.trim() },
                    adminEmail: adminEmailAI
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 18. ADMIN — GET AUDIT LOGS
            // ============================================
            if (url.pathname === '/admin/audit-logs' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const limit = parseInt(url.searchParams.get('limit') || '100', 10);
                const offset = parseInt(url.searchParams.get('offset') || '0', 10);
                const actionFilter = url.searchParams.get('action') || '';
                const adminFilter = url.searchParams.get('admin_email') || '';

                let query = `${SUPABASE_URL}/rest/v1/audit_logs?order=created_at.desc&limit=${limit}&offset=${offset}`;
                if (actionFilter) query += `&action=eq.${encodeURIComponent(actionFilter)}`;
                if (adminFilter) query += `&admin_email=eq.${encodeURIComponent(adminFilter)}`;
                query += `&select=id,action,target_type,target_id,target_label,details,admin_email,created_at`;

                const res = await fetch(query, {
                    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                });
                const logs = await res.json();
                if (!res.ok) {
                    return jsonResponse({ success: false, error: logs?.message || 'Failed to fetch audit logs' }, 500, corsHeaders);
                }
                return jsonResponse({ success: true, logs }, 200, corsHeaders);
            }

            // ============================================
            // 19. ADMIN — GET FEATURE FLAGS
            // ============================================
            if (url.pathname === '/admin/feature-flags' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const [flagsRes, usersCountRes] = await Promise.all([
                    fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.feature_flags&select=value`, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }),
                    fetch(`${SUPABASE_URL}/rest/v1/users?select=id`, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' } })
                ]);
                const rows = await flagsRes.json();
                const totalUsers = parseInt(usersCountRes.headers.get('Content-Range')?.split('/')[1] || '0', 10);
                const defaults = {
                    auto_swiping_enabled: true,
                    ai_messaging_enabled: true,
                    follow_up_messages_enabled: true,
                    bumble_support_enabled: true,
                    move_off_app_enabled: true,
                    achievements_enabled: true,
                    force_reauth: false,
                };
                if (!flagsRes.ok || !rows || rows.length === 0) {
                    return jsonResponse({ success: true, featureFlags: { ...defaults, force_reauth_total_users: totalUsers } }, 200, corsHeaders);
                }
                const adminFlags = { ...defaults, ...rows[0].value, force_reauth_total_users: totalUsers };
                // Apply 24h auto-expire in admin view too
                if (adminFlags.force_reauth && adminFlags.force_reauth_enabled_at) {
                    if (Date.now() - adminFlags.force_reauth_enabled_at > 24 * 60 * 60 * 1000) {
                        adminFlags.force_reauth = false;
                    }
                }
                return jsonResponse({ success: true, featureFlags: adminFlags }, 200, corsHeaders);
            }

            // ============================================
            // 20. ADMIN — SAVE FEATURE FLAGS
            // ============================================
            if (url.pathname === '/admin/feature-flags' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json();
                const { featureFlags } = body;
                if (!featureFlags || typeof featureFlags !== 'object') {
                    return jsonResponse({ success: false, error: 'featureFlags object is required' }, 400, corsHeaders);
                }

                // Fetch current saved value to detect force_reauth transition
                const curRes = await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.feature_flags&select=value`, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } });
                const curRows = await curRes.json();
                const current = curRows?.[0]?.value || {};
                const wasEnabled = !!current.force_reauth;
                const nowEnabled = !!featureFlags.force_reauth;

                let toSave = { ...featureFlags };
                delete toSave.force_reauth_total_users; // computed field, never persisted
                if (!wasEnabled && nowEnabled) {
                    // Turning ON: stamp the time, reset signed-out counter
                    toSave.force_reauth_enabled_at = Date.now();
                    toSave.force_reauth_signed_out = 0;
                } else if (wasEnabled && !nowEnabled) {
                    // Turning OFF: clear meta (keep for history, admin can see last run)
                    delete toSave.force_reauth_enabled_at;
                    delete toSave.force_reauth_signed_out;
                } else {
                    // No change in force_reauth state — preserve existing meta
                    if (current.force_reauth_enabled_at) toSave.force_reauth_enabled_at = current.force_reauth_enabled_at;
                    if (current.force_reauth_signed_out !== undefined) toSave.force_reauth_signed_out = current.force_reauth_signed_out;
                }

                const res = await fetch(`${SUPABASE_URL}/rest/v1/config`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify({ key: 'feature_flags', value: toSave, updated_at: new Date().toISOString() })
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Supabase update failed' }, 500, corsHeaders);
                }
                const adminEmailFF = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'update_feature_flags', targetType: 'config', targetId: 'feature_flags',
                    targetLabel: 'Feature Flags', details: toSave, adminEmail: adminEmailFF
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 21. ADMIN — GET TRIAL SETTINGS
            // ============================================
            if (url.pathname === '/admin/trial-settings' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.trial_settings&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const rows = await res.json();
                if (!res.ok || !rows || rows.length === 0) {
                    return jsonResponse({
                        success: true,
                        trialSettings: { trial_duration_hours: 72, trial_enabled: true, new_user_gets_trial: true }
                    }, 200, corsHeaders);
                }
                return jsonResponse({ success: true, trialSettings: rows[0].value }, 200, corsHeaders);
            }

            // ============================================
            // 20. ADMIN — SAVE TRIAL SETTINGS
            // ============================================
            if (url.pathname === '/admin/trial-settings' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json();
                const { trialSettings } = body;
                if (!trialSettings || typeof trialSettings.trial_duration_hours !== 'number') {
                    return jsonResponse({ success: false, error: 'trialSettings.trial_duration_hours (number) is required' }, 400, corsHeaders);
                }
                if (trialSettings.trial_duration_hours < 1 || trialSettings.trial_duration_hours > 8760) {
                    return jsonResponse({ success: false, error: 'trial_duration_hours must be between 1 and 8760 (1 year)' }, 400, corsHeaders);
                }
                const res = await fetch(`${SUPABASE_URL}/rest/v1/config`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify({ key: 'trial_settings', value: trialSettings, updated_at: new Date().toISOString() })
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Supabase update failed' }, 500, corsHeaders);
                }
                const adminEmailTS = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'update_trial_settings', targetType: 'config', targetId: 'trial_settings',
                    targetLabel: 'Trial Settings', details: trialSettings, adminEmail: adminEmailTS
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 21. ADMIN — CLEAR AUDIT LOGS
            // ============================================
            if (url.pathname === '/admin/audit-logs' && method === 'DELETE') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const res = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs?id=neq.00000000-0000-0000-0000-000000000000`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Prefer': 'return=minimal'
                    }
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err?.message || 'Failed to clear audit logs' }, 500, corsHeaders);
                }
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 22. PUBLIC — REPORT ERROR FROM EXTENSION
            // ============================================
            if (url.pathname === '/api/errors/report' && method === 'POST') {
                let body;
                try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Invalid JSON' }, 400, corsHeaders); }
                const { user_id, platform, error_type, selector_key, error_message, page_url } = body || {};
                if (!platform || !error_type || !error_message) {
                    return jsonResponse({ success: false, error: 'platform, error_type and error_message are required' }, 400, corsHeaders);
                }
                const normPlatform = String(platform).toLowerCase().slice(0, 32);
                const normErrorType = String(error_type).toLowerCase().slice(0, 64);
                const normSelectorKey = selector_key ? String(selector_key).slice(0, 128) : null;

                // Server-side deduplication — suppress identical errors within 5 minutes, scoped per user
                const dedupeWindow = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                let dedupeQuery = `${SUPABASE_URL}/rest/v1/error_logs?select=id&limit=1`
                    + `&platform=eq.${encodeURIComponent(normPlatform)}`
                    + `&error_type=eq.${encodeURIComponent(normErrorType)}`
                    + `&occurred_at=gte.${encodeURIComponent(dedupeWindow)}`;
                if (normSelectorKey) dedupeQuery += `&selector_key=eq.${encodeURIComponent(normSelectorKey)}`;
                if (user_id) dedupeQuery += `&user_id=eq.${encodeURIComponent(user_id)}`;
                else dedupeQuery += `&user_id=is.null`;
                const dedupeRes = await fetch(dedupeQuery, {
                    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                });
                if (dedupeRes.ok) {
                    const existing = await dedupeRes.json();
                    if (Array.isArray(existing) && existing.length > 0) {
                        return jsonResponse({ success: true, deduplicated: true }, 200, corsHeaders);
                    }
                }

                const row = {
                    user_id: user_id || null,
                    platform: normPlatform,
                    error_type: normErrorType,
                    selector_key: normSelectorKey,
                    error_message: String(error_message).slice(0, 1000),
                    page_url: page_url ? String(page_url).slice(0, 512) : null,
                };
                const res = await fetch(`${SUPABASE_URL}/rest/v1/error_logs`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(row)
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Failed to insert error log' }, 500, corsHeaders);
                }
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 23. ADMIN — GET ERROR LOGS
            // ============================================
            if (url.pathname === '/admin/error-logs' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
                const offset = parseInt(url.searchParams.get('offset') || '0');
                const platform = (url.searchParams.get('platform') || '').toLowerCase();
                const error_type = (url.searchParams.get('error_type') || '').toLowerCase();
                const from_date = url.searchParams.get('from_date') || '';
                let query = `${SUPABASE_URL}/rest/v1/error_logs?select=*&order=occurred_at.desc&limit=${limit}&offset=${offset}`;
                if (platform) query += `&platform=eq.${encodeURIComponent(platform)}`;
                if (error_type) query += `&error_type=eq.${encodeURIComponent(error_type)}`;
                if (from_date) query += `&occurred_at=gte.${encodeURIComponent(from_date)}`;
                const res = await fetch(query, {
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Prefer': 'count=exact'
                    }
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Failed to fetch error logs' }, 500, corsHeaders);
                }
                const logs = await res.json();
                const totalCount = parseInt(res.headers.get('Content-Range')?.split('/')[1] || '0');
                return jsonResponse({ success: true, logs, total: totalCount }, 200, corsHeaders);
            }

            // ============================================
            // 24. ADMIN — CLEAR ERROR LOGS
            // ============================================
            if (url.pathname === '/admin/error-logs' && method === 'DELETE') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const res = await fetch(`${SUPABASE_URL}/rest/v1/error_logs?id=neq.00000000-0000-0000-0000-000000000000`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Prefer': 'return=minimal'
                    }
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Failed to clear error logs' }, 500, corsHeaders);
                }
                const adminEmailClear = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'clear_error_logs', targetType: 'error_logs', targetId: 'all',
                    targetLabel: 'Error Logs', details: {}, adminEmail: adminEmailClear
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // 25. ADMIN — GET GROUPED ERROR ISSUES
            // Groups error_logs by platform+error_type+selector_key, merges status
            // from error_issue_status table, returns sorted by last_seen desc
            // ============================================
            if (url.pathname === '/admin/error-logs/grouped' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);

                const fromDate = url.searchParams.get('from_date') || '';
                const platformFilter = (url.searchParams.get('platform') || '').toLowerCase();

                // Fetch up to 5000 recent events to aggregate
                let logsQuery = `${SUPABASE_URL}/rest/v1/error_logs?select=platform,error_type,selector_key,user_id,occurred_at&order=occurred_at.desc&limit=5000`;
                if (fromDate) logsQuery += `&occurred_at=gte.${encodeURIComponent(fromDate)}`;
                if (platformFilter) logsQuery += `&platform=eq.${encodeURIComponent(platformFilter)}`;

                const [logsRes, statusRes] = await Promise.all([
                    fetch(logsQuery, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }),
                    fetch(`${SUPABASE_URL}/rest/v1/error_issue_status?select=*`, { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } })
                ]);

                if (!logsRes.ok) {
                    const e = await logsRes.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: e.message || 'Failed to fetch error logs' }, 500, corsHeaders);
                }

                const rawLogs = await logsRes.json();
                const statusRows = statusRes.ok ? (await statusRes.json().catch(() => [])) : [];
                const statusMap = {};
                for (const s of statusRows) statusMap[s.issue_key] = s;

                // Group by platform:error_type:selector_key
                const groups = {};
                for (const log of rawLogs) {
                    const key = `${log.platform}:${log.error_type}:${log.selector_key || ''}`;
                    if (!groups[key]) {
                        groups[key] = {
                            issue_key: key,
                            platform: log.platform,
                            error_type: log.error_type,
                            selector_key: log.selector_key || null,
                            count: 0,
                            users: new Set(),
                            first_seen: log.occurred_at,
                            last_seen: log.occurred_at,
                        };
                    }
                    const g = groups[key];
                    g.count++;
                    if (log.user_id) g.users.add(log.user_id);
                    if (log.occurred_at < g.first_seen) g.first_seen = log.occurred_at;
                    if (log.occurred_at > g.last_seen) g.last_seen = log.occurred_at;
                }

                // Build output, merge status
                const issues = Object.values(groups).map(g => {
                    const s = statusMap[g.issue_key] || {};
                    return {
                        issue_key: g.issue_key,
                        platform: g.platform,
                        error_type: g.error_type,
                        selector_key: g.selector_key,
                        count: g.count,
                        users_affected: g.users.size,
                        first_seen: g.first_seen,
                        last_seen: g.last_seen,
                        status: s.status || 'open',
                        updated_by: s.updated_by || null,
                        status_updated_at: s.updated_at || null,
                    };
                });

                // Sort: open first by count desc, then investigating, then resolved/ignored
                const statusOrder = { open: 0, investigating: 1, resolved: 2, ignored: 3 };
                issues.sort((a, b) => {
                    const so = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
                    if (so !== 0) return so;
                    return b.count - a.count;
                });

                return jsonResponse({ success: true, issues }, 200, corsHeaders);
            }

            // ============================================
            // 26. ADMIN — UPDATE ISSUE STATUS
            // ============================================
            if (url.pathname === '/admin/error-logs/issues' && method === 'PATCH') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);

                let body;
                try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Invalid JSON' }, 400, corsHeaders); }
                const { issue_key, platform, error_type, selector_key, status } = body || {};
                const validStatuses = ['open', 'investigating', 'resolved', 'ignored'];
                if (!issue_key || !status || !validStatuses.includes(status)) {
                    return jsonResponse({ success: false, error: 'issue_key and valid status required' }, 400, corsHeaders);
                }
                const adminEmail = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                const row = {
                    issue_key,
                    platform: platform || issue_key.split(':')[0],
                    error_type: error_type || issue_key.split(':')[1],
                    selector_key: selector_key || issue_key.split(':')[2] || null,
                    status,
                    updated_at: new Date().toISOString(),
                    updated_by: adminEmail || null,
                };
                const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/error_issue_status`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates,return=minimal',
                    },
                    body: JSON.stringify(row),
                });
                if (!upsertRes.ok) {
                    const e = await upsertRes.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: e.message || 'Failed to update status' }, 500, corsHeaders);
                }
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'update_issue_status', targetType: 'error_issue', targetId: issue_key,
                    targetLabel: issue_key, details: { status }, adminEmail,
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // COMMUNITY: Register code (user authenticated)
            // Required Supabase table:
            //   CREATE TABLE community_codes (
            //     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            //     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            //     code TEXT UNIQUE NOT NULL,
            //     claimed BOOLEAN NOT NULL DEFAULT FALSE,
            //     claimed_at TIMESTAMPTZ,
            //     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            //   );
            //   CREATE UNIQUE INDEX community_codes_user_id_idx ON community_codes(user_id);
            // ============================================
            if (url.pathname === '/community/register' && method === 'POST') {
                const authHeader = request.headers.get('Authorization');
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const token = authHeader.split(' ')[1];
                const payload = await verifyJWT(token);
                if (!payload) {
                    return jsonResponse({ success: false, error: 'Invalid token' }, 401, corsHeaders);
                }

                const existing = await fetch(
                    `${SUPABASE_URL}/rest/v1/community_codes?user_id=eq.${payload.id}&select=code,claimed,claimed_at`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                ).then(r => r.json());

                if (existing && existing.length > 0) {
                    return jsonResponse({ success: true, code: existing[0].code, claimed: existing[0].claimed, claimedAt: existing[0].claimed_at }, 200, corsHeaders);
                }

                const encoder = new TextEncoder();
                const salt = 'FlirtEasyCommunity2026';
                const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(payload.id + salt));
                const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
                const code = 'FLIRT-' + hashHex.substring(0, 6).toUpperCase();

                const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/community_codes`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ user_id: payload.id, code })
                });

                if (!insertRes.ok) {
                    const err = await insertRes.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Failed to register code' }, 500, corsHeaders);
                }

                return jsonResponse({ success: true, code, claimed: false, claimedAt: null }, 200, corsHeaders);
            }

            // ============================================
            // COMMUNITY: Claim code (admin authenticated)
            // ============================================
            if (url.pathname === '/community/claim' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const { code } = await request.json();
                if (!code) {
                    return jsonResponse({ success: false, error: 'Code is required' }, 400, corsHeaders);
                }

                const codeRows = await fetch(
                    `${SUPABASE_URL}/rest/v1/community_codes?code=eq.${encodeURIComponent(code)}&select=id,user_id,claimed`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                ).then(r => r.json());

                if (!codeRows || codeRows.length === 0) {
                    return jsonResponse({ success: false, error: 'Code not found' }, 404, corsHeaders);
                }

                const codeRow = codeRows[0];
                if (codeRow.claimed) {
                    return jsonResponse({ success: false, error: 'Code already claimed' }, 409, corsHeaders);
                }

                const userRows = await supabaseQuery('users', 'id', codeRow.user_id);
                if (!userRows || userRows.length === 0) {
                    return jsonResponse({ success: false, error: 'User not found' }, 404, corsHeaders);
                }
                const targetUser = userRows[0];

                // Grant 1 month of full Pro access — stacked on top of any existing expiry
                // If user already has future plan_expires_at (paid Pro), add 30 days to that.
                // Otherwise add 30 days from now, so trial/expired users get full 30 days.
                const existingExpiry = targetUser.plan_expires_at ? new Date(targetUser.plan_expires_at) : null;
                const baseDate = (existingExpiry && existingExpiry > new Date()) ? existingExpiry : new Date();
                const proUntil = new Date(baseDate);
                proUntil.setDate(proUntil.getDate() + 30);

                const [upgradeOk, claimOk] = await Promise.all([
                    supabaseUpdate('users', codeRow.user_id, {
                        plan: 'pro',
                        subscription_status: 'active',
                        plan_expires_at: proUntil.toISOString(),
                        trial_likes_used: 0,
                        trial_messages_used: 0,
                        updated_at: new Date().toISOString()
                    }),
                    fetch(`${SUPABASE_URL}/rest/v1/community_codes?id=eq.${codeRow.id}`, {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ claimed: true, claimed_at: new Date().toISOString() })
                    }).then(r => r.ok)
                ]);

                if (!upgradeOk || !claimOk) {
                    return jsonResponse({ success: false, error: 'Failed to apply upgrade' }, 500, corsHeaders);
                }

                const adminEmail = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'community_code_claimed', targetType: 'user', targetId: codeRow.user_id,
                    targetLabel: targetUser.email, details: { code, proUntil: proUntil.toISOString() }, adminEmail
                });

                return jsonResponse({
                    success: true,
                    userEmail: targetUser.email,
                    upgradedUntil: proUntil.toISOString()
                }, 200, corsHeaders);
            }

            // ============================================
            // COMMUNITY: Revoke claim (admin) — resets user to trial, unclaims code
            // ============================================
            if (url.pathname === '/community/revoke' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const { code } = await request.json();
                if (!code) {
                    return jsonResponse({ success: false, error: 'Code is required' }, 400, corsHeaders);
                }

                const codeRows = await fetch(
                    `${SUPABASE_URL}/rest/v1/community_codes?code=eq.${encodeURIComponent(code)}&select=id,user_id,claimed`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                ).then(r => r.json());

                if (!codeRows || codeRows.length === 0) {
                    return jsonResponse({ success: false, error: 'Code not found' }, 404, corsHeaders);
                }

                const codeRow = codeRows[0];
                const userRows = await supabaseQuery('users', 'id', codeRow.user_id);
                const targetUser = userRows?.[0];

                // Subtract the 30 days that were added during claim.
                // If the remaining expiry is still in the future, keep them as Pro.
                // If it falls to the past, revert fully to trial.
                let revertData = { plan: 'trial', subscription_status: 'trial', plan_expires_at: null, updated_at: new Date().toISOString() };
                if (targetUser?.plan_expires_at) {
                    const currentExpiry = new Date(targetUser.plan_expires_at);
                    const restoredExpiry = new Date(currentExpiry);
                    restoredExpiry.setDate(restoredExpiry.getDate() - 30);
                    if (restoredExpiry > new Date()) {
                        revertData = { plan: 'pro', subscription_status: 'active', plan_expires_at: restoredExpiry.toISOString(), updated_at: new Date().toISOString() };
                    }
                }

                const [revertOk, unclaimOk] = await Promise.all([
                    targetUser ? supabaseUpdate('users', codeRow.user_id, revertData) : Promise.resolve(true),
                    fetch(`${SUPABASE_URL}/rest/v1/community_codes?id=eq.${codeRow.id}`, {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ claimed: false, claimed_at: null })
                    }).then(r => r.ok)
                ]);

                if (!revertOk || !unclaimOk) {
                    return jsonResponse({ success: false, error: 'Failed to revoke claim' }, 500, corsHeaders);
                }

                const adminEmail = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'community_code_revoked', targetType: 'user', targetId: codeRow.user_id,
                    targetLabel: targetUser?.email || codeRow.user_id,
                    details: { code, revertedTo: revertData.plan, restoredExpiry: revertData.plan_expires_at }, adminEmail
                });

                return jsonResponse({ success: true, userEmail: targetUser?.email, revertedTo: revertData.plan, restoredExpiry: revertData.plan_expires_at }, 200, corsHeaders);
            }

            // ============================================
            // COMMUNITY: Delete code row (admin)
            // ============================================
            if (url.pathname === '/community/delete-code' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const { id } = await request.json();
                if (!id) {
                    return jsonResponse({ success: false, error: 'ID is required' }, 400, corsHeaders);
                }

                const deleteRes = await fetch(`${SUPABASE_URL}/rest/v1/community_codes?id=eq.${id}`, {
                    method: 'DELETE',
                    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                });

                if (!deleteRes.ok) {
                    return jsonResponse({ success: false, error: 'Failed to delete code' }, 500, corsHeaders);
                }

                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // COMMUNITY: List all codes (admin)
            // ============================================
            if (url.pathname === '/admin/community-codes' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }

                const sbHdrs = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` };
                const ccBase = `${SUPABASE_URL}/rest/v1/community_codes?select=id,code,claimed,claimed_at,created_at,user_id&order=created_at.desc`;

                // Adaptive fetch — discovers and bypasses Supabase max_rows cap
                const firstCCRes = await fetch(ccBase, { headers: { ...sbHdrs, 'Prefer': 'count=exact' } });
                if (!firstCCRes.ok) return jsonResponse({ success: false, error: `Supabase error ${firstCCRes.status}` }, 500, corsHeaders);
                const firstCC = await firstCCRes.json();
                const ccCR = firstCCRes.headers.get('content-range');
                const ccTotal = ccCR ? (parseInt(ccCR.split('/')[1], 10) || firstCC.length) : firstCC.length;
                let rows = firstCC;
                if (Array.isArray(firstCC) && firstCC.length < ccTotal) {
                    const cap = firstCC.length;
                    const extraBatches = await Promise.all(
                        Array.from({ length: Math.ceil((ccTotal - cap) / cap) }, (_, i) =>
                            fetch(`${ccBase}&limit=${cap}&offset=${cap + i * cap}`, { headers: sbHdrs })
                                .then(r => r.ok ? r.json() : []).catch(() => [])
                        )
                    );
                    rows = [...firstCC, ...extraBatches.flat()];
                }

                const userIds = [...new Set((rows || []).map(r => r.user_id))];
                let emailMap = {};
                if (userIds.length > 0) {
                    // Fetch users in batches of 100 to avoid URL length limits
                    const userBatches = [];
                    for (let i = 0; i < userIds.length; i += 100) userBatches.push(userIds.slice(i, i + 100));
                    const usersRows = (await Promise.all(
                        userBatches.map(batch =>
                            fetch(`${SUPABASE_URL}/rest/v1/users?id=in.(${batch.join(',')})&select=id,email`, { headers: sbHdrs })
                                .then(r => r.json()).catch(() => [])
                        )
                    )).flat();
                    (usersRows || []).forEach(u => { emailMap[u.id] = u.email; });
                }

                const enriched = (rows || []).map(r => ({ ...r, userEmail: emailMap[r.user_id] || r.user_id }));
                return jsonResponse({ success: true, codes: enriched, total: enriched.length }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — GET EMAIL TEMPLATES
            // ============================================
            if (url.pathname === '/admin/email-templates' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const configTemplates = await fetchEmailTemplatesFromConfig();
                return jsonResponse({ success: true, templates: configTemplates || HARDCODED_EMAIL_TEMPLATES }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — SAVE EMAIL TEMPLATES
            // ============================================
            if (url.pathname === '/admin/email-templates' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json();
                const { templates } = body;
                if (!Array.isArray(templates) || templates.length === 0) {
                    return jsonResponse({ success: false, error: 'templates must be a non-empty array' }, 400, corsHeaders);
                }
                for (const t of templates) {
                    if (typeof t.email_index !== 'number' || !t.subject || !t.body_html) {
                        return jsonResponse({ success: false, error: 'Each template requires email_index (number), subject, and body_html' }, 400, corsHeaders);
                    }
                    if (typeof t.delay_days !== 'number' || t.delay_days < 0) {
                        return jsonResponse({ success: false, error: `Template ${t.email_index}: delay_days must be a non-negative number` }, 400, corsHeaders);
                    }
                }
                const sorted = [...templates].sort((a, b) => a.email_index - b.email_index);
                const res = await fetch(`${SUPABASE_URL}/rest/v1/config`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates',
                    },
                    body: JSON.stringify({ key: 'email_templates', value: sorted, updated_at: new Date().toISOString() }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Supabase update failed' }, 500, corsHeaders);
                }
                const adminEmailET = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'update_email_templates', targetType: 'config', targetId: 'email_templates',
                    targetLabel: 'Email Templates', details: { count: sorted.length }, adminEmail: adminEmailET,
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — GET EMAIL SETTINGS (sender identity)
            // ============================================
            if (url.pathname === '/admin/email-settings' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const res = await fetch(
                    `${SUPABASE_URL}/rest/v1/config?key=eq.email_settings&select=value`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const rows = await res.json();
                const settings = (res.ok && rows && rows.length > 0) ? rows[0].value : null;
                return jsonResponse({ success: true, settings }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — SAVE EMAIL SETTINGS (sender identity)
            // ============================================
            if (url.pathname === '/admin/email-settings' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json();
                const { from_name, from_email, reply_to } = body;
                if (!from_name || !from_email) {
                    return jsonResponse({ success: false, error: 'from_name and from_email are required' }, 400, corsHeaders);
                }
                const settings = {
                    from_name: from_name.trim(),
                    from_email: from_email.trim().toLowerCase(),
                    reply_to: (reply_to || '').trim(),
                };
                const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/config`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates',
                    },
                    body: JSON.stringify({ key: 'email_settings', value: settings, updated_at: new Date().toISOString() }),
                });
                if (!saveRes.ok) {
                    const err = await saveRes.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err.message || 'Save failed' }, 500, corsHeaders);
                }
                const adminEmailES = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'update_email_settings', targetType: 'config', targetId: 'email_settings',
                    targetLabel: 'Email Settings', details: { from_name, from_email }, adminEmail: adminEmailES,
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — GET EMAIL QUEUE STATS
            // ============================================
            if (url.pathname === '/admin/email-queue/stats' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const countHeaders = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact' };
                const onHoldCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
                const [pendingRes, sentRes, failedRes, unconfirmedRes, confirmedRes] = await Promise.all([
                    fetch(`${SUPABASE_URL}/rest/v1/email_queue?status=eq.pending&select=id&limit=0`, { headers: countHeaders }),
                    fetch(`${SUPABASE_URL}/rest/v1/email_queue?status=eq.sent&select=id&limit=0`, { headers: countHeaders }),
                    fetch(`${SUPABASE_URL}/rest/v1/email_queue?status=eq.failed&select=id&limit=0`, { headers: countHeaders }),
                    fetch(`${SUPABASE_URL}/rest/v1/email_queue?status=eq.sent&sent_at=lte.${onHoldCutoff}&select=id&limit=0`, { headers: countHeaders }),
                    fetch(`${SUPABASE_URL}/rest/v1/email_queue?status=eq.confirmed&select=id&limit=0`, { headers: countHeaders }),
                ]);
                const parseCount = (r) => {
                    const h = r.headers.get('content-range');
                    if (h) { const m = h.match(/\/(\d+)$/); if (m) return parseInt(m[1], 10); }
                    return 0;
                };
                const sentCount = parseCount(sentRes);
                const confirmedCount = parseCount(confirmedRes);
                return jsonResponse({
                    success: true,
                    stats: { pending: parseCount(pendingRes), sent: sentCount, confirmed: confirmedCount, delivered: sentCount + confirmedCount, failed: parseCount(failedRes), unconfirmed: parseCount(unconfirmedRes) },
                }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — RETRY FAILED EMAILS
            // ============================================
            if (url.pathname === '/admin/email-queue/retry' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const retryRes = await fetch(`${SUPABASE_URL}/rest/v1/email_queue?status=eq.failed`, {
                    method: 'PATCH',
                    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
                    body: JSON.stringify({ status: 'pending', scheduled_at: new Date().toISOString(), error_message: null }),
                });
                if (!retryRes.ok) {
                    return jsonResponse({ success: false, error: 'Failed to retry emails' }, 500, corsHeaders);
                }
                const adminEmailRetry = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'retry_failed_emails',
                    targetType: 'email_queue',
                    targetId: null,
                    targetLabel: 'Email Queue',
                    details: {},
                    adminEmail: adminEmailRetry,
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — CLEAR SENT + FAILED EMAILS
            // ============================================
            if (url.pathname === '/admin/email-queue/clear' && method === 'DELETE') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const clearRes = await fetch(`${SUPABASE_URL}/rest/v1/email_queue?status=in.(sent,confirmed,failed)`, {
                    method: 'DELETE',
                    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=minimal' },
                });
                if (!clearRes.ok) {
                    return jsonResponse({ success: false, error: 'Failed to clear queue' }, 500, corsHeaders);
                }
                const adminEmailClear = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'clear_email_queue',
                    targetType: 'email_queue',
                    targetId: null,
                    targetLabel: 'Email Queue',
                    details: {},
                    adminEmail: adminEmailClear,
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — MARK ALL SENT AS CONFIRMED (one-time historical migration)
            // ============================================
            if (url.pathname === '/admin/email-queue/confirm-all-sent' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const confirmRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/email_queue?status=eq.sent`,
                    {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation',
                        },
                        body: JSON.stringify({ status: 'confirmed' }),
                    }
                );
                if (!confirmRes.ok) {
                    const errBody = await confirmRes.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: errBody?.message || `Supabase error ${confirmRes.status}` }, 500, corsHeaders);
                }
                const confirmed = await confirmRes.json().catch(() => []);
                const count = Array.isArray(confirmed) ? confirmed.length : 0;
                const adminEmailConfirm = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'confirm_all_sent_emails',
                    targetType: 'email_queue',
                    targetId: null,
                    targetLabel: 'Email Queue',
                    details: { count },
                    adminEmail: adminEmailConfirm,
                });
                return jsonResponse({ success: true, count }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — REQUEUE UNCONFIRMED (ZAPIER "ON HOLD") EMAILS
            // ============================================
            if (url.pathname === '/admin/email-queue/requeue-unconfirmed' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json().catch(() => ({}));
                const hoursAgo = Math.max(1, Math.min(72, parseInt(body.hours_ago) || 4));
                const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
                const requeueRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/email_queue?status=eq.sent&sent_at=lte.${cutoff}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_SERVICE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation',
                        },
                        body: JSON.stringify({ status: 'pending', scheduled_at: new Date().toISOString(), sent_at: null, error_message: 'Re-queued: Zapier delivery unconfirmed' }),
                    }
                );
                if (!requeueRes.ok) {
                    return jsonResponse({ success: false, error: 'Failed to requeue emails' }, 500, corsHeaders);
                }
                const requeued = await requeueRes.json().catch(() => []);
                const count = Array.isArray(requeued) ? requeued.length : 0;
                const adminEmailRequeue = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'requeue_unconfirmed_emails',
                    targetType: 'email_queue',
                    targetId: null,
                    targetLabel: 'Email Queue',
                    details: { hours_ago: hoursAgo, count },
                    adminEmail: adminEmailRequeue,
                });
                return jsonResponse({ success: true, count }, 200, corsHeaders);
            }

            // ============================================
            // PUBLIC — EMAIL DELIVERY CONFIRMATION (Zapier Step 3 callback)
            // ============================================
            if (url.pathname === '/email/confirm' && method === 'POST') {
                const rowId = url.searchParams.get('id');
                if (!rowId) {
                    return jsonResponse({ success: false, error: 'Missing id' }, 400, corsHeaders);
                }
                await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${encodeURIComponent(rowId)}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal',
                    },
                    body: JSON.stringify({ status: 'confirmed' }),
                }).catch(() => {});
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — PREVIEW EMAIL TEMPLATE (renders full HTML; supports unsaved draft)
            // ============================================
            if (url.pathname === '/admin/email-preview' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json();
                const { email_index, name: previewName = 'Alex', template: rawTemplate } = body;
                let previewResult;
                if (rawTemplate && rawTemplate.body_html) {
                    const bodyHtml = rawTemplate.body_html.replace(/\{name\}/gi, previewName);
                    previewResult = { subject: rawTemplate.subject || '(no subject)', html: buildEmailHtml(rawTemplate.emoji || '', bodyHtml) };
                } else {
                    const configTemplates = await fetchEmailTemplatesFromConfig();
                    const allTemplates = configTemplates || HARDCODED_EMAIL_TEMPLATES;
                    const tpl = allTemplates.find(t => t.email_index === Number(email_index));
                    if (!tpl) {
                        return jsonResponse({ success: false, error: 'Template not found' }, 404, corsHeaders);
                    }
                    const bodyHtml = tpl.body_html.replace(/\{name\}/gi, previewName);
                    previewResult = { subject: tpl.subject, html: buildEmailHtml(tpl.emoji || '', bodyHtml) };
                }
                return jsonResponse({ success: true, html: previewResult.html, subject: previewResult.subject }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — SEND TEST EMAIL
            // ============================================
            if (url.pathname === '/admin/email-test' && method === 'POST') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const body = await request.json();
                const { email_index, to_email, template: rawTemplate } = body;
                if (!to_email) {
                    return jsonResponse({ success: false, error: 'to_email is required' }, 400, corsHeaders);
                }
                let testTemplate;
                if (rawTemplate && rawTemplate.body_html) {
                    const bodyHtml = rawTemplate.body_html.replace(/\{name\}/gi, 'Alex');
                    testTemplate = { subject: rawTemplate.subject || '(no subject)', html: buildEmailHtml(rawTemplate.emoji || '', bodyHtml) };
                } else {
                    if (!email_index) {
                        return jsonResponse({ success: false, error: 'email_index or template required' }, 400, corsHeaders);
                    }
                    const configTemplates = await fetchEmailTemplatesFromConfig();
                    const allTemplates = configTemplates || HARDCODED_EMAIL_TEMPLATES;
                    const tpl = allTemplates.find(t => t.email_index === Number(email_index));
                    if (!tpl) {
                        return jsonResponse({ success: false, error: 'Template not found' }, 404, corsHeaders);
                    }
                    const bodyHtml = tpl.body_html.replace(/\{name\}/gi, 'Alex');
                    testTemplate = { subject: tpl.subject, html: buildEmailHtml(tpl.emoji || '', bodyHtml) };
                }
                const emailSettingsForTest = await fetchEmailSettings();
                const testRes = await fetch(ZAPIER_EMAIL_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: to_email,
                        subject: `[TEST] ${testTemplate.subject}`,
                        html: testTemplate.html,
                        name: 'Alex',
                        from_name: emailSettingsForTest?.from_name || 'FlirtEasy',
                        from_email: emailSettingsForTest?.from_email || 'flirteasyio@gmail.com',
                        ...(emailSettingsForTest?.reply_to ? { reply_to: emailSettingsForTest.reply_to } : {}),
                    }),
                });
                if (!testRes.ok && testRes.status !== 200) {
                    const errText = await testRes.text().catch(() => `HTTP ${testRes.status}`);
                    return jsonResponse({ success: false, error: errText }, 500, corsHeaders);
                }
                const adminEmailTest = (request.headers.get('X-Admin-Email') || '').trim().toLowerCase();
                await insertAuditLog(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
                    action: 'send_test_email', targetType: 'email_template',
                    targetId: String(email_index || 'draft'), targetLabel: testTemplate.subject,
                    details: { to: to_email }, adminEmail: adminEmailTest,
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — GET EMAIL QUEUE ROWS (with status filter + pagination)
            // ============================================
            if (url.pathname === '/admin/email-queue/rows' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const qStatus = url.searchParams.get('status');
                const qLimit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
                const qOffset = parseInt(url.searchParams.get('offset') || '0', 10);
                const sbHeaders = { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` };
                const statusFilter = qStatus ? `&status=eq.${qStatus}` : '';
                const sbSelect = `${SUPABASE_URL}/rest/v1/email_queue?select=id,user_email,email_index,scheduled_at,sent_at,status,error_message,created_at&order=created_at.desc${statusFilter}`;

                // Step 1: first fetch — no explicit limit so Supabase returns up to its max_rows.
                // Also request count=exact so we know the true total from content-range.
                const firstRes = await fetch(sbSelect, { headers: { ...sbHeaders, 'Prefer': 'count=exact' } });
                if (!firstRes.ok) {
                    const err = await firstRes.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: err?.message || `Supabase error ${firstRes.status}` }, 500, corsHeaders);
                }
                const firstBatch = await firstRes.json();
                const cr = firstRes.headers.get('content-range');
                const total = cr ? (parseInt(cr.split('/')[1], 10) || firstBatch.length) : firstBatch.length;

                // Step 2: if first batch already has everything, slice and return.
                if (!Array.isArray(firstBatch) || firstBatch.length >= total) {
                    return jsonResponse({ success: true, rows: firstBatch.slice(qOffset, qOffset + qLimit), total, _v: 'v4-single', _fetched: firstBatch.length }, 200, corsHeaders);
                }

                // Step 3: Supabase capped the first batch (max_rows). Use the discovered cap
                // as the page size and fetch all remaining pages in parallel.
                const cap = firstBatch.length; // e.g. 16
                const extraCount = Math.ceil((total - cap) / cap);
                const extraBatches = await Promise.all(
                    Array.from({ length: extraCount }, (_, i) => {
                        const off = cap + i * cap;
                        return fetch(`${sbSelect}&limit=${cap}&offset=${off}`, { headers: sbHeaders })
                            .then(r => r.ok ? r.json() : [])
                            .catch(() => []);
                    })
                );
                const allRows = [...firstBatch, ...extraBatches.flat()];
                return jsonResponse({ success: true, rows: allRows.slice(qOffset, qOffset + qLimit), total, _v: 'v4-adaptive', _fetched: allRows.length }, 200, corsHeaders);
            }

            // ============================================
            // CRON: Process email queue (called by Cloudflare Cron Trigger or manually)
            // ============================================
            if (url.pathname === '/cron/process-emails' && (method === 'POST' || method === 'GET')) {
                const cronKey = request.headers.get('X-Cron-Secret') || url.searchParams.get('secret');
                if (cronKey !== ADMIN_SECRET) {
                    return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                }
                const result = await processEmailQueue();
                return jsonResponse({ success: true, ...result }, 200, corsHeaders);
            }

            // ============================================
            // USER — POST /api/track/event (single event, JWT auth)
            // ============================================
            if (url.pathname === '/api/track/event' && method === 'POST') {
                const authHeader = request.headers.get('Authorization') || '';
                const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
                if (!token) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                const jwtPayload = await verifyJWT(token);
                const trackUserId = jwtPayload?.id || jwtPayload?.userId;
                if (!trackUserId) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                const raw = await request.json().catch(() => null);
                if (!raw || !raw.event_type) return jsonResponse({ success: false, error: 'event_type required' }, 400, corsHeaders);
                const evt = sanitizeTrackingEvent(raw, trackUserId);
                if (!evt) return jsonResponse({ success: false, error: 'Invalid event' }, 400, corsHeaders);
                ctx.waitUntil(
                    (evt.event_type === 'console_log'
                        ? upsertUserSnapshot(trackUserId, [evt])
                        : insertUserEvents([evt]).then(() => upsertUserSnapshot(trackUserId, [evt]))
                    ).catch(() => {})
                );
                return jsonResponse({ success: true }, 202, corsHeaders);
            }

            // ============================================
            // USER — POST /api/track/batch (up to 100 events, JWT auth)
            // ============================================
            if (url.pathname === '/api/track/batch' && method === 'POST') {
                const authHeader = request.headers.get('Authorization') || '';
                const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
                if (!token) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                const jwtPayload = await verifyJWT(token);
                const batchUserId = jwtPayload?.id || jwtPayload?.userId;
                if (!batchUserId) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                const body = await request.json().catch(() => null);
                if (!body || !Array.isArray(body.events)) return jsonResponse({ success: false, error: 'events array required' }, 400, corsHeaders);
                if (body.events.length > 100) return jsonResponse({ success: false, error: 'Max 100 events per batch' }, 400, corsHeaders);
                const sanitized = body.events.map(e => sanitizeTrackingEvent(e, batchUserId)).filter(Boolean);
                const dbEvents = sanitized.filter(e => e.event_type !== 'console_log');
                let insertError = null;
                if (dbEvents.length > 0) {
                    try {
                        await insertUserEvents(dbEvents);
                    } catch (e) {
                        insertError = e?.message || 'insert failed';
                    }
                }
                ctx.waitUntil(upsertUserSnapshot(batchUserId, sanitized).catch(() => {}));
                return jsonResponse({
                    success: true,
                    accepted: sanitized.length,
                    dropped: body.events.length - sanitized.length,
                    ...(insertError ? { insert_error: insertError } : {})
                }, 202, corsHeaders);
            }

            // ============================================
            // ADMIN — GET /admin/tracking/users (paginated live user list)
            // ============================================
            if (url.pathname === '/admin/tracking/users' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
                const offset = parseInt(url.searchParams.get('offset') || '0', 10);
                const platform = url.searchParams.get('platform') || '';
                const active_only = url.searchParams.get('active_only') === 'true';
                const search = (url.searchParams.get('search') || '').trim().toLowerCase();
                let q = `${SUPABASE_URL}/rest/v1/user_snapshots?select=*,users(id,email,full_name,plan,subscription_status,created_at,is_banned)&order=last_seen_at.desc.nullslast&limit=${limit}&offset=${offset}`;
                if (platform) q += `&platform=eq.${encodeURIComponent(platform)}`;
                const activeThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                if (active_only) q += `&last_seen_at=gte.${encodeURIComponent(activeThreshold)}`;
                const res = await fetch(q, {
                    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact' }
                });
                if (!res.ok) {
                    const e = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: e.message || 'Failed to fetch users' }, 500, corsHeaders);
                }
                let users = await res.json();
                const cr = res.headers.get('content-range');
                let total = cr ? (parseInt(cr.split('/')[1], 10) || 0) : users.length;
                // annotate is_active
                users = users.map(u => ({ ...u, is_active: u.last_seen_at ? new Date(u.last_seen_at) >= new Date(activeThreshold) : false }));
                // search filter (JS-side since PostgREST can't easily join-filter)
                if (search) {
                    users = users.filter(u => {
                        const em = (u.users?.email || '').toLowerCase();
                        const nm = (u.users?.full_name || '').toLowerCase();
                        return em.includes(search) || nm.includes(search);
                    });
                    total = users.length;
                }
                return jsonResponse({ success: true, users, total }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — GET /admin/tracking/users/:userId/events
            // ============================================
            if (/^\/admin\/tracking\/users\/[^/]+\/events$/.test(url.pathname) && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                const userId = url.pathname.split('/')[4];
                const isConsoleLogs = url.searchParams.get('event_type') === 'console_log';
                const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), isConsoleLogs ? 2000 : 200);
                const offset = parseInt(url.searchParams.get('offset') || '0', 10);
                const event_type = url.searchParams.get('event_type') || '';
                const from_date = url.searchParams.get('from_date') || '';

                // console_log events served from agent_state.log_sessions (or legacy recent_logs)
                if (event_type === 'console_log') {
                    const snapRes = await fetch(
                        `${SUPABASE_URL}/rest/v1/user_snapshots?user_id=eq.${encodeURIComponent(userId)}&select=agent_state`,
                        { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                    );
                    const snapRows = snapRes.ok ? await snapRes.json() : [];
                    const agentState = snapRows?.[0]?.agent_state || {};
                    const logSessions = agentState.log_sessions || [];
                    const legacyLogs = agentState.recent_logs || [];

                    // Build sessions response (newest session last in storage → reverse for display newest first)
                    const sessions = [...logSessions].reverse().map(s => ({
                        idx: s.idx,
                        started_at: s.started_at,
                        log_count: s.logs.length,
                        logs: from_date ? s.logs.filter(l => l.ts >= from_date) : s.logs
                    }));

                    // Legacy flat logs (users who ran before session grouping)
                    let legacyFiltered = from_date ? legacyLogs.filter(l => l.ts >= from_date) : legacyLogs;
                    const legacyEvents = legacyFiltered.map((l, i) => ({
                        id: `legacy_${i}`,
                        user_id: userId,
                        event_type: 'console_log',
                        platform: null,
                        payload: { level: l.lvl, message: l.msg, extra: l.extra ?? null },
                        created_at: l.ts
                    }));

                    const total = sessions.reduce((sum, s) => sum + s.log_count, 0) + legacyFiltered.length;
                    return jsonResponse({ success: true, events: legacyEvents, total, sessions }, 200, corsHeaders);
                }

                let q = `${SUPABASE_URL}/rest/v1/user_events?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=${limit}&offset=${offset}`;
                if (event_type) q += `&event_type=eq.${encodeURIComponent(event_type)}`;
                if (from_date) q += `&created_at=gte.${encodeURIComponent(from_date)}`;
                const res = await fetch(q, {
                    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact' }
                });
                if (!res.ok) {
                    const e = await res.json().catch(() => ({}));
                    return jsonResponse({ success: false, error: e.message || 'Failed to fetch events' }, 500, corsHeaders);
                }
                const events = await res.json();
                const cr = res.headers.get('content-range');
                const total = cr ? (parseInt(cr.split('/')[1], 10) || 0) : events.length;
                return jsonResponse({ success: true, events, total }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — DELETE /admin/tracking/users/:userId/console-logs
            // ============================================
            if (/^\/admin\/tracking\/users\/[^/]+\/console-logs$/.test(url.pathname) && method === 'DELETE') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                const userId = url.pathname.split('/')[4];
                const snapRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/user_snapshots?user_id=eq.${encodeURIComponent(userId)}&select=agent_state`,
                    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                );
                const snapRows = snapRes.ok ? await snapRes.json() : [];
                const existing = snapRows?.[0] || {};
                const agent_state = { ...(existing.agent_state || {}), recent_logs: [], log_sessions: [] };
                await fetch(`${SUPABASE_URL}/rest/v1/user_snapshots?user_id=eq.${encodeURIComponent(userId)}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ agent_state })
                });
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — GET /admin/tracking/aggregates
            // ============================================
            if (url.pathname === '/admin/tracking/aggregates' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                const activeThresholdAgg = new Date(Date.now() - 5 * 60 * 1000).toISOString();
                const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
                const todayISO = todayStart.toISOString();
                const [snapshotRes, cycleEventsRes] = await Promise.all([
                    fetch(`${SUPABASE_URL}/rest/v1/user_snapshots?select=user_id,platform,last_seen_at,stats`, {
                        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                    }),
                    fetch(`${SUPABASE_URL}/rest/v1/user_events?event_type=eq.cycle_end&created_at=gte.${encodeURIComponent(todayISO)}&select=user_id,platform,payload`, {
                        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                    })
                ]);
                const snapshots = snapshotRes.ok ? await snapshotRes.json() : [];
                const cycleEvents = cycleEventsRes.ok ? await cycleEventsRes.json() : [];
                let messages_today = 0, likes_today = 0, follow_ups_today = 0;
                let errors_today = 0, ai_calls_today = 0;
                let messages_all_time = 0, likes_all_time = 0;
                const platform_counts = {};
                let active_now = 0;
                const activeThresholdAggDate = new Date(activeThresholdAgg);
                for (const s of snapshots) {
                    if (s.last_seen_at && new Date(s.last_seen_at) >= activeThresholdAggDate) active_now++;
                    const p = s.platform || 'unknown';
                    platform_counts[p] = (platform_counts[p] || 0) + 1;
                    const st = s.stats || {};
                    messages_all_time += st.messages_total || 0;
                    likes_all_time += st.likes_total || 0;
                    messages_today += st.messages_today || 0;
                    likes_today += st.likes_today || 0;
                    follow_ups_today += st.follow_ups_today || 0;
                    errors_today += st.errors_today || 0;
                    ai_calls_today += st.ai_calls_today || 0;
                }
                const cycles_today = cycleEvents.length;
                return jsonResponse({
                    success: true,
                    aggregates: {
                        total_users: snapshots.length, active_now, cycles_today,
                        messages_today, likes_today, follow_ups_today, ai_calls_today, errors_today,
                        messages_all_time, likes_all_time, platform_counts,
                        computed_at: new Date().toISOString()
                    }
                }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — GET /admin/tracking/handoffs
            // ============================================
            if (url.pathname === '/admin/tracking/handoffs' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);

                const fromDate       = url.searchParams.get('from_date') || null;
                const platformFilter = url.searchParams.get('platform') || null;
                const recentLimit    = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
                const recentOffset   = parseInt(url.searchParams.get('offset') || '0', 10);

                const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
                const todayISO   = todayStart.toISOString();

                const supaHeaders = {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                };

                // Build filter fragments
                const baseWhere  = `event_type=eq.handoff${fromDate ? `&created_at=gte.${encodeURIComponent(fromDate)}` : ''}${platformFilter ? `&platform=eq.${encodeURIComponent(platformFilter)}` : ''}`;
                const todayWhere = `event_type=eq.handoff&created_at=gte.${encodeURIComponent(todayISO)}${platformFilter ? `&platform=eq.${encodeURIComponent(platformFilter)}` : ''}`;

                // Run all queries in parallel
                const [totalRes, todayRes, byTypeRes, byPlatformRes, recentRes, topUsersRes] = await Promise.all([
                    // Total count — use HEAD with Prefer:count=exact
                    fetch(`${SUPABASE_URL}/rest/v1/user_events?${baseWhere}&select=id`, {
                        headers: { ...supaHeaders, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' }
                    }),
                    // Today count
                    fetch(`${SUPABASE_URL}/rest/v1/user_events?${todayWhere}&select=id`, {
                        headers: { ...supaHeaders, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' }
                    }),
                    // By type — aggregate in DB using group-by via payload->>'handoff_type'
                    fetch(`${SUPABASE_URL}/rest/v1/rpc/get_handoff_type_counts`, {
                        method: 'POST',
                        headers: { ...supaHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ from_date: fromDate, platform_filter: platformFilter })
                    }),
                    // By platform
                    fetch(`${SUPABASE_URL}/rest/v1/rpc/get_handoff_platform_counts`, {
                        method: 'POST',
                        headers: { ...supaHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ from_date: fromDate, platform_filter: platformFilter })
                    }),
                    // Recent feed — paginated
                    fetch(`${SUPABASE_URL}/rest/v1/user_events?${baseWhere}&select=id,user_id,platform,payload,created_at&order=created_at.desc&limit=${recentLimit}&offset=${recentOffset}`, { headers: supaHeaders }),
                    // Top users — group by user_id with count, join users for email
                    fetch(`${SUPABASE_URL}/rest/v1/rpc/get_handoff_top_users`, {
                        method: 'POST',
                        headers: { ...supaHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ from_date: fromDate, platform_filter: platformFilter, top_n: 20 })
                    }),
                ]);

                // Extract counts from Content-Range header (Supabase count=exact pattern)
                function extractCount(res) {
                    const cr = res.headers.get('Content-Range') || '';
                    const m  = cr.match(/\/(\d+)$/);
                    return m ? parseInt(m[1], 10) : 0;
                }

                const total = extractCount(totalRes);
                const today = extractCount(todayRes);

                // By type — fallback to JS aggregation if RPC not available
                let by_type     = {};
                let by_platform = {};
                let top_users   = [];

                if (byTypeRes.ok) {
                    const rows = await byTypeRes.json().catch(() => []);
                    if (Array.isArray(rows)) rows.forEach(r => { by_type[r.handoff_type || 'other'] = r.count; });
                } 
                if (byPlatformRes.ok) {
                    const rows = await byPlatformRes.json().catch(() => []);
                    if (Array.isArray(rows)) rows.forEach(r => { by_platform[r.platform || 'unknown'] = r.count; });
                }
                if (topUsersRes.ok) {
                    const rows = await topUsersRes.json().catch(() => []);
                    if (Array.isArray(rows)) top_users = rows.map(r => ({ user_id: r.user_id, user_email: r.email || null, count: r.count }));
                }

                // Fallback: if RPCs don't exist yet, aggregate from recent events only (graceful degradation)
                if (Object.keys(by_type).length === 0 && Object.keys(by_platform).length === 0) {
                    const fallbackRes = await fetch(`${SUPABASE_URL}/rest/v1/user_events?${baseWhere}&select=id,user_id,platform,payload&limit=2000`, { headers: supaHeaders });
                    const fallbackEvents = fallbackRes.ok ? await fallbackRes.json().catch(() => []) : [];
                    const userCounts = {};
                    for (const ev of fallbackEvents) {
                        const ht = ev.payload?.handoff_type || 'other';
                        const pl = ev.platform || 'unknown';
                        by_type[ht]     = (by_type[ht]     || 0) + 1;
                        by_platform[pl] = (by_platform[pl] || 0) + 1;
                        if (ev.user_id) userCounts[ev.user_id] = (userCounts[ev.user_id] || 0) + 1;
                    }
                    if (top_users.length === 0) {
                        const sortedUsers = Object.entries(userCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
                        if (sortedUsers.length > 0) {
                            const ids = sortedUsers.map(([id]) => id);
                            const uRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,email`, { headers: supaHeaders });
                            const uData = uRes.ok ? await uRes.json().catch(() => []) : [];
                            const emailMap = Object.fromEntries(uData.map(u => [u.id, u.email || null]));
                            top_users = sortedUsers.map(([uid, count]) => ({ user_id: uid, user_email: emailMap[uid] || null, count }));
                        }
                    }
                }

                // Recent feed — fetch emails for display
                const recentEvents = recentRes.ok ? await recentRes.json().catch(() => []) : [];
                let recent = [];
                if (recentEvents.length > 0) {
                    const uIds = [...new Set(recentEvents.map(e => e.user_id).filter(Boolean))];
                    let emailMap = {};
                    if (uIds.length > 0) {
                        const uRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=in.(${uIds.map(encodeURIComponent).join(',')})&select=id,email`, { headers: supaHeaders });
                        const uData = uRes.ok ? await uRes.json().catch(() => []) : [];
                        emailMap = Object.fromEntries(uData.map(u => [u.id, u.email || null]));
                    }
                    recent = recentEvents.map(ev => ({
                        id:           ev.id,
                        user_id:      ev.user_id || null,
                        user_email:   ev.user_id ? (emailMap[ev.user_id] || null) : null,
                        handoff_type: ev.payload?.handoff_type || 'other',
                        platform:     ev.platform || null,
                        match_name:   ev.payload?.match_name || null,
                        created_at:   ev.created_at,
                    }));
                }

                return jsonResponse({
                    success: true,
                    stats: { total, today, by_type, by_platform, recent, top_users }
                }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — DELETE /admin/tracking/handoffs/:id (delete single handoff event)
            // ============================================
            if (url.pathname.startsWith('/admin/tracking/handoffs/') && method === 'DELETE') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                const eventId = url.pathname.split('/').pop();
                if (!eventId || isNaN(Number(eventId))) return jsonResponse({ success: false, error: 'Invalid event id' }, 400, corsHeaders);
                const res = await fetch(`${SUPABASE_URL}/rest/v1/user_events?id=eq.${encodeURIComponent(eventId)}`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Prefer': 'return=minimal',
                    },
                });
                if (!res.ok) {
                    const errText = await res.text().catch(() => '');
                    return jsonResponse({ success: false, error: `Supabase error ${res.status}: ${errText}` }, 500, corsHeaders);
                }
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — DELETE /admin/tracking/handoffs (clear all handoff events)
            // ============================================
            if (url.pathname === '/admin/tracking/handoffs' && method === 'DELETE') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                const res = await fetch(`${SUPABASE_URL}/rest/v1/user_events?event_type=eq.handoff`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Prefer': 'return=minimal',
                    },
                });
                if (!res.ok) {
                    const errText = await res.text().catch(() => '');
                    return jsonResponse({ success: false, error: `Supabase error ${res.status}: ${errText}` }, 500, corsHeaders);
                }
                return jsonResponse({ success: true }, 200, corsHeaders);
            }

            // ============================================
            // ADMIN — GET /admin/tracking/debug (pipeline health check)
            // ============================================
            if (url.pathname === '/admin/tracking/debug' && method === 'GET') {
                const adminKey = request.headers.get('X-Admin-Secret');
                if (adminKey !== ADMIN_SECRET) return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
                const results = {};
                try {
                    const evRes = await fetch(`${SUPABASE_URL}/rest/v1/user_events?select=id&limit=1`, {
                        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                    });
                    results.user_events_table = evRes.ok ? 'ok' : `error ${evRes.status}: ${await evRes.text()}`;
                } catch (e) { results.user_events_table = `exception: ${e.message}`; }
                try {
                    const snRes = await fetch(`${SUPABASE_URL}/rest/v1/user_snapshots?select=user_id&limit=1`, {
                        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
                    });
                    results.user_snapshots_table = snRes.ok ? 'ok' : `error ${snRes.status}: ${await snRes.text()}`;
                } catch (e) { results.user_snapshots_table = `exception: ${e.message}`; }
                try {
                    const evCount = await fetch(`${SUPABASE_URL}/rest/v1/user_events?select=count`, {
                        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' }
                    });
                    results.user_events_count = evCount.headers.get('content-range') || 'unknown';
                } catch (e) { results.user_events_count = `exception: ${e.message}`; }
                try {
                    const snCount = await fetch(`${SUPABASE_URL}/rest/v1/user_snapshots?select=count`, {
                        headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' }
                    });
                    results.user_snapshots_count = snCount.headers.get('content-range') || 'unknown';
                } catch (e) { results.user_snapshots_count = `exception: ${e.message}`; }
                return jsonResponse({ success: true, diagnostics: results }, 200, corsHeaders);
            }

            // Default / Status Check
            return jsonResponse({
                status: 'Active', version: '1.7', endpoints: [
                    '/auth/signup', '/auth/login', '/auth/verify',
                    '/user/status', '/user/upgrade', '/webhook/stripe',
                    '/api/ai/chat', '/api/usage/increment',
                    '/api/config/prompts', '/api/config/rate-limits',
                    '/api/errors/report',
                    '/community/register', '/community/claim', '/community/revoke', '/community/delete-code',
                    '/cron/process-emails',
                    '/admin/verify', '/admin/prompts', '/admin/users', '/admin/rate-limits', '/admin/ai-settings',
                    '/admin/error-logs', '/admin/community-codes',
                    '/admin/email-templates', '/admin/email-queue/stats', '/admin/email-queue/retry', '/admin/email-queue/clear',
                    '/admin/email-queue/requeue-unconfirmed', '/email/confirm'
                ]
            }, 200, corsHeaders);

        } catch (err) {
            console.error('Worker Error:', err);
            return jsonResponse({ success: false, error: err.message }, 500, corsHeaders);
        }
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function insertAuditLog(supabaseUrl, supabaseKey, { action, targetType, targetId, targetLabel, details, adminEmail }) {
    try {
        await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                action,
                target_type: targetType || null,
                target_id: targetId || null,
                target_label: targetLabel || null,
                details: details || null,
                admin_email: adminEmail || null
            })
        });
    } catch (_) {}
}

function jsonResponse(data, status, headers) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json' }
    });
}

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

// Count how many content words (length >= minLen) from original are absent in rewrite.
// Catches semantic meaning changes that Levenshtein misses (e.g. replacing a noun with
// a different-meaning noun of similar length).
function contentWordsMissing(original, rewritten, minLen = 4) {
    const tokenize = str =>
        str.split(/\s+/)
           .map(w => w.replace(/[^\p{L}\p{N}]/gu, ''))
           .filter(w => w.length >= minLen);
    const origWords = new Set(tokenize(original));
    const rewriteWords = new Set(tokenize(rewritten));
    let missing = 0;
    for (const word of origWords) {
        if (!rewriteWords.has(word)) missing++;
    }
    return missing;
}

// ============================================
// USER TRACKING HELPERS
// ============================================

const VALID_TRACK_EVENT_TYPES = new Set([
    'agent_start', 'agent_stop', 'cycle_start', 'cycle_end',
    'message_sent', 'like_sent', 'follow_up_sent', 'rate_limit_hit',
    'error', 'ai_call', 'claude_rewrite', 'settings_change',
    'session_start', 'session_end', 'stop_condition_triggered', 'console_log',
    'handoff'
]);

function sanitizeTrackingEvent(raw, userId) {
    if (!raw || typeof raw !== 'object') return null;
    const event_type = (raw.event_type || '').toLowerCase().trim();
    if (!VALID_TRACK_EVENT_TYPES.has(event_type)) return null;
    const platform = raw.platform ? String(raw.platform).toLowerCase() : null;
    if (platform && platform !== 'tinder' && platform !== 'bumble') return null;
    let payload = {};
    if (raw.payload && typeof raw.payload === 'object') {
        try {
            const str = JSON.stringify(raw.payload);
            if (str.length <= 4096) {
                payload = raw.payload;
            } else {
                const truncated = {};
                for (const [k, v] of Object.entries(raw.payload)) {
                    if (typeof v === 'string') truncated[k] = v.length > 300 ? v.slice(0, 300) + '…' : v;
                    else if (typeof v === 'number' || typeof v === 'boolean') truncated[k] = v;
                    else truncated[k] = '[truncated]';
                }
                truncated._truncated = true;
                payload = truncated;
            }
        } catch (_) {}
    }
    return {
        user_id: userId,
        event_type,
        platform: platform || null,
        payload,
        client_ts: raw.client_ts || new Date().toISOString()
    };
}

async function insertUserEvents(events) {
    if (!events || events.length === 0) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_events`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal,resolution=ignore-duplicates'
        },
        body: JSON.stringify(events)
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[insertUserEvents] Supabase error:', res.status, errText);
    }
}

async function upsertUserSnapshot(userId, events) {
    if (!userId || !events || events.length === 0) return;
    const getRes = await fetch(
        `${SUPABASE_URL}/rest/v1/user_snapshots?user_id=eq.${encodeURIComponent(userId)}`,
        { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const rows = getRes.ok ? await getRes.json() : [];
    const existing = (rows && rows.length > 0) ? rows[0] : {};
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const stats = { ...(existing.stats || {}) };
    if (stats.stats_date !== todayStr) {
        stats.messages_today = 0; stats.likes_today = 0; stats.follow_ups_today = 0;
        stats.errors_today = 0; stats.ai_calls_today = 0; stats.stats_date = todayStr;
    }
    const agent_state = { ...(existing.agent_state || {}) };
    let last_seen_at = existing.last_seen_at || now.toISOString();
    let platform = existing.platform || null;
    let settings = existing.settings || null;
    for (const e of events) {
        if (e.platform) platform = e.platform;
        last_seen_at = now.toISOString();
        const p = e.payload || {};
        switch (e.event_type) {
            case 'agent_start': {
                agent_state.is_running = true;
                agent_state.agent_started_at = now.toISOString();
                agent_state.session_started_at = now.toISOString();
                if (p.locale) agent_state.locale = p.locale;
                if (p.timezone) agent_state.timezone = p.timezone;
                if (p.plugin_version) agent_state.plugin_version = p.plugin_version;
                const sessions = agent_state.log_sessions || [];
                const nextIdx = sessions.length > 0 ? sessions[sessions.length - 1].idx + 1 : 1;
                sessions.push({ idx: nextIdx, started_at: now.toISOString(), logs: [] });
                if (sessions.length > 10) sessions.shift();
                agent_state.log_sessions = sessions;
                break;
            }
            case 'agent_stop':
                agent_state.is_running = false;
                agent_state.agent_stopped_at = now.toISOString();
                break;
            case 'cycle_start':
                agent_state.last_cycle_start = now.toISOString();
                stats.cycles_total = (stats.cycles_total || 0) + 1;
                break;
            case 'cycle_end':
                agent_state.last_cycle_end = now.toISOString();
                if (p.duration_ms) agent_state.last_cycle_duration_ms = p.duration_ms;
                if (p.messages_sent != null) stats.messages_last_cycle = p.messages_sent;
                if (p.likes_sent != null) stats.likes_last_cycle = p.likes_sent;
                break;
            case 'message_sent':
                stats.messages_today = (stats.messages_today || 0) + (p.count || 1);
                stats.messages_total = (stats.messages_total || 0) + (p.count || 1);
                if (p.style) stats.last_style = p.style;
                if (p.language) stats.last_language = p.language;
                break;
            case 'like_sent':
                stats.likes_today = (stats.likes_today || 0) + (p.count || 1);
                stats.likes_total = (stats.likes_total || 0) + (p.count || 1);
                break;
            case 'follow_up_sent':
                stats.follow_ups_today = (stats.follow_ups_today || 0) + (p.count || 1);
                stats.follow_ups_total = (stats.follow_ups_total || 0) + (p.count || 1);
                break;
            case 'rate_limit_hit':
                stats.rate_limit_hits_total = (stats.rate_limit_hits_total || 0) + 1;
                break;
            case 'error':
                stats.errors_today = (stats.errors_today || 0) + 1;
                stats.errors_total = (stats.errors_total || 0) + 1;
                if (p.message) stats.last_error = String(p.message).slice(0, 200);
                break;
            case 'ai_call':
                stats.ai_calls_today = (stats.ai_calls_today || 0) + 1;
                stats.ai_calls_total = (stats.ai_calls_total || 0) + 1;
                if (p.model) stats.last_ai_model = p.model;
                if (p.latency_ms) stats.last_ai_latency_ms = p.latency_ms;
                break;
            case 'claude_rewrite':
                stats.rewrites_total = (stats.rewrites_total || 0) + 1;
                if (p.changed) stats.rewrites_changed = (stats.rewrites_changed || 0) + 1;
                break;
            case 'console_log': {
                const entry = {
                    ts: now.toISOString(),
                    lvl: p.level || 'INFO',
                    msg: (p.message || '').slice(0, 300),
                    extra: p.extra ? String(p.extra).slice(0, 200) : null
                };
                const logSessions = agent_state.log_sessions;
                if (logSessions && logSessions.length > 0) {
                    const cur = logSessions[logSessions.length - 1];
                    cur.logs.unshift(entry);
                    if (cur.logs.length > 500) cur.logs.length = 500;
                } else {
                    const logs = agent_state.recent_logs || [];
                    logs.unshift(entry);
                    if (logs.length > 2000) logs.length = 2000;
                    agent_state.recent_logs = logs;
                }
                if ((p.level === 'ERROR' || !p.level) && p.message) {
                    stats.last_error = String(p.message).slice(0, 200);
                }
                break;
            }
            case 'settings_change': {
                const ALLOWED_SETTINGS_KEYS = new Set([
                    'safeMode','likesPerCycle','messagesPerCycle','scheduleInterval',
                    'intentions','chattingStyle','aiModel','useEmojis','emojiProbability',
                    'ageFilter','activeHours','blockMessages','platform',
                    'minReplyPercent','maxNewMatchPercent','enable6ModeSystem',
                    'randomHearts','stopConditions',
                    'nativeCountry','nativeCity','nativeLanguages',
                    'whatsappNumber',
                    'contactDetails',
                    'moveOffAppPushAllMatches',
                    'moveOffAppMinMessages',
                    'moveOffAppMaxPersuasion',
                    'userGenderOverride',
                    'updated_at'
                ]);
                const sanitized = {};
                for (const [k, v] of Object.entries(p)) {
                    if (!ALLOWED_SETTINGS_KEYS.has(k)) continue;
                    // Server-side E.164 validation for whatsappNumber
                    // Format: + followed by 7–15 digits (ITU-T E.164 standard)
                    if (k === 'whatsappNumber') {
                        if (typeof v !== 'string') continue;
                        const trimmed = v.trim();
                        if (trimmed === '') { sanitized[k] = ''; continue; } // allow clearing
                        if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) continue;  // reject invalid
                        sanitized[k] = trimmed;
                        continue;
                    }
                    // Server-side sanitization for contactDetails:
                    // Must be an object with known field keys, each having { value: string, enabled: boolean }.
                    // Strip any unknown fields and enforce value types to prevent injection.
                    if (k === 'contactDetails') {
                        if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
                        const ALLOWED_CONTACT_FIELDS = new Set(['instagram','whatsapp','phone','telegram','snapchat']);
                        const cleanedCd = {};
                        for (const [field, entry] of Object.entries(v)) {
                            if (!ALLOWED_CONTACT_FIELDS.has(field)) continue;
                            if (!entry || typeof entry !== 'object') continue;
                            const val = typeof entry.value === 'string' ? entry.value.trim().slice(0, 100) : '';
                            const enabled = entry.enabled === true;
                            cleanedCd[field] = { value: val, enabled };
                        }
                        sanitized[k] = cleanedCd;
                        continue;
                    }
                    sanitized[k] = v;
                }
                if (Object.keys(sanitized).length > 0) {
                    settings = { ...(settings || {}), ...sanitized, updated_at: now.toISOString() };
                }
                break;
            }
        }
    }
    const snapshot = {
        user_id: userId,
        platform,
        last_seen_at,
        is_active: true,
        stats,
        agent_state,
        settings,
        updated_at: now.toISOString()
    };
    await fetch(`${SUPABASE_URL}/rest/v1/user_snapshots`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(snapshot)
    });

    // If whatsappNumber was included in this batch, also write it directly
    // to the users table as a dedicated column for easy querying in admin panel
    if (settings && settings.whatsappNumber && /^\+[1-9]\d{6,14}$/.test(settings.whatsappNumber)) {
        await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ whatsapp_number: settings.whatsappNumber })
        }).catch(() => {}); // fire-and-forget, don't block tracking response
    }
}

// Supabase Query Helper
async function supabaseQuery(table, field, value) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${field}=eq.${encodeURIComponent(value)}`,
        {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );
    return response.json();
}

// Supabase Insert Helper
async function supabaseInsert(table, data) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}`,
        {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result[0] || null;
}

// Supabase Insert with Error Details
async function supabaseInsertWithError(table, data) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}`,
        {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        }
    );

    const result = await response.json();

    if (!response.ok) {
        return { error: result.message || result.error || JSON.stringify(result) };
    }

    return { data: result[0] || result };
}

// Supabase Update Helper
async function updateTokenStats(service, inputTokens, outputTokens, model) {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/config?key=eq.humanizer_token_stats&select=value`,
            { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );
        const rows = await res.json();
        const current = (res.ok && rows && rows.length > 0) ? rows[0].value : {};
        const svc = current[service] || { input_tokens: 0, output_tokens: 0, requests: 0 };
        const svcUpdate = {
            input_tokens: (svc.input_tokens || 0) + (inputTokens || 0),
            output_tokens: (svc.output_tokens || 0) + (outputTokens || 0),
            requests: (svc.requests || 0) + 1,
        };
        if (model) svcUpdate.last_model = model;
        const updated = {
            ...current,
            [service]: svcUpdate,
            updated_at: new Date().toISOString(),
        };
        await fetch(`${SUPABASE_URL}/rest/v1/config`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates',
            },
            body: JSON.stringify({ key: 'humanizer_token_stats', value: updated, updated_at: updated.updated_at }),
        });
    } catch (_) {}
}

async function supabaseUpdate(table, id, data) {
    const response = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`,
        {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }
    );
    return response.ok;
}

// ============================================
// PASSWORD HASHING (SHA-256 with salt)
// ============================================
async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    const encoder = new TextEncoder();
    const data = encoder.encode(saltHex + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');

    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return hashHex === hash;
}

// ============================================
// JWT HELPERS (Web Crypto API)
// ============================================
async function createRefreshToken(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
    const encodedPayload = btoa(JSON.stringify({
        ...payload,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (180 * 24 * 60 * 60) // 180 days
    })).replace(/=/g, '');
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = await sign(data, JWT_SECRET);
    return `${data}.${signature}`;
}

async function createJWT(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
    const encodedPayload = btoa(JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days
    })).replace(/=/g, '');

    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = await sign(data, JWT_SECRET);

    return `${data}.${signature}`;
}

async function verifyJWT(token) {
    try {
        const [header, payload, signature] = token.split('.');
        if (!header || !payload || !signature) return null;

        const data = `${header}.${payload}`;
        const validSignature = await sign(data, JWT_SECRET);

        if (signature !== validSignature) return null;

        const decodedPayload = JSON.parse(atob(payload));
        if (decodedPayload.exp < Math.floor(Date.now() / 1000)) return null;

        return decodedPayload;
    } catch {
        return null;
    }
}

async function sign(data, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(data)
    );

    return btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * PRODUCTION SECURE: Verifies HMAC-SHA256 Stripe Signatures
 * without needing the massive stripe-node library.
 */
async function verifyStripeSignature(body, signatureHeader, secret) {
    try {
        const parts = signatureHeader.split(',');
        const t = parts.find(p => p.startsWith('t=')).split('=')[1];
        const v1 = parts.find(p => p.startsWith('v1=')).split('=')[1];

        // 1. Recreate the payload Stripe signed
        const encoder = new TextEncoder();
        const payload = encoder.encode(`${t}.${body}`);

        // 2. Import your webhook secret as a cryptographic key
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        // 3. Sign the payload yourself
        const signed = await crypto.subtle.sign('HMAC', key, payload);

        // 4. Convert to Hex to match Stripe's v1 format
        const hex = Array.from(new Uint8Array(signed))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        // 5. Compare signatures and check timestamp window (5 min) to prevent replay attacks
        const timestamp = parseInt(t, 10);
        const now = Math.floor(Date.now() / 1000);
        const isExpired = Math.abs(now - timestamp) > 300; // 5 minutes

        return hex === v1 && !isExpired;
    } catch (err) {
        console.error('Signature Verification Error:', err);
        return false;
    }
}

// ============================================
// EMAIL TEMPLATES
// ============================================

const EMAIL_P = (text) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#1e293b;">${text}</p>`;

const HARDCODED_EMAIL_TEMPLATES = [
    {
        email_index: 1,
        subject: "You're In — Welcome to FlirtEasy",
        emoji: '💘',
        body_html: [
            EMAIL_P('Hey {name},'),
            EMAIL_P('Your FlirtEasy account is ready.'),
            EMAIL_P('Connect your account, set your goal, and let it run.'),
            EMAIL_P("Need help? Just reply to this email — we're here."),
            EMAIL_P('Or join our community below for tips, support, and updates.'),
        ].join(''),
        delay_days: 0,
        enabled: true,
    },
    {
        email_index: 2,
        subject: 'Quick Tip: Why Most People Fail on Dating Apps',
        emoji: '⚡',
        body_html: [
            EMAIL_P('Hey {name},'),
            EMAIL_P("Most people don't get results on dating apps for one reason:"),
            EMAIL_P('<strong>Overthinking replies + responding too slow.</strong>'),
            EMAIL_P('FlirtEasy handles both — automatically, in real time.'),
            EMAIL_P("Not seeing results yet? Reply to this email and tell us what's happening. We'll help."),
            EMAIL_P('Or drop into the community below.'),
        ].join(''),
        delay_days: 1,
        enabled: true,
    },
    {
        email_index: 3,
        subject: "Don't Let Your Matches Go Cold",
        emoji: '🔥',
        body_html: [
            EMAIL_P('Hey {name},'),
            EMAIL_P("Matches go cold fast. Every day you don't follow up is a missed opportunity."),
            EMAIL_P('FlirtEasy keeps every conversation moving — automatically, while you get on with your day.'),
            EMAIL_P('Stuck or need help getting set up? Reply here or jump into the community below.'),
        ].join(''),
        delay_days: 2,
        enabled: true,
    },
];

function buildEmailHtml(emoji, bodyHtml) {
    const waLink = WHATSAPP_COMMUNITY_LINK;
    const siteLink = 'https://www.flirteasy.io';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <style>
    @media only screen and (max-width: 600px) {
      .email-card { border-radius: 0 !important; margin: 0 !important; }
      .email-body { padding: 28px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);">
          <tr>
            <td style="background:linear-gradient(135deg,#a855f7,#ec4899);padding:32px;text-align:center;">
              <div style="font-size:32px;margin-bottom:10px;">${emoji}</div>
              <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">FlirtEasy</span>
            </td>
          </tr>
          <tr>
            <td class="email-body" style="padding:36px 40px;">${bodyHtml}</td>
          </tr>
          <tr>
            <td style="padding:0 40px 36px;text-align:center;">
              <a href="${waLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#a855f7,#ec4899);color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.2px;">Join the Community</a>
            </td>
          </tr>
          <tr>
            <td style="background:#fafafa;padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0;">
              <p style="margin:0 0 4px;font-size:13px;color:#64748b;">The FlirtEasy team</p>
              <a href="${siteLink}" style="font-size:12px;color:#a855f7;text-decoration:none;">${siteLink}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function fetchEmailTemplatesFromConfig() {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/config?key=eq.email_templates&select=value`,
            { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );
        if (!res.ok) return null;
        const rows = await res.json();
        if (!rows || rows.length === 0 || !Array.isArray(rows[0].value) || rows[0].value.length === 0) return null;
        return rows[0].value;
    } catch {
        return null;
    }
}

async function fetchEmailSettings() {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/config?key=eq.email_settings&select=value`,
            { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );
        if (!res.ok) return null;
        const rows = await res.json();
        return (rows && rows.length > 0) ? rows[0].value : null;
    } catch {
        return null;
    }
}

function getEmailTemplate(index, name, configTemplates = null) {
    const firstName = ((name || 'there').split(' ')[0]) || 'there';
    const templates = configTemplates || HARDCODED_EMAIL_TEMPLATES;
    const tpl = templates.find(t => t.email_index === index && t.enabled !== false);
    if (!tpl) return null;
    const bodyHtml = tpl.body_html.replace(/\{name\}/gi, firstName);
    return {
        subject: tpl.subject,
        html: buildEmailHtml(tpl.emoji || '', bodyHtml),
    };
}

// ============================================
// EMAIL QUEUE PROCESSOR
// ============================================

async function processEmailQueue() {
    const [configTemplates, emailSettings] = await Promise.all([
        fetchEmailTemplatesFromConfig(),
        fetchEmailSettings(),
    ]);
    const fromName = emailSettings?.from_name || 'FlirtEasy';
    const fromEmail = emailSettings?.from_email || 'flirteasyio@gmail.com';
    const replyTo = emailSettings?.reply_to || '';
    const now = new Date().toISOString();

    const rows = await fetch(
        `${SUPABASE_URL}/rest/v1/email_queue?status=eq.pending&scheduled_at=lte.${now}&order=scheduled_at.asc&limit=50`,
        { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    ).then(r => r.json()).catch(() => []);

    if (!rows || rows.length === 0) return { sent: 0, failed: 0, message: 'No emails due' };

    let sent = 0;
    let failed = 0;

    const allTemplates = configTemplates || HARDCODED_EMAIL_TEMPLATES;

    for (const row of rows) {
        const tplMeta = allTemplates.find(t => t.email_index === row.email_index);
        if (!tplMeta) {
            await markEmailStatus(row.id, 'failed', 'Unknown email_index');
            failed++;
            continue;
        }
        if (tplMeta.enabled === false) {
            await markEmailStatus(row.id, 'failed', 'Template disabled by admin');
            failed++;
            continue;
        }
        const template = getEmailTemplate(row.email_index, row.user_name, configTemplates);
        if (!template) {
            await markEmailStatus(row.id, 'failed', 'Template render failed');
            failed++;
            continue;
        }

        try {
            const res = await fetch(`${ZAPIER_EMAIL_WEBHOOK_URL}?row_id=${encodeURIComponent(row.id)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: row.user_email,
                    subject: template.subject,
                    html: template.html,
                    name: row.user_name || '',
                    from_name: fromName,
                    from_email: fromEmail,
                    row_id: row.id,
                    ...(replyTo ? { reply_to: replyTo } : {}),
                })
            });

            if (res.ok || res.status === 200) {
                await markEmailStatus(row.id, 'sent', null);
                sent++;
            } else {
                const errText = await res.text().catch(() => `HTTP ${res.status}`);
                await markEmailStatus(row.id, 'failed', errText);
                failed++;
            }
        } catch (err) {
            await markEmailStatus(row.id, 'failed', err.message);
            failed++;
        }
    }

    return { sent, failed, total: rows.length };
}

async function markEmailStatus(id, status, errorMessage) {
    const body = {
        status,
        ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}),
        error_message: errorMessage || null
    };
    await fetch(`${SUPABASE_URL}/rest/v1/email_queue?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    }).catch(() => {});
}

