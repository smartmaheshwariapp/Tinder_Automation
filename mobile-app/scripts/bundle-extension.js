#!/usr/bin/env node
// mobile-app/scripts/bundle-extension.js
// Bundles all FlirtEasy Chrome Extension content scripts into a single
// injectable JavaScript string for On-Device mode.
//
// Usage: node scripts/bundle-extension.js
// Output: src/utils/contentScriptBundle.js

'use strict';

const fs = require('fs');
const path = require('path');

// Root of the Chrome Extension source (one level up from mobile-app)
const EXT_ROOT = path.resolve(__dirname, '..', '..');

// Content scripts in exact manifest.json load order
const CONTENT_SCRIPTS = [
  'debug-config.js',
  'config.js',
  'utils/stop-conditions.js',
  'utils/language-detect.js',
  'content/ui-alerts.js',
  'content/tinder-dom.js',
  'content/profile-parser.js',
  'content/message-sender.js',
  // NOTE: status-bar.js is skipped — its UI is replaced by the React Native header HUD.
  // It depends on chrome.runtime.getURL for icon assets that don't exist in WebView.
  // 'content/status-bar.js',
  'content/content.js',
];

const CSS_FILE = 'content/status-bar.css';
const SELECTORS_FILE = 'config/selectors.json';
const OUTPUT_FILE = path.resolve(__dirname, '..', 'src', 'utils', 'contentScriptBundle.js');
const SELECTORS_OUTPUT = path.resolve(__dirname, '..', 'src', 'utils', 'selectorsData.js');

function readFile(relativePath) {
  const fullPath = path.join(EXT_ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠ File not found: ${relativePath} — skipping`);
    return null;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function main() {
  console.log('[Bundle] FlirtEasy Content Script Bundler');
  console.log(`[Bundle] Extension root: ${EXT_ROOT}`);
  console.log('');

  // ── 1. Read and export selectors.json ──
  const selectorsRaw = readFile(SELECTORS_FILE);
  if (!selectorsRaw) {
    console.error('[Bundle] FATAL: config/selectors.json not found');
    process.exit(1);
  }

  const selectorsModule = `// AUTO-GENERATED — Do not edit manually.
// Run: node scripts/bundle-extension.js
// Source: config/selectors.json

export const SELECTORS_JSON = ${selectorsRaw.trim()};
export default SELECTORS_JSON;
`;

  fs.writeFileSync(SELECTORS_OUTPUT, selectorsModule, 'utf8');
  console.log(`[Bundle] ✅ Selectors written to: ${path.relative(process.cwd(), SELECTORS_OUTPUT)}`);

  // ── 2. Read CSS (optional — inject as <style> tag) ──
  const cssContent = readFile(CSS_FILE);
  let cssInjection = '';
  if (cssContent) {
    // Escape backticks and backslashes for safe embedding in template literal
    const escapedCss = cssContent
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$/g, '\\$');
    cssInjection = `
// ── Inject FlirtEasy Status Bar CSS ──
(function() {
  var style = document.createElement('style');
  style.setAttribute('data-flirteasy', 'status-bar');
  style.textContent = \`${escapedCss}\`;
  (document.head || document.documentElement).appendChild(style);
})();
`;
    console.log(`[Bundle] ✅ CSS bundled: ${CSS_FILE} (${cssContent.length} bytes)`);
  }

  // ── 3. Read and concatenate all content scripts ──
  const scriptParts = [];
  let totalSize = 0;

  for (const scriptPath of CONTENT_SCRIPTS) {
    const content = readFile(scriptPath);
    if (!content) continue;

    // Wrap each script in a labeled block for debugging
    scriptParts.push(`
// ═══════════════════════════════════════════════════════════════
// [FlirtEasy Bundle] ${scriptPath}
// ═══════════════════════════════════════════════════════════════
${content}
`);

    totalSize += content.length;
    console.log(`[Bundle] ✅ Bundled: ${scriptPath} (${content.length} bytes)`);
  }

  const bundledScripts = scriptParts.join('\n');

  // Wrap all content scripts in a safe IIFE with re-entry guard
  const bundle = `
(function() {
  if (window.__flirtEasyBundleLoaded) {
    console.log('[FlirtEasy] Bundle already active on this page');
    return;
  }
  window.__flirtEasyBundleLoaded = true;
  console.log('[FlirtEasy] Injected Full Content Script Bundle (On-Device Mode)');

  ${cssInjection}

  ${bundledScripts}
})();
true;
`;

  // ── 4. Write the bundle module ──
  // We JSON.stringify the bundle to create a safe string literal,
  // then export it. This handles all escaping (backticks, quotes, etc.)
  const moduleContent = `// AUTO-GENERATED — Do not edit manually.
// Run: node scripts/bundle-extension.js
// Total content scripts: ${CONTENT_SCRIPTS.length}
// Total size: ${totalSize} bytes (before CSS)
// Generated: ${new Date().toISOString()}

export const CONTENT_SCRIPT_BUNDLE = ${JSON.stringify(bundle)};
export default CONTENT_SCRIPT_BUNDLE;
`;

  fs.writeFileSync(OUTPUT_FILE, moduleContent, 'utf8');

  console.log('');
  console.log(`[Bundle] ✅ Bundle written to: ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`[Bundle] Total scripts: ${CONTENT_SCRIPTS.length}`);
  console.log(`[Bundle] Total JS size: ${(totalSize / 1024).toFixed(1)} KB`);
  console.log(`[Bundle] Output module size: ${(moduleContent.length / 1024).toFixed(1)} KB`);
  console.log('[Bundle] Done.');
}

main();
