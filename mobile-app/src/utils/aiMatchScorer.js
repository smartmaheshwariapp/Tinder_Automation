// mobile-app/src/utils/aiMatchScorer.js
// AI Smart Compatibility Scorer — Production Engine
// Multi-dimensional compatibility evaluation with hard filters, adaptive local scoring, and optional LLM refinement.

import { API_CONFIG } from '../config/api';

// ── Cache Layer (24-hour TTL, Isolated per User + Profile Version) ──
const scoreCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Simple hash of profile fields that affect scoring — ensures cache invalidation
// when the user edits their profile or preferences change.
function profileVersionHash(profile) {
  if (!profile) return '0';
  const fields = [
    String(profile.bio || '').slice(0, 50),
    String(profile.lookingFor || ''),
    String(profile.job || ''),
    String(profile.school || ''),
    String(profile.city || ''),
    Array.isArray(profile.interests) ? profile.interests.length : '0',
    Array.isArray(profile.descriptors) ? profile.descriptors.length : '0',
  ].join('|');
  // djb2-style hash — fast, deterministic, no crypto dependency
  let h = 5381;
  for (let i = 0; i < fields.length; i++) h = ((h << 5) + h + fields.charCodeAt(i)) | 0;
  return String(Math.abs(h));
}

function buildScoreCacheKey(candidateId, userId = 'default', userProfile = null) {
  const cleanUser = String(userId || 'default').trim() || 'default';
  const cleanCand = String(candidateId || '').trim();
  const ver = profileVersionHash(userProfile);
  return `${cleanUser}_${cleanCand}_${ver}`;
}

export function getCachedScore(candidateId, userId = 'default', userProfile = null) {
  if (!candidateId) return null;
  const key = buildScoreCacheKey(candidateId, userId, userProfile);
  const entry = scoreCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    scoreCache.delete(key);
    return null;
  }
  return entry.result;
}

