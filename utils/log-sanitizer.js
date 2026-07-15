// Sanitize sensitive data before logging
function sanitizeApiKey(key) {
  if (!key || typeof key !== 'string') return '[no-key]';
  if (key.startsWith('sk-proj-')) return 'sk-proj-***';
  if (key.startsWith('sk-')) return 'sk-***';
  return '***';
}

function sanitizeToken(token) {
  if (!token || typeof token !== 'string') return '[no-token]';
  return token.substring(0, 8) + '***';
}

function sanitizeUserId(userId) {
  if (!userId || typeof userId !== 'string') return '[no-id]';
  return userId.substring(0, 8) + '***';
}

function sanitizeMatchId(matchId) {
  if (!matchId || typeof matchId !== 'string') return '[no-match-id]';
  return matchId.substring(0, 8) + '***';
}

function sanitizeMessage(message) {
  if (!message || typeof message !== 'string') return '[no-message]';
  if (message.length <= 30) return message.substring(0, 15) + '***';
  return message.substring(0, 30) + '***';
}

function sanitizeProfileData(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  
  const sanitized = { ...profile };
  
  // Redact personal info
  if (sanitized.name) sanitized.name = '[name]';
  if (sanitized.bio) sanitized.bio = '[bio-' + sanitized.bio.length + '-chars]';
  if (sanitized.job) sanitized.job = '[job]';
  if (sanitized.school) sanitized.school = '[school]';
  if (sanitized.city) sanitized.city = '[city]';
  
  return sanitized;
}

function sanitizeObject(obj, sensitiveKeys = ['apiKey', 'token', 'xAuthToken', 'userId', 'matchId', 'name', 'bio', 'message']) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };
  
  for (const key in sanitized) {
    if (sensitiveKeys.includes(key)) {
      if (key === 'apiKey') sanitized[key] = sanitizeApiKey(sanitized[key]);
      else if (key.includes('token') || key.includes('Token')) sanitized[key] = sanitizeToken(sanitized[key]);
      else if (key === 'userId') sanitized[key] = sanitizeUserId(sanitized[key]);
      else if (key === 'matchId') sanitized[key] = sanitizeMatchId(sanitized[key]);
      else if (key === 'message') sanitized[key] = sanitizeMessage(sanitized[key]);
      else sanitized[key] = '[redacted]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key], sensitiveKeys);
    }
  }
  
  return sanitized;
}
// Expose functions globally for service worker
if (typeof self !== 'undefined') {
  self.sanitizeApiKey = sanitizeApiKey;
  self.sanitizeToken = sanitizeToken;
  self.sanitizeUserId = sanitizeUserId;
  self.sanitizeMatchId = sanitizeMatchId;
  self.sanitizeMessage = sanitizeMessage;
  self.sanitizeProfileData = sanitizeProfileData;
  self.sanitizeObject = sanitizeObject;
}
