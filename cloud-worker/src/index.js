/**
 * index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * FlirtEasy Cloud Worker — entry point.
 * Starts the HTTP server, WebSocket server, job queue, and health checks.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import { initQueue } from './job-queue.js';
import { runCycle } from './automation-runner.js';
import { startHealthChecks } from './session-manager.js';
import cloudApiRouter, { attachWebSocket } from './cloud-api.js';
import { app as loginApp, attachVNCProxy } from './login-server.js';
import logger from './utils/logger.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const app  = express();

// ── Health probe (for load balancer / uptime monitor) ─────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Cloud API routes (/cloud/*) ───────────────────────────────────────────────
app.use('/cloud', cloudApiRouter);

// ── Login server routes (/login/*) ────────────────────────────────────────────
app.use('/', loginApp);

// ── HTTP server ───────────────────────────────────────────────────────────────
const httpServer = createServer(app);

// ── WebSocket servers ─────────────────────────────────────────────────────────
attachWebSocket(httpServer);    // /cloud/events WebSocket (extension ↔ server)
attachVNCProxy(httpServer);     // /vnc WebSocket (noVNC ↔ Xvfb)

// ── Job queue ─────────────────────────────────────────────────────────────────
initQueue(runCycle);

// ── Session health checks ─────────────────────────────────────────────────────
startHealthChecks();

// ── Start ─────────────────────────────────────────────────────────────────────
httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, '🚀 FlirtEasy Cloud Worker started');
});

// ── Unhandled rejection safety net ────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error({ reason: String(reason) }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.error({ err: err.message }, 'Uncaught exception');
  process.exit(1);
});