export function setCachedScore(candidateId, result, userId = 'default', userProfile = null) {
  if (!candidateId || !result) return;
  const key = buildScoreCacheKey(candidateId, userId, userProfile);
  scoreCache.set(key, {
    result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearScoreCache() {
  scoreCache.clear();
}

// ── Relationship Goal Matrix ──

const LONG_TERM_GOALS = new Set([
  'long_term',
  'long_term_partner',
  'long_term_open_to_short',
  'meaningful_relationship',
  'meaningful_conversations',
  'marriage',
  'life_partner',
]);

const SHORT_TERM_GOALS = new Set([
  'short_term',
  'short_term_open_to_long',
  'short_term_fun',
  'casual_connection',
  'just_fun',
  'new_friends',
  'friends',
  'casual',
]);

const OPEN_GOALS = new Set([
  'open_to_anything',
  'figuring_out',
  'figuring_out_my_dating_goals',
  'everything',
  'still_figuring_it_out',
  'open',
]);

export function normalizeGoal(goal) {
  if (!goal || typeof goal !== 'string') return '';
  return goal
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function areGoalsCompatible(goalA, goalB) {
  const normA = normalizeGoal(goalA);
  const normB = normalizeGoal(goalB);

  // If either is unknown/unset, cannot determine incompatibility
  if (!normA || !normB) return true;

  // Exact match
  if (normA === normB) return true;

  // Either is open to anything / figuring it out
  if (OPEN_GOALS.has(normA) || OPEN_GOALS.has(normB)) return true;

  // Flexible goals bridging both long and short
  const isFlexA = normA === 'long_term_open_to_short' || normA === 'short_term_open_to_long';
  const isFlexB = normB === 'long_term_open_to_short' || normB === 'short_term_open_to_long';

  if (isFlexA || isFlexB) return true;

  // Both are within Long-term cluster
  if (LONG_TERM_GOALS.has(normA) && LONG_TERM_GOALS.has(normB)) return true;

  // Both are within Short-term/Casual cluster
  if (SHORT_TERM_GOALS.has(normA) && SHORT_TERM_GOALS.has(normB)) return true;

  // Otherwise incompatible
  return false;
}

// ── Hard Filters (Dealbreakers) ──

export function checkHardFilters(candidate, ownProfile, preferences = {}) {
  // 1. Relationship Goal Mismatch
  if (preferences.aiMatchStrictGoals !== false) {
    const userGoal = ownProfile?.lookingFor;
    const candGoal = candidate?.lookingFor;
    if (userGoal && candGoal) {
      if (!areGoalsCompatible(userGoal, candGoal)) {
        return { passed: false, reason: 'Goal mismatch' };
      }
    }
  }

  // 2. Distance Ceiling
  const maxDist = preferences.aiMatchMaxDistance;
  if (typeof maxDist === 'number' && maxDist > 0) {
    const candDist = candidate?.distanceMi;
    if (typeof candDist === 'number' && candDist > maxDist) {
      return { passed: false, reason: 'Distance exceeds limit' };
    }
  }

  return { passed: true };
}

// ── Soft Scorer (Adaptive, 7 Axes) ──
//
// Design Decision: 7 axes, not 8.
//
// The original spec mentioned 8 axes (including Age compatibility and Prompt resonance).
// Both were deliberately dropped:
//
// 1. Age axis: Tinder's discovery settings already bound the age range shown to the user.
//    Every candidate visible has already passed the user's own age filter. Re-scoring age
//    would duplicate Tinder's filter and penalize matches the user already accepted into
//    their radius. If age is ever a dealbreaker, it belongs as a hard filter, not a soft
//    scoring axis.
//
// 2. Prompt resonance: Merged into Bio Keywords (Axis 3). Tinder Q&A answers contribute
//    to the Completeness axis (Axis 7), and bio keyword overlap already captures semantic
//    similarity. A separate axis would double-count bio content against itself.
//

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'here', 'what', 'when', 'where',
  'your', 'just', 'more', 'some', 'about', 'like', 'love', 'looking',
  'will', 'been', 'would', 'there', 'their', 'them', 'they', 'than',
  'then', 'also', 'into', 'only', 'very', 'much', 'know', 'want',
]);

const CAREER_KEYWORDS = [
  'engineer', 'developer', 'software', 'tech', 'coding', 'design', 'designer',
  'art', 'artist', 'creative', 'student', 'university', 'college', 'marketing',
  'finance', 'consulting', 'business', 'founder', 'entrepreneur', 'sales',
  'doctor', 'nurse', 'medical', 'law', 'lawyer', 'legal', 'teacher', 'education',
  'writer', 'music', 'musician', 'photographer', 'architect', 'research',
];

function extractList(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map(item => (typeof item === 'string' ? item : item?.name || ''))
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }
  if (typeof val === 'string') {
    return val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function tokenizeBio(bio) {
  if (!bio || typeof bio !== 'string') return new Set();
  const words = bio
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));
  return new Set(words);
}

export function computeLabel(score, confidence) {
  if (confidence < 0.3) return 'Low Info';
  if (score >= 75 && confidence >= 0.5) return 'Strong Match';
  if (score >= 50) return 'Good Potential';
  if (score >= 30) return 'Moderate';
  return 'Low Compatibility';
}

export function scoreCandidateLocal(candidate, ownProfile, preferences = {}) {
  const breakdown = [];
  let availableWeight = 0;
  let earnedPoints = 0;
  let populatedAxesCount = 0;

  const own = ownProfile || {};
  const cand = candidate || {};

  // ── Axis 1: Shared Interests (Max 25) ──
  const userInterests = extractList(own.interests && own.interests.length ? own.interests : (preferences.interests || preferences.targetInterests));
  const candInterests = extractList(cand.interests);
  if (userInterests.length > 0 && candInterests.length > 0) {
    const userIntSet = new Set(userInterests);
    let overlap = 0;
    for (const item of candInterests) {
      if (userIntSet.has(item)) overlap++;
    }
    const maxPossible = Math.max(userInterests.length, candInterests.length);
    const earned = Math.min(25, Math.round((overlap / maxPossible) * 25 * 10) / 10);
    breakdown.push({ axis: 'Shared Interests', earned, max: 25 });
    availableWeight += 25;
    earnedPoints += earned;
    populatedAxesCount++;
  }

  // ── Axis 2: Lifestyle Descriptors (Max 15) ──
  const userDesc = extractList(own.descriptors && own.descriptors.length ? own.descriptors : (preferences.descriptors || preferences.lifestyle));
  const candDesc = extractList(cand.descriptors);
  if (userDesc.length > 0 && candDesc.length > 0) {
    const userDescSet = new Set(userDesc);
    let overlap = 0;
    for (const item of candDesc) {
      if (userDescSet.has(item)) overlap++;
    }
    const maxPossible = Math.max(userDesc.length, candDesc.length);
    const earned = Math.min(15, Math.round((overlap / maxPossible) * 15 * 10) / 10);
    breakdown.push({ axis: 'Lifestyle', earned, max: 15 });
    availableWeight += 15;
    earnedPoints += earned;
    populatedAxesCount++;
  }

  // ── Axis 3: Bio Keyword Affinity (Max 15) ──
  const userBio = typeof own.bio === 'string' && own.bio.trim()
    ? own.bio.trim()
    : (typeof own.manualBio === 'string' && own.manualBio.trim()
      ? own.manualBio.trim()
      : (typeof preferences.manualBio === 'string' ? preferences.manualBio.trim() : ''));
  const candBio = typeof cand.bio === 'string' ? cand.bio.trim() : '';
  if (userBio.length >= 10 && candBio.length >= 10) {
    const userTokens = tokenizeBio(userBio);
    const candTokens = tokenizeBio(candBio);
    if (userTokens.size > 0 && candTokens.size > 0) {
      let overlap = 0;
      for (const token of candTokens) {
        if (userTokens.has(token)) overlap++;
      }
      const maxPossible = Math.max(userTokens.size, candTokens.size);
      const earned = Math.min(15, Math.round((overlap / maxPossible) * 15 * 10) / 10);
      breakdown.push({ axis: 'Bio Keywords', earned, max: 15 });
      availableWeight += 15;
      earnedPoints += earned;
      populatedAxesCount++;
    }
  }

  // ── Axis 4: Career & Education (Max 10) ──
  const userJob = (own.job || preferences.userJob || '').trim();
  const userSchool = (own.school || preferences.userSchool || '').trim();
  const candJob = (cand.job || '').trim();
  const candSchool = (cand.school || '').trim();
  const userHasCareer = Boolean(userJob || userSchool);
  const candHasCareer = Boolean(candJob || candSchool);

  if (userHasCareer && candHasCareer) {
    let earned = 0;
    if (userJob && candJob) earned += 4;
    if (userSchool && candSchool) earned += 3;

    const userCareerText = `${userJob} ${userSchool}`.toLowerCase();
    const candCareerText = `${candJob} ${candSchool}`.toLowerCase();
    const hasFieldMatch = CAREER_KEYWORDS.some(
      kw => userCareerText.includes(kw) && candCareerText.includes(kw)
    );
    if (hasFieldMatch) earned += 3;

    earned = Math.min(10, earned);
    breakdown.push({ axis: 'Career & Education', earned, max: 10 });
    availableWeight += 10;
    earnedPoints += earned;
    populatedAxesCount++;
  } else if (candHasCareer && !userHasCareer) {
    let earned = 0;
    if (candJob) earned += 5;
    if (candSchool) earned += 3;
    earned = Math.min(10, earned);
    breakdown.push({ axis: 'Career & Education', earned, max: 10 });
    availableWeight += 10;
    earnedPoints += earned;
    populatedAxesCount++;
  }

  // ── Axis 5: Location Proximity (Max 10) ──
  const dist = cand.distanceMi;
  if (typeof dist === 'number' && !isNaN(dist) && dist >= 0) {
    let earned = 1;
    if (dist < 5) earned = 10;
    else if (dist < 15) earned = 8;
    else if (dist < 30) earned = 5;
    else if (dist < 50) earned = 3;

    breakdown.push({ axis: 'Location', earned, max: 10 });
    availableWeight += 10;
    earnedPoints += earned;
    populatedAxesCount++;
  } else if (typeof cand.city === 'string' && cand.city.trim()) {
    const candCity = cand.city.trim().toLowerCase();
    const userCity = typeof own.city === 'string' ? own.city.trim().toLowerCase() : '';
    let earned = 7;
    if (userCity && (userCity === candCity || userCity.includes(candCity) || candCity.includes(userCity))) {
      earned = 10;
    }
    breakdown.push({ axis: 'Location', earned, max: 10 });
    availableWeight += 10;
    earnedPoints += earned;
    populatedAxesCount++;
  }

  // ── Axis 6: Relationship Goal Harmony (Max 15) ──
  const userGoal = own.lookingFor || preferences.lookingFor || preferences.relationshipGoal;
  const candGoal = cand.lookingFor;
  if (userGoal && candGoal) {
    let earned = 0;
    const normU = normalizeGoal(userGoal);
    const normC = normalizeGoal(candGoal);
    if (normU && normC) {
      if (normU === normC) {
        earned = 15;
      } else if (areGoalsCompatible(userGoal, candGoal)) {
        earned = 10;
      }
    }
    breakdown.push({ axis: 'Goal Harmony', earned, max: 15 });
    availableWeight += 15;
    earnedPoints += earned;
    populatedAxesCount++;
  }

  // ── Axis 7: Profile Completeness Signal (Max 10 — NEVER SKIPPED) ──
  let completenessEarned = 0;
  if (candBio.length >= 5) completenessEarned += 3;
  if (candInterests.length > 0) completenessEarned += 2;
  const qa = cand.questionAnswers || cand.question_answers || [];
  if (Array.isArray(qa) && qa.length > 0) completenessEarned += 2;
  if (candDesc.length > 0) completenessEarned += 1;
  const photosCount = Array.isArray(cand.photos) ? cand.photos.length : (cand.photoUrl ? 1 : 0);
  if (photosCount >= 3) completenessEarned += 2;
  else if (photosCount >= 1) completenessEarned += 1;
  if (cand.verified) completenessEarned += 1;

  completenessEarned = Math.min(10, completenessEarned);
  breakdown.push({ axis: 'Completeness', earned: completenessEarned, max: 10 });
  availableWeight += 10;
  earnedPoints += completenessEarned;
  populatedAxesCount++; // Completeness always counts

  // ── Final Adaptive Normalization ──
  const score = availableWeight > 0
    ? Math.min(100, Math.max(0, Math.round((earnedPoints / availableWeight) * 100)))
    : 50;

  const confidence = Number((populatedAxesCount / 7).toFixed(2));
  const label = computeLabel(score, confidence);

  return {
    score,
    confidence,
    label,
    breakdown,
    tier: 'local',
  };
}

// ── LLM Refinement Tier (Optional) ──

// PII Stripping — removes phone numbers (with dashes/spaces/dots/parens), emails,
// social handles, and URLs. Does NOT attempt name-stripping — that's an NER problem
// requiring a model, not a regex. This is a documented known limitation.
function sanitizePII(text, maxLen = 150) {
  if (!text || typeof text !== 'string') return '';
  return text
    // Phone numbers: handles (123) 456-7890, 123.456.7890, +1-234-567-8900, etc.
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,9}/g, '[REDACTED]')
    // Email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED]')
    // Social handles (@username)
    .replace(/@[a-zA-Z0-9_]{2,30}/g, '[REDACTED]')
    // URLs
    .replace(/https?:\/\/[^\s]+/gi, '[REDACTED]')
    // Collapse whitespace and strip prompt-injection characters
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["'{}\\]/g, '')
    .trim()
    .slice(0, maxLen);
}

