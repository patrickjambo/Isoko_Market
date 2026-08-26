#!/usr/bin/env node
/**
 * Rule 7 (performance / low-bandwidth) budget gate.
 *
 * "Usable on a throttled 3G connection" is only real if the JavaScript a user
 * must download stays small. This runs the PRODUCTION build (dev bundles are
 * unminified and meaningless) and asserts:
 *   • the First-Load JS shared by every route stays under SHARED_BUDGET_KB;
 *   • no single route's First-Load JS exceeds ROUTE_BUDGET_KB.
 * It fails (exit 1) if either budget is exceeded, so a bundle regression that
 * would hurt 3G users breaks CI.
 */
import { execSync } from 'node:child_process';

const SHARED_BUDGET_KB = 110; // shared baseline (README cites ~87 kB)
const ROUTE_BUDGET_KB = 260; // heaviest single route's First-Load JS

const stripAnsi = (s) => s.replace(/\[[0-9;]*m/g, '');

console.log('▶ Building for the performance budget check (production)…');
let out;
try {
  out = execSync('npx next build', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
} catch (e) {
  out = stripAnsi(String(e.stdout ?? ''));
}
out = stripAnsi(out);

// Shared baseline: "+ First Load JS shared by all   87.5 kB"
const sharedMatch = out.match(/First Load JS shared by all\s+([\d.]+)\s*kB/);
if (!sharedMatch) {
  console.error('✗ Could not find the shared First-Load JS line in the build output.');
  process.exit(1);
}
const sharedKb = parseFloat(sharedMatch[1]);

// Per-route First-Load JS is the LAST "N kB" on each route row (○/●/ƒ marker).
const routeKbs = [];
for (const line of out.split('\n')) {
  if (!/[○●ƒλ]\s+\//.test(line)) continue;
  const kbs = [...line.matchAll(/([\d.]+)\s*kB/g)].map((m) => parseFloat(m[1]));
  if (kbs.length) routeKbs.push(kbs[kbs.length - 1]);
}
const maxRouteKb = routeKbs.length ? Math.max(...routeKbs) : 0;

const pass = (label, value, budget) => {
  const ok = value <= budget;
  console.log(`${ok ? '✅' : '❌'} ${label}: ${value.toFixed(1)} kB  (budget ${budget} kB)`);
  return ok;
};

console.log('\n— Low-bandwidth (3G) JS budget —');
const a = pass('Shared First-Load JS', sharedKb, SHARED_BUDGET_KB);
const b = maxRouteKb ? pass('Heaviest route First-Load JS', maxRouteKb, ROUTE_BUDGET_KB) : true;
if (!maxRouteKb) console.log('ℹ️  (could not parse per-route sizes; enforcing shared baseline only)');

if (a && b) {
  console.log('\n✓ Within the 3G performance budget.');
  process.exit(0);
}
console.error('\n✗ Over the 3G performance budget — trim JS before shipping.');
process.exit(1);
