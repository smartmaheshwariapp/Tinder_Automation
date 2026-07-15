/**
 * Security utilities for FlirtEasy
 * Handles input sanitization and data encryption
 */

// Input sanitization
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
}

// Sanitize object recursively
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? sanitizeInput(obj) : obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }
  return sanitized;
}

// Simple encryption for sensitive data (tokens)
async function encryptData(data) {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(data));
  
  // Generate encryption key from browser fingerprint
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(await getBrowserFingerprint()),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('flirteasy-salt-v1'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );
  
  return {
    encrypted: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv)
  };
}

async function decryptData(encryptedData) {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(await getBrowserFingerprint()),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('flirteasy-salt-v1'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
      key,
      new Uint8Array(encryptedData.encrypted)
    );
    
    return JSON.parse(decoder.decode(decrypted));
  } catch (err) {
    console.error('[Security] Decryption failed:', err);
    return null;
  }
}

// Generate browser fingerprint for encryption key
async function getBrowserFingerprint() {
  const data = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    screen.width + 'x' + screen.height
  ].join('|');
  
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Redact sensitive data from logs
function redactSensitiveData(data) {
  if (typeof data !== 'object' || data === null) return data;
  
  const redacted = JSON.parse(JSON.stringify(data));
  const sensitiveKeys = ['apiKey', 'token', 'password', 'auth', 'secret', 'key'];
  
  function redactObject(obj) {
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        obj[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redactObject(value);
      }
    }
  }
  
  redactObject(redacted);
  return redacted;
}

// Expose functions
if (typeof self !== 'undefined') {
  self.sanitizeInput = sanitizeInput;
  self.sanitizeObject = sanitizeObject;
  self.encryptData = encryptData;
  self.decryptData = decryptData;
  self.redactSensitiveData = redactSensitiveData;
}
