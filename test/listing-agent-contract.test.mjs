// Merge-safety contract test for the AI Listing Agent fork.
// Asserts (1) every owned path exists, (2) chrome/firefox copies are byte-identical,
// and (3) every declared touchpoint still contains its integration hook.
// Run: node test/listing-agent-contract.test.mjs
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const contract = JSON.parse(
  readFileSync(path.join(__dirname, 'listing-agent-contract.json'), 'utf8')
);

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('✓ ' + name);
  } catch (e) {
    failed++;
    console.error('✗ ' + name + '\n  ' + e.message);
  }
}

// 1. Owned paths must all exist.
for (const rel of contract.ownedPaths) {
  check(`owned path exists: ${rel}`, () => {
    assert.ok(existsSync(path.join(ROOT, rel)), `missing owned path: ${rel}`);
  });
}

// 2. Chrome/Firefox mirrored copies must be byte-identical.
for (const [chromeRel, firefoxRel] of contract.mirroredPairs) {
  check(`parity: ${chromeRel} == ${firefoxRel}`, () => {
    const a = readFileSync(path.join(ROOT, chromeRel));
    const b = readFileSync(path.join(ROOT, firefoxRel));
    assert.ok(a.equals(b), `chrome/firefox copies differ: ${chromeRel}`);
  });
}

// 3. Touchpoints must still contain their integration hooks after any upstream merge.
for (const tp of contract.touchpoints) {
  check(`touchpoint: ${tp.file}`, () => {
    assert.ok(existsSync(path.join(ROOT, tp.file)), `missing touchpoint file: ${tp.file}`);
    const src = readFileSync(path.join(ROOT, tp.file), 'utf8');
    for (const needle of tp.mustContain) {
      assert.ok(src.includes(needle), `touchpoint ${tp.file} missing hook: ${needle}`);
    }
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