// Convert exact age to a demographic bucket — prevents re-identification
function ageBucket(age) {
  const n = Number(age);
  if (!Number.isFinite(n) || n < 18) return 'Unknown';
  if (n <= 22) return 'Early 20s';
  if (n <= 26) return 'Mid 20s';
  if (n <= 29) return 'Late 20s';
  if (n <= 34) return 'Early 30s';
  if (n <= 39) return 'Late 30s';
  if (n <= 44) return 'Early 40s';
  if (n <= 49) return 'Late 40s';
  return '50+';
}

// ── LLM Response Validation ──
// Strict type checking — Number(null)===0, Number(true)===1, Number([50])===50
// all pass Number.isFinite, so we gate on typeof first.
const EXPECTED_LLM_KEYS = new Set(['score', 'reasons']);

export function validateLLMResponse(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  // Warn on unexpected keys — potential signal of prompt injection or schema drift
  const unexpected = Object.keys(parsed).filter(k => !EXPECTED_LLM_KEYS.has(k));
  if (unexpected.length > 0) {
    console.warn('[aiMatchScorer] LLM returned unexpected fields:', unexpected.join(', '),
      '— possible prompt injection or schema change');
  }

  // Strict type guard: reject null, boolean, array, string that coerce to numbers
  if (typeof parsed.score !== 'number' || !Number.isFinite(parsed.score)) return null;

  const score = Math.min(100, Math.max(0, Math.round(parsed.score)));
  const reasons = Array.isArray(parsed.reasons)
    ? parsed.reasons
        .filter(r => typeof r === 'string')
        .slice(0, 3)
        // Tag stripping: nice-to-have since RN <Text> renders plain text,
        // but keeps the data clean if reasons are ever logged or displayed elsewhere.
        .map(r => r.replace(/<[^>]*>/g, '').replace(/[{}\\]/g, '').trim().slice(0, 80))
        .filter(Boolean)
    : [];

  return { score, reasons };
}

