/**
 * job-queue.js
 * ─────────────────────────────────────────────────────────────────────────────
 * BullMQ-based job queue for managing automation cycles.
 *
 * Each user's automation cycle is a recurring job.
 * BullMQ handles:
 *  - Scheduling (run every N minutes per user settings)
 *  - Concurrency limits (max parallel browser sessions)
 *  - Retries on failure
 *  - Job deduplication (one job per user at a time)
 *
 * Queue name: 'automation'
 * Job name:   'cycle' — one full automation cycle for a user
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { childLogger } from './utils/logger.js';

const log = childLogger('job-queue');

const REDIS_CONNECTION = {
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
};

// Max concurrent automation cycles running at the same time on this server.
// Each cycle uses one browser context (~400MB RAM).
// CPX31 (8GB) → safe at 15 concurrent. CPX41 (16GB) → safe at 30.
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '15', 10);

const QUEUE_NAME = 'automation';

let queue   = null;
let worker  = null;
let qEvents = null;

/**
 * Initialises the queue and worker.
 * @param {Function} cycleHandler — async (job) => void — the actual automation logic
 */
export function initQueue(cycleHandler) {
  queue = new Queue(QUEUE_NAME, {
    connection: REDIS_CONNECTION,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail:     { count: 200 },
      attempts:         3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  });

  worker = new Worker(QUEUE_NAME, async job => {
    const workerLog = childLogger('job-queue', job.data.userId);
    workerLog.info({ jobId: job.id, name: job.name }, 'Processing job');
    try {
      await cycleHandler(job);
    } catch (err) {
      workerLog.error({ err: err.message, jobId: job.id }, 'Job failed');
      throw err; // let BullMQ handle retries
    }
  }, {
    connection:  REDIS_CONNECTION,
    concurrency: MAX_CONCURRENCY,
  });

  qEvents = new QueueEvents(QUEUE_NAME, { connection: REDIS_CONNECTION });

  worker.on('completed', job => {
    childLogger('job-queue', job.data.userId).debug({ jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    childLogger('job-queue', job?.data?.userId).warn(
      { jobId: job?.id, err: err.message, attempts: job?.attemptsMade },
      'Job failed'
    );
  });

  log.info({ concurrency: MAX_CONCURRENCY }, 'Job queue initialised');
}

/**
 * Schedules recurring automation cycles for a user.
 * Uses BullMQ's repeat feature — automatically re-queues after each cycle.
 *
 * @param {string} userId
 * @param {string} platform      — 'tinder' | 'bumble'
 * @param {number} intervalMins  — how often to run (from user settings)
 */
export async function scheduleUserCycles(userId, platform, intervalMins = 30) {
  if (!queue) throw new Error('Queue not initialised — call initQueue() first');

  const jobId  = `cycle:${userId}`;
  const repeat = { every: intervalMins * 60 * 1000 }; // ms

  // Remove any existing schedule for this user first (settings may have changed)
  await removeUserCycles(userId);

  await queue.add('cycle', { userId, platform }, {
    jobId,
    repeat,
    // Run once immediately, then on schedule
    delay: 0,
  });

  childLogger('job-queue', userId).info(
    { intervalMins },
    'Automation cycles scheduled'
  );
}

/**
 * Removes all scheduled cycles for a user.
 * Call this when user pauses or disconnects.
 */
export async function removeUserCycles(userId) {
  if (!queue) return;
  try {
    const repeatableJobs = await queue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.id === `cycle:${userId}` || (job.name === 'cycle' && job.id?.includes(userId))) {
        await queue.removeRepeatableByKey(job.key);
      }
    }
    childLogger('job-queue', userId).info('Automation cycles removed');
  } catch (err) {
    childLogger('job-queue', userId).warn({ err: err.message }, 'Error removing cycles');
  }
}

/**
 * Triggers a single immediate cycle for a user (bypasses schedule).
 * Used when user clicks "Run now" in the plugin.
 */
export async function triggerImmediateCycle(userId, platform) {
  if (!queue) throw new Error('Queue not initialised');
  const job = await queue.add('cycle', { userId, platform }, {
    jobId:    `cycle:${userId}:immediate:${Date.now()}`,
    priority: 1, // high priority
  });
  childLogger('job-queue', userId).info({ jobId: job.id }, 'Immediate cycle triggered');
  return job.id;
}

/**
 * Returns queue stats — used by the Cloud API for monitoring.
 */
export async function getQueueStats() {
  if (!queue) return null;
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}

/**
 * Graceful shutdown — drains the queue and closes connections.
 */
export async function shutdownQueue() {
  log.info('Shutting down job queue...');
  if (worker)  await worker.close();
  if (queue)   await queue.close();
  if (qEvents) await qEvents.close();
  log.info('Job queue shut down');
}

process.on('SIGTERM', shutdownQueue);
process.on('SIGINT',  shutdownQueue);
