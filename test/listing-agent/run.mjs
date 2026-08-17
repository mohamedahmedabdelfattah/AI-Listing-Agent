// Standalone unit-test runner for the AI Listing Agent pure modules.
// Owned entry point; grows one block per feature plan. Impure modules
// (persistence.js, listings.js, *.html) are intentionally excluded — they are
// covered by the fixtures/browser suite.
// Run: node test/listing-agent/run.mjs
import { strict as assert } from 'node:assert';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// Import an owned module by repo-relative path (works for chrome or firefox copies).
function load(rel) {
  return import(pathToFileURL(path.join(ROOT, rel)).href);
}

// --- Foundation smoke tests -------------------------------------------------
// Every pure owned module must be importable in Node (no top-level DOM/browser refs).
const PURE_MODULES = [
  'src/chrome/src/agent/listing-agent/mission.js',
  'src/chrome/src/agent/listing-agent/filter-planner.js',
  'src/chrome/src/agent/listing-agent/detection.js',
  'src/chrome/src/agent/listing-agent/extraction.js',
  'src/chrome/src/agent/listing-agent/evidence.js',
  'src/chrome/src/agent/listing-agent/requirements.js',
  'src/chrome/src/agent/listing-agent/ranking.js',
  'src/chrome/src/agent/listing-agent/dedup.js',
  'src/chrome/src/agent/listing-agent/progress.js',
  'src/chrome/src/agent/listing-agent/controller.js',
  'src/chrome/src/agent/listing-agent/research-skill.js',
  'src/chrome/src/agent/listing-agent/export.js',
  'src/chrome/src/ui/research-command.js',
];

for (const rel of PURE_MODULES) {
  test(`imports: ${rel}`, async () => {
    const mod = await load(rel);
    assert.ok(mod && typeof mod === 'object', `no exports from ${rel}`);
  });
}

// progress.DEFAULT_LIMITS is real data at Foundation — assert its shape.
test('progress.DEFAULT_LIMITS has the design §9 limit keys', async () => {
  const { DEFAULT_LIMITS } = await load('src/chrome/src/agent/listing-agent/progress.js');
  for (const k of ['maxDurationMs', 'maxPages', 'maxListings', 'noProgressPageThreshold']) {
    assert.ok(k in DEFAULT_LIMITS, `DEFAULT_LIMITS missing ${k}`);
  }
});

// --- run --------------------------------------------------------------------
let passed = 0;
let failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    passed++;
    console.log('✓ ' + t.name);
  } catch (e) {
    failed++;
    console.error('✗ ' + t.name + '\n  ' + (e && e.stack ? e.stack : e));
  }
}
console.log(`\n${passed} passed, ${failed} failed (${tests.length} total)`);
process.exit(failed > 0 ? 1 : 0);