export async function scoreCandidateLLM(candidate, ownProfile, apiConfig = {}) {
  const own = ownProfile || {};
  const cand = candidate || {};

  // PII-safe: age buckets instead of exact ages, bio stripped of phone/email/handles
  const ownAgeBucket = ageBucket(own.age);
  const candAgeBucket = ageBucket(cand.age);
  const ownBio = sanitizePII(own.bio, 150);
  const candBio = sanitizePII(cand.bio, 150);
  const ownInterests = extractList(own.interests).slice(0, 8).join(', ');
  const candInterests = extractList(cand.interests).slice(0, 8).join(', ');
  const ownGoal = sanitizePII(own.lookingFor, 50) || 'Not specified';
  const candGoal = sanitizePII(cand.lookingFor, 50) || 'Not specified';
  const ownDesc = extractList(own.descriptors).slice(0, 6).join(', ');
  const candDesc = extractList(cand.descriptors).slice(0, 6).join(', ');

  const systemPrompt = 'You are a dating compatibility analyst. Given two dating profiles, rate their compatibility from 0-100. Respond ONLY with valid JSON: {"score":NUMBER,"reasons":["reason1","reason2"]}';
  const userPrompt = `PROFILE A (User): Age range ${ownAgeBucket}. Bio: ${ownBio || 'None'}. Interests: ${ownInterests || 'None'}. Looking for: ${ownGoal}. Lifestyle: ${ownDesc || 'None'}.\nPROFILE B (Candidate): Age range ${candAgeBucket}. Bio: ${candBio || 'None'}. Interests: ${candInterests || 'None'}. Looking for: ${candGoal}. Lifestyle: ${candDesc || 'None'}.\nRate compatibility 0-100 with 2 specific reasons.`;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;

  try {
    const apiKey = apiConfig?.apiKey;
    let res;

    if (apiKey && apiKey.startsWith('sk-')) {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 100,
        }),
        signal: controller ? controller.signal : undefined,
      });
    } else {
      const endpoints = apiConfig?.endpoints || API_CONFIG.getEndpoints();
      const headers = apiConfig?.headers || API_CONFIG.getHeaders();
      res = await fetch(endpoints.AI_CHAT, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 100,
        }),
        signal: controller ? controller.signal : undefined,
      });
    }

    if (timer) clearTimeout(timer);

    if (!res || !res.ok) return null;

    const data = await res.json();
    const rawContent = (data.choices?.[0]?.message?.content || data.message || data.result || '').trim();
    if (!rawContent) return null;

    // Clean markdown codeblocks if LLM wraps in ```json ... ```
    const cleaned = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned);

    const validated = validateLLMResponse(parsed);
    if (!validated) return null;

    return {
      score: validated.score,
      reasons: validated.reasons,
      tier: 'llm',
    };
  } catch (_) {
    if (timer) clearTimeout(timer);
    return null;
  }
}

