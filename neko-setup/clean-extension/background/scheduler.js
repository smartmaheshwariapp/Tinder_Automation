
const ALARM_NAME = 'flirtEasyAutomation';
const WATCHDOG_INTERVAL_MINUTES = 3; // 3-minute aggressive heartbeat
const TURBO_START_LIMIT = 4;


async function startScheduler() {
  const settings = await getSettings();
  const state = await getAgentState();
  const isTurboPhase = (state.lifetimeCycles || 0) < TURBO_START_LIMIT;

  const standardInterval = settings.scheduleIntervalCustomized
    ? settings.scheduleInterval
    : (isTurboPhase ? 30 : 60);

  // Smart resume: if extension was reloaded mid-cycle, pick up the remaining
  // time from the last run rather than resetting to a full interval.
  let delayMinutes = standardInterval;
  if (state.lastRunTimestamp) {
    const elapsedMin = (Date.now() - state.lastRunTimestamp) / 60000;
    const remainingMin = standardInterval - elapsedMin;
    delayMinutes = remainingMin > 1 ? Math.round(remainingMin) : 1;
  }

  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: delayMinutes,
    periodInMinutes: standardInterval
  });

  state.nextRunTimestamp = Date.now() + (delayMinutes * 60000);
  await saveAgentState(state);

  if (typeof info === 'function') {
    const label = delayMinutes < standardInterval ? `▶ Resuming in ${delayMinutes}m (mid-cycle resume)` : (isTurboPhase ? `🚀 Turbo Start Active: next run in ${delayMinutes}m` : `Scheduler started: next run in ${delayMinutes}m`);
    info(label);
  }

  return { success: true, nextRunMinutes: delayMinutes, standardInterval, isTurbo: isTurboPhase };
}

function isWithinActiveHours(settings) {
  if (!settings.activeHours || !settings.activeHours.enabled) {
    return true;
  }

  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const currentTime = `${displayHour}:${String(minute).padStart(2, '0')} ${ampm}`;
  const { startTime, endTime } = settings.activeHours;

  console.log('[Scheduler] Current time:', currentTime, 'Range:', startTime, '-', endTime);

  // Handle overnight range
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}

async function stopScheduler() {
  await chrome.alarms.clear(ALARM_NAME);

  const state = await getAgentState();
  state.nextRunTimestamp = null;
  await saveAgentState(state);

  if (typeof info === 'function') {
    info('Scheduler stopped');
  }

  return { success: true };
}

