#!/usr/bin/env node
// Static safety check for UI refactors: parse errors, duplicate declarations, references to
// identifiers that are not declared/imported (e.g. a removed import) and styles.X keys missing from StyleSheet.create.
// Usage: node scripts/ui-check.js [files...]   (defaults to every .js file under src/)
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// Known pre-existing issue kept out of UI scope: BrowserScreen calls destroyOnDeviceWorker without importing it.
// SettingsPanel only calls getTinderAuthState/subscribeTinderAuthState inside a typeof guard.
const ALLOW = new Set(['src/screens/BrowserScreen.js:destroyOnDeviceWorker', 'src/components/dashboard/SettingsPanel.js:subscribeTinderAuthState', 'src/components/dashboard/SettingsPanel.js:getTinderAuthState']);
const GLOBALS = new Set(`
undefined NaN Infinity globalThis window document navigator console setTimeout clearTimeout setInterval clearInterval
requestAnimationFrame cancelAnimationFrame queueMicrotask setImmediate clearImmediate fetch AbortController URL URLSearchParams
Headers Request Response FormData Blob FileReader TextEncoder TextDecoder atob btoa crypto performance WebSocket XMLHttpRequest
Object Array String Number Boolean Symbol BigInt Math Date JSON RegExp Error TypeError RangeError SyntaxError ReferenceError
Promise Map Set WeakMap WeakSet Proxy Reflect Intl parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent
encodeURI decodeURI escape unescape eval arguments require module exports process global __DEV__ __dirname __filename
describe it test expect jest beforeEach afterEach beforeAll afterAll HTMLElement Element Node Event CustomEvent MutationObserver
location history localStorage sessionStorage alert confirm getComputedStyle Image screen chrome structuredClone ErrorUtils
`.split(/\s+/).filter(Boolean));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['node_modules', '__mocks__'].includes(entry.name)) walk(full, out); }
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const root = path.join(__dirname, '..');
const files = process.argv.slice(2).length ? process.argv.slice(2) : walk(path.join(root, 'src'));
let problems = 0;
for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'], errorRecovery: false });
  } catch (error) {
    problems++; console.log(`${path.relative(root, file)}: PARSE ${error.message}`); continue;
  }
  const seen = new Set();
  // Collect StyleSheet.create({...}) keys per binding name so missing style references are caught.
  const sheets = {};
  traverse(ast, {
    VariableDeclarator(p) {
      const init = p.node.init;
      if (p.node.id.type === 'Identifier' && init?.type === 'CallExpression' && init.callee.type === 'MemberExpression'
        && init.callee.object.name === 'StyleSheet' && init.callee.property.name === 'create' && init.arguments[0]?.type === 'ObjectExpression') {
        const props = init.arguments[0].properties;
        if (props.some(prop => prop.type === 'SpreadElement')) return;
        sheets[p.node.id.name] = new Set(props.map(prop => prop.key?.name ?? prop.key?.value));
      }
    },
  });
  traverse(ast, {
    MemberExpression(p) {
      const { object, property, computed } = p.node;
      if (computed || object.type !== 'Identifier' || !sheets[object.name] || property.type !== 'Identifier') return;
      if (sheets[object.name].has(property.name)) return;
      problems++; console.log(`${path.relative(root, file)}:${p.node.loc?.start.line} missing style '${object.name}.${property.name}'`);
    },
  });
  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      if (p.isJSXIdentifier() && /^[a-z]/.test(name)) return; // intrinsic JSX tags
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.property === p.node) return;
      if (p.parentPath.isUnaryExpression({ operator: 'typeof' })) return; // guarded existence checks
      if (GLOBALS.has(name) || p.scope.hasBinding(name, true)) return;
      if (ALLOW.has(`${path.relative(root, file).split(path.sep).join('/')}:${name}`)) return;
      const key = `${name}:${p.node.loc?.start.line}`;
      if (seen.has(key)) return; seen.add(key);
      problems++; console.log(`${path.relative(root, file)}:${p.node.loc?.start.line} undefined identifier '${name}'`);
    },
  });
}
console.log(problems ? `\n${problems} problem(s) in ${files.length} file(s)` : `OK — ${files.length} file(s) clean`);
process.exit(problems ? 1 : 0);