// ── Main Orchestrator ──

export async function scoreCandidate(candidate, ownProfile, preferences = {}, options = {}) {
  const candidateId = candidate?.id || candidate?._id;
  const userId = ownProfile?.tinderUserId || ownProfile?._id || ownProfile?.id || ownProfile?.name || 'default';

  // Check 24h cache first (isolated per user + profile version)
  const cached = getCachedScore(candidateId, userId, ownProfile);
  if (cached) return cached;

  // 1. Dealbreaker Hard Filters
  const hardResult = checkHardFilters(candidate, ownProfile, preferences);
  if (!hardResult.passed) {
    const result = {
      score: 0,
      confidence: 1.0,
      label: 'Dealbreaker',
      reason: hardResult.reason,
      passed: false,
      shouldLike: false,
      breakdown: [],
      tier: 'filter',
    };
    setCachedScore(candidateId, result, userId, ownProfile);
    return result;
  }

  // 2. Local Deterministic Scorer
  const localResult = scoreCandidateLocal(candidate, ownProfile, preferences);
  const threshold = typeof preferences.aiMatchThreshold === 'number' ? preferences.aiMatchThreshold : 60;

  // ── Confidence Gate ──
  // A profile with near-zero information (confidence < 0.3) should NEVER be auto-liked
  // regardless of how the adaptive normalization inflates its score. Without this gate,
  // a completely blank profile scores 50 (completeness-only fallback) and would be liked
  // at any threshold below 50. That's a real bug, not a feature.
  const LOW_CONFIDENCE_THRESHOLD = 0.3;
  if (localResult.confidence < LOW_CONFIDENCE_THRESHOLD) {
    const result = {
      score: localResult.score,
      confidence: localResult.confidence,
      label: 'Low Info',
      breakdown: localResult.breakdown,
      tier: 'local',
      shouldLike: false,
      passed: true,
      reasons: [],
      lowConfidence: true,
    };
    setCachedScore(candidateId, result, userId, ownProfile);
    return result;
  }

  let finalScore = localResult.score;
  let tier = 'local';
  let llmReasons = [];

  // 3. Optional LLM Refinement in Uncertain Zone (Threshold ± 15)
  const isUncertain = Math.abs(localResult.score - threshold) <= 15;
  const canUseLLM = preferences.aiMatchUseLLM && localResult.confidence >= 0.3 && isUncertain;

  if (canUseLLM) {
    const llmResult = await scoreCandidateLLM(candidate, ownProfile, options.apiConfig);
    if (llmResult && typeof llmResult.score === 'number') {
      // Bound LLM score to local ± 15
      const clampedLLM = Math.max(localResult.score - 15, Math.min(localResult.score + 15, llmResult.score));
      finalScore = Math.round(0.4 * localResult.score + 0.6 * clampedLLM);
      tier = 'blended';
      llmReasons = llmResult.reasons || [];
    }
  }

  const finalLabel = computeLabel(finalScore, localResult.confidence);
  const shouldLike = finalScore >= threshold;

  const result = {
    score: finalScore,
    confidence: localResult.confidence,
    label: finalLabel,
    breakdown: localResult.breakdown,
    tier,
    shouldLike,
    passed: true,
    reasons: llmReasons,
  };

  setCachedScore(candidateId, result, userId, ownProfile);
  return result;
}