async function rescheduleNextRun(cycleCompleted = false) {
  const state = await getAgentState();
  const settings = await getSettings();
  const isTurboPhase = (state.lifetimeCycles || 0) < TURBO_START_LIMIT;
  const standardInterval = settings.scheduleIntervalCustomized ? settings.scheduleInterval : (isTurboPhase ? 30 : 60);

  // 1. Check for Rate Limits
  let rateStatus = null;
  try {
    if (typeof getRateLimitStatus === 'function') {
      rateStatus = await getRateLimitStatus();
    }
  } catch (e) {
    console.warn('[Scheduler] Failed to check rate limits:', e);
  }

  const safetyMode = settings.safetyMode !== false;
  const likesEx  = safetyMode && rateStatus && rateStatus.likes.remaining <= 0;
  const msgsEx   = (safetyMode && rateStatus && rateStatus.messages.remaining <= 0) || !!state.platformMsgRateLimitHit;

  // Trial-aware override: treat trial-exhausted messages as permanently unavailable.
  // Without this, when hourly like-rate is exhausted but hourly message-rate still has
  // capacity, the scheduler sees "one limit hit + message ammo" → useWatchdog=true →
  // waitingReason='searching' — even though trial has ZERO messages left forever.
  let trialMsgsExhausted = false;
  try {
    if (typeof TrialManager !== 'undefined') {
      const _trialSched = await TrialManager.getTrialStatus();
      trialMsgsExhausted = _trialSched?.messagesExhausted === true;
    }
  } catch (_) {}
  const effectiveMsgsEx = msgsEx || trialMsgsExhausted;

  // 2. Identify "Partial Work" State
  // If one limit is hit but the other side still has work to do, 
  // or if we are just "Caught Up" but have ammo left, we use WATCHDOG
  // Messages count as "ammo" only when NOT trial-exhausted.
  const hasRemainingAmmo = (rateStatus?.likes.remaining > 0 || (!trialMsgsExhausted && rateStatus?.messages.remaining > 0)) || !safetyMode;
  const isOneLimitHit = (likesEx || effectiveMsgsEx) && !(likesEx && effectiveMsgsEx);

  // Trial-exhausted messages are PERMANENT — the watchdog's purpose is to work the
  // other side while one limit resets. But trial never resets, so we must avoid
  // triggering a 3-min watchdog when BOTH sides have nothing to offer:
  //   • trial msgs exhausted (permanent — no messaging ever)
  //   • hourly like rate also exhausted (temporary — but right now can't swipe either)
  // In that combined state, watchdog just spins with 0 likes, 0 msgs every 3 min.
  // However if hourly likes are still available (likesEx=false), the watchdog is valid —
  // Bumble may surface new profiles and we can still swipe.
  const trialPartialOnly = trialMsgsExhausted && likesEx;
  
  // Use aggressive heartbeat if we're in a 'running' mission but blocked by a circumstantial reason.
  // Also always use watchdog when safety is OFF — no rate limits means keep cycling aggressively.
  const useWatchdog = state.isRunning && hasRemainingAmmo && !trialPartialOnly && (isOneLimitHit || state.waitingReason === 'searching' || !safetyMode);
  const intervalMinutes = useWatchdog ? WATCHDOG_INTERVAL_MINUTES : standardInterval;

  // 3. Sync with existing Alarm
  const existingAlarm = await chrome.alarms.get(ALARM_NAME);
  let targetTimestamp = 0;

  // If we're entering Watchdog mode, we force-reschedule to be aggressive
  if (useWatchdog || !existingAlarm) {
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: intervalMinutes,
      periodInMinutes: intervalMinutes
    });
    targetTimestamp = Date.now() + (intervalMinutes * 60000);
  } else {
    targetTimestamp = existingAlarm.scheduledTime;
  }

  // 4. Update UI labels
  if (likesEx && msgsEx) {
    // safety_lock only when BOTH hourly safety-rate limits are truly exhausted (not just trial)
    state.waitingReason = 'safety_lock';
    state.partialResetTimestamp = null;
    // Always reschedule to the actual rate-limit reset time (the sooner value).
    // The existing alarm may be set to a full interval from the start of the cycle
    // (e.g. 53m) while the rate window actually resets sooner (e.g. 16m).
    // We must use the minimum — fire when limits actually reset.
    // Safety lock lifts only when BOTH limits have capacity — use the longer of the two reset times.
    const safetyResetIn = Math.max(rateStatus.likesResetIn || rateStatus.resetIn, rateStatus.messagesResetIn || rateStatus.resetIn);
    const safetyTarget = Date.now() + safetyResetIn * 60000;
    // Always override to the actual reset time — any existing watchdog alarm (3m periodic)
    // would otherwise keep nextRunTimestamp at 3m, making the orb show "Resumes in 1m" repeatedly.
    targetTimestamp = safetyTarget;
    await chrome.alarms.create(ALARM_NAME, { delayInMinutes: safetyResetIn });
  } else if (msgsEx && !trialMsgsExhausted && (!cycleCompleted || state.platformMsgRateLimitHit)) {
    // message_limit: hourly safety-rate exhausted mid-cycle (not trial — trial has no reset)
    state.waitingReason = 'message_limit';
    state.partialResetTimestamp = Date.now() + (rateStatus ? (rateStatus.messagesResetIn || 60) : 60) * 60000;
  } else if (likesEx && !cycleCompleted) {
    // Only set like_limit mid-cycle (not after a full cycle completion)
    state.waitingReason = 'like_limit';
    state.partialResetTimestamp = Date.now() + (rateStatus.likesResetIn || 60) * 60000;
  } else {
    // Watchdog is active and messages still have capacity → ran out of contacts to reply to,
    // waiting for new replies to come in → 'searching'.
    // If messages are also exhausted (safety rate OR trial) we have nothing to do → 'schedule'.
    // (Likes being at the limit doesn't matter here — we can't swipe more this cycle anyway.)
    state.waitingReason = (useWatchdog && !effectiveMsgsEx) ? 'searching' : 'schedule';
    state.partialResetTimestamp = null;
  }

  state.nextRunTimestamp = targetTimestamp;
  await saveAgentState(state);

  const remainingMin = Math.round((targetTimestamp - Date.now()) / 60000);
  if (typeof info === 'function') {
    if (useWatchdog) info(`🛰️ Watchdog Active: searching again in ${remainingMin}m`);
    else info(isTurboPhase ? `🚀 Turbo: next run in ${remainingMin}m` : `Next run in ${remainingMin}m`);
  }
}


// Expose functions globally for service worker
if (typeof self !== 'undefined') {
  self.startScheduler = startScheduler;
  self.stopScheduler = stopScheduler;
  self.rescheduleNextRun = rescheduleNextRun;
  self.isWithinActiveHours = isWithinActiveHours;
}
