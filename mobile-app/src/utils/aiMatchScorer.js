// mobile-app/src/utils/aiMatchScorer.js
// AI Smart Compatibility Scorer — Production Engine
// Multi-dimensional compatibility evaluation with hard filters, adaptive local scoring, and optional LLM refinement.

import { API_CONFIG } from '../config/api';

// ── Cache Layer (24-hour TTL, Isolated per User) ──
const scoreCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function buildScoreCacheKey(candidateId, userId = 'default') {
  const cleanUser = String(userId || 'default').trim() || 'default';
  const cleanCand = String(candidateId || '').trim();
  return `${cleanUser}_${cleanCand}`;
}

export function getCachedScore(candidateId, userId = 'default') {
  if (!candidateId) return null;
  const key = buildScoreCacheKey(candidateId, userId);
  const entry = scoreCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    scoreCache.delete(key);
    return null;
  }
  return entry.result;
}

export function setCachedScore(candidateId, result, userId = 'default') {
  if (!candidateId || !result) return;
  const key = buildScoreCacheKey(candidateId, userId);
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

function sanitizeForPrompt(text, maxLen = 200) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["'{}\\]/g, '')
    .trim()
    .slice(0, maxLen);
}

export async function scoreCandidateLLM(candidate, ownProfile, apiConfig = {}) {
  const own = ownProfile || {};
  const cand = candidate || {};

  const ownAge = Number(own.age) || 'Unknown';
  const candAge = Number(cand.age) || 'Unknown';
  const ownBio = sanitizeForPrompt(own.bio, 200);
  const candBio = sanitizeForPrompt(cand.bio, 200);
  const ownInterests = extractList(own.interests).slice(0, 8).join(', ');
  const candInterests = extractList(cand.interests).slice(0, 8).join(', ');
  const ownGoal = sanitizeForPrompt(own.lookingFor, 50) || 'Not specified';
  const candGoal = sanitizeForPrompt(cand.lookingFor, 50) || 'Not specified';
  const ownDesc = extractList(own.descriptors).slice(0, 6).join(', ');
  const candDesc = extractList(cand.descriptors).slice(0, 6).join(', ');

  const systemPrompt = 'You are a dating compatibility analyst. Given two dating profiles, rate their compatibility from 0-100. Respond ONLY with valid JSON: {"score":NUMBER,"reasons":["reason1","reason2"]}';
  const userPrompt = `PROFILE A (User): Age ${ownAge}. Bio: ${ownBio || 'None'}. Interests: ${ownInterests || 'None'}. Looking for: ${ownGoal}. Lifestyle: ${ownDesc || 'None'}.\nPROFILE B (Candidate): Age ${candAge}. Bio: ${candBio || 'None'}. Interests: ${candInterests || 'None'}. Looking for: ${candGoal}. Lifestyle: ${candDesc || 'None'}.\nRate compatibility 0-100 with 2 specific reasons.`;

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

    const rawScore = Number(parsed.score);
    if (!Number.isFinite(rawScore)) return null;

    const score = Math.min(100, Math.max(0, Math.round(rawScore)));
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons
          .slice(0, 2)
          .map(r => String(r).replace(/<[^>]*>/g, '').trim().slice(0, 80))
          .filter(Boolean)
      : [];

    return {
      score,
      reasons,
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

  // Check 24h cache first (isolated per user)
  const cached = getCachedScore(candidateId, userId);
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
    setCachedScore(candidateId, result, userId);
    return result;
  }

  // 2. Local Deterministic Scorer
  const localResult = scoreCandidateLocal(candidate, ownProfile, preferences);
  const threshold = typeof preferences.aiMatchThreshold === 'number' ? preferences.aiMatchThreshold : 60;

  let finalScore = localResult.score;
  let tier = 'local';
  let llmReasons = [];

  // 3. Optional LLM Refinement in Uncertain Zone (Threshold ± 15)
  const isUncertain = Math.abs(localResult.score - threshold) <= 15;
  const canUseLLM = preferences.aiMatchUseLLM && localResult.confidence >= 0.3 && isUncertain;

  if (canUseLLM) {
    const llmResult = await scoreCandidateLLM(candidate, ownProfile, options.apiConfig);
    if (llmResult && Number.isFinite(llmResult.score)) {
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

  setCachedScore(candidateId, result, userId);
  return result;
}
