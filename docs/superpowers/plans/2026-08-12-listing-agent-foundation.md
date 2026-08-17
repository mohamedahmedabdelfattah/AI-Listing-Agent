# AI Listing Agent — Foundation Plan (Merge-Safety Harness + Module Skeleton + Owned-Paths Contract)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the fork's structural foundation — a merge-safety regression harness, an empty-but-complete module skeleton for every file the Listing Agent will own, and a machine-checked owned-paths contract — so that every subsequent feature plan starts from a green baseline that provably still merges cleanly with upstream WebBrain.

**Architecture:** This is a fork of WebBrain (a browser extension with duplicated `src/chrome/` and `src/firefox/` source trees, native ESM, no bundler). The guiding constraint is **"new files only, zero merge risk"**: all Listing Agent logic lives in new owned files under `src/<build>/src/agent/listing-agent/` and `src/<build>/src/ui/`, and upstream files are touched only at a tiny, contract-tracked set of integration points. The research loop is **model-driven** — a skill/prompt (`research-skill.js`) steers the existing agent loop through existing tools; there is **no** deterministic background driver and therefore **no `background.js` touchpoint**. The deterministic domain logic (mission parsing, requirement evaluation, ranking, dedup, evidence, progress, export) lives in pure, Node-importable modules that post-process the model's extracted output and are unit-tested directly. This Foundation plan creates only stubs (functions that `throw new Error('NotImplemented: …')`) plus the test harness; feature plans fill the stubs one phase at a time.

**Tech Stack:** JavaScript (native browser ESM), Node.js test runners (plain `node:assert` + hand-rolled harness, matching the repo's existing `test/run.js` idiom), Git worktrees for merge rehearsal, IndexedDB for persistence (browser-only, not exercised in this plan).

---

## Design references

This plan implements the pre-feature readiness checkpoint mandated by the design doc:

- **§2 — Fork integration / touchpoints:** upstream files are edited only at precedented seams.
- **§13.7–§13.8 — Merge-safety testing:** a contract test (owned paths + touchpoints + hooks exist) and a merge-rehearsal test (`git merge upstream/main` in a disposable worktree must not conflict).
- **§15A — Readiness gate:** "Add the merge-safety regression harness BEFORE feature implementation." This plan is that step.

**Controller decision (user-selected):** the research controller is a **model-driven skill**, not a deterministic JS driver. Consequence for this plan: `background.js` is **not** a touchpoint; `controller.js` is a thin pure orchestrator (dependency-injected) that builds the skill prompt and post-processes model output; `research-skill.js` (the prompt builder) is a new owned module.

---

## File Structure

### Owned files — created as stubs in this plan (duplicated byte-for-byte into `src/firefox/`)

Domain modules — `src/chrome/src/agent/listing-agent/` (all **pure**: no DOM, no browser globals at module top level, Node-importable):

| File | Responsibility | Canonical exports |
|------|----------------|-------------------|
| `mission.js` | Parse free-text objective → structured `ResearchMission` | `parseMission(objective, ctx)`, `validateMission(mission)` |
| `filter-planner.js` | Map mission requirements → site filter plan | `planFilters(mission, capabilities)` |
| `detection.js` | Identify listing collections / boundaries from page model + JSON-LD | `extractJsonLdListings(html)`, `detectCollections(pageModel)`, `detectListingBoundaries(collection)` |
| `extraction.js` | Two-pass normalization of raw candidates → canonical `Listing` | `normalizeCandidate(raw, ctx)`, `mergeDetail(candidate, detail)` |
| `evidence.js` | Build evidence records; aggregate confidence | `makeEvidence(fields)`, `aggregateConfidence(listing, mission)` |
| `requirements.js` | Lenient eligibility evaluation (PASS/FAIL/UNKNOWN) | `evaluateRequirement(requirement, listing)`, `evaluateListing(listing, mission, opts)` |
| `ranking.js` | Transparent ranking score + breakdown | `computeRanking(listing, mission)` |
| `dedup.js` | Level 1–2 duplicate detection | `sourceListingId(listing)`, `isDuplicate(a, b)`, `dedupeListings(listings)` |
| `progress.js` | Loop limits + no-progress / termination tracking | `DEFAULT_LIMITS`, `createProgressTracker(limits)` |
| `controller.js` | Model-driven orchestrator: build skill prompt, post-process model output through the pure pipeline (dependency-injected) | `createResearchController(deps)` |
| `research-skill.js` | Build the research skill/system prompt that drives the model | `buildResearchSkillPrompt(mission, limits)` |
| `export.js` | Serialize results to JSON / CSV | `listingsToJson(job, listings)`, `listingsToCsv(listings)` |
| `persistence.js` | IndexedDB read/write (**browser-only**, excluded from the Node unit runner) | `DB_NAME`, `saveMission`, `saveJob`, `saveListing`, `saveListings`, `listListings`, `getJob`, `listJobs`, `deleteJob`, `clearAll` |

UI — `src/chrome/src/ui/`:

| File | Responsibility | Notes |
|------|----------------|-------|
| `research-command.js` | Pure parser for the `/research` slash command | **pure**, Node-importable; mirrors `watch-command.js` |
| `listings.html` | Listing Workspace page shell | browser-only |
| `listings.js` | Listing Workspace logic | browser-only, excluded from Node unit runner |

Test / merge-safety files — repo-level, **not** duplicated per build:

| File | Responsibility |
|------|----------------|
| `test/listing-agent-contract.json` | The owned-paths + mirrored-pairs + touchpoints manifest |
| `test/listing-agent-contract.test.mjs` | Asserts owned paths exist, chrome/firefox parity, touchpoint hooks present |
| `test/listing-agent/run.mjs` | Standalone unit runner for pure owned modules (grows per feature plan) |
| `test/listing-agent-merge-rehearsal.test.mjs` | Rehearses `git merge upstream/main` in a disposable worktree; fails on conflict |

### Upstream files touched in this plan (contract-tracked touchpoints)

| File | Change | Why it's low-risk |
|------|--------|-------------------|
| `package.json` | Append 3 new `scripts` keys; append `&& npm run test:contract && npm run test:listing-agent` to the `test` script | New keys don't conflict; the single-line `test` edit is itself covered by the merge-rehearsal gate |

The other precedented touchpoints (`settings.html` link to `listings.html`, `sidepanel.js` `/research` slash command) are **not** part of this plan — they are added by the UI and Controller feature plans, which will each also append their entry to `test/listing-agent-contract.json`.

---

## Task 1: Verify clean baseline

**Files:** none (verification only)

- [ ] **Step 1: Run the existing suite to confirm a green starting point**

Run:
```bash
npm test
```
Expected: ends with a passing summary and exit code 0 (the repo's `test:toolbar-guard`, `test/run.js`, and `test:security` all pass). If anything fails here, STOP and report — do not build on a red baseline.

---

## Task 2: Contract manifest + failing contract test

**Files:**
- Create: `test/listing-agent-contract.json`
- Create: `test/listing-agent-contract.test.mjs`

- [ ] **Step 1: Write the contract manifest**

Create `test/listing-agent-contract.json`:

```json
{
  "description": "Owned-paths + merge-safety contract for the AI Listing Agent fork. Feature plans append touchpoints as they wire upstream files.",
  "ownedPaths": [
    "src/chrome/src/agent/listing-agent/mission.js",
    "src/chrome/src/agent/listing-agent/filter-planner.js",
    "src/chrome/src/agent/listing-agent/detection.js",
    "src/chrome/src/agent/listing-agent/extraction.js",
    "src/chrome/src/agent/listing-agent/evidence.js",
    "src/chrome/src/agent/listing-agent/requirements.js",
    "src/chrome/src/agent/listing-agent/ranking.js",
    "src/chrome/src/agent/listing-agent/dedup.js",
    "src/chrome/src/agent/listing-agent/progress.js",
    "src/chrome/src/agent/listing-agent/controller.js",
    "src/chrome/src/agent/listing-agent/research-skill.js",
    "src/chrome/src/agent/listing-agent/export.js",
    "src/chrome/src/agent/listing-agent/persistence.js",
    "src/chrome/src/ui/research-command.js",
    "src/chrome/src/ui/listings.html",
    "src/chrome/src/ui/listings.js"
  ],
  "mirroredPairs": [
    ["src/chrome/src/agent/listing-agent/mission.js", "src/firefox/src/agent/listing-agent/mission.js"],
    ["src/chrome/src/agent/listing-agent/filter-planner.js", "src/firefox/src/agent/listing-agent/filter-planner.js"],
    ["src/chrome/src/agent/listing-agent/detection.js", "src/firefox/src/agent/listing-agent/detection.js"],
    ["src/chrome/src/agent/listing-agent/extraction.js", "src/firefox/src/agent/listing-agent/extraction.js"],
    ["src/chrome/src/agent/listing-agent/evidence.js", "src/firefox/src/agent/listing-agent/evidence.js"],
    ["src/chrome/src/agent/listing-agent/requirements.js", "src/firefox/src/agent/listing-agent/requirements.js"],
    ["src/chrome/src/agent/listing-agent/ranking.js", "src/firefox/src/agent/listing-agent/ranking.js"],
    ["src/chrome/src/agent/listing-agent/dedup.js", "src/firefox/src/agent/listing-agent/dedup.js"],
    ["src/chrome/src/agent/listing-agent/progress.js", "src/firefox/src/agent/listing-agent/progress.js"],
    ["src/chrome/src/agent/listing-agent/controller.js", "src/firefox/src/agent/listing-agent/controller.js"],
    ["src/chrome/src/agent/listing-agent/research-skill.js", "src/firefox/src/agent/listing-agent/research-skill.js"],
    ["src/chrome/src/agent/listing-agent/export.js", "src/firefox/src/agent/listing-agent/export.js"],
    ["src/chrome/src/agent/listing-agent/persistence.js", "src/firefox/src/agent/listing-agent/persistence.js"],
    ["src/chrome/src/ui/research-command.js", "src/firefox/src/ui/research-command.js"],
    ["src/chrome/src/ui/listings.html", "src/firefox/src/ui/listings.html"],
    ["src/chrome/src/ui/listings.js", "src/firefox/src/ui/listings.js"]
  ],
  "touchpoints": []
}
```

- [ ] **Step 2: Write the contract test**

Create `test/listing-agent-contract.test.mjs`:

```js
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
```

- [ ] **Step 3: Run the contract test to verify it fails**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: FAIL. Every `owned path exists: …` and `parity: …` check reports `✗` because no stub files exist yet, and the process exits 1. This is the intended red state.

- [ ] **Step 4: Commit**

```bash
git add test/listing-agent-contract.json test/listing-agent-contract.test.mjs
git commit -m "test: add listing-agent owned-paths contract (red)"
```

---

## Task 3: Create the module skeleton (all owned stubs, both builds)

**Files:**
- Create (chrome, then mirror to firefox): all 16 owned files listed in the contract.

Each pure module defines its canonical exports as functions that throw `NotImplemented`; data-only constants (`DEFAULT_LIMITS`, usage strings) carry real values from the spec because they are harmless and useful. Feature plans replace the `throw` bodies via TDD.

- [ ] **Step 1: Create `src/chrome/src/agent/listing-agent/mission.js`**

```js
// AI Listing Agent — mission parsing (pure; no DOM/browser globals).
// Parses a free-text research objective into a structured ResearchMission.
// Feature plan: Domain core. Design refs: §3 (data model), §10 (mission UX).

/**
 * @typedef {Object} Requirement
 * @property {string} id         stable slug, e.g. "furnished"
 * @property {string} attribute  canonical attribute name
 * @property {string} operator   "eq"|"gte"|"lte"|"in"|"exists"|"not"
 * @property {*}      value
 * @property {string} raw        original phrase from the objective
 */

/**
 * @typedef {Object} ResearchMission
 * @property {string}        objective
 * @property {Requirement[]} mandatory
 * @property {Requirement[]} preferred
 * @property {Requirement[]} exclusions
 * @property {string}        sourceDomain
 * @property {Object}        options
 */

/**
 * Parse a free-text objective into a structured mission.
 * @param {string} objective
 * @param {{ sourceDomain?: string, options?: Object }} [ctx]
 * @returns {ResearchMission}
 */
export function parseMission(objective, ctx = {}) {
  throw new Error('NotImplemented: parseMission');
}

/**
 * Validate a mission object.
 * @param {ResearchMission} mission
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateMission(mission) {
  throw new Error('NotImplemented: validateMission');
}
```

- [ ] **Step 2: Create `src/chrome/src/agent/listing-agent/filter-planner.js`**

```js
// AI Listing Agent — filter planning (pure).
// Maps mission requirements onto a site's advertised filter capabilities.
// Feature plan: Domain core. Design refs: §4.2.

/**
 * Produce a filter plan from a mission and the site's filter capabilities.
 * @param {import('./mission.js').ResearchMission} mission
 * @param {Array<{ attribute: string, type: string, values?: any[] }>} capabilities
 * @returns {{ filters: Array<{ attribute: string, value: any }>, unmapped: import('./mission.js').Requirement[] }}
 */
export function planFilters(mission, capabilities) {
  throw new Error('NotImplemented: planFilters');
}
```

- [ ] **Step 3: Create `src/chrome/src/agent/listing-agent/detection.js`**

```js
// AI Listing Agent — collection/listing detection (pure).
// Level 0 = JSON-LD, Levels 1-2 = structural/model-derived boundaries.
// Feature plan: Detection. Design refs: §4.1.

/**
 * Extract listing-shaped entities from JSON-LD embedded in page HTML.
 * @param {string} html
 * @returns {Array<Object>}
 */
export function extractJsonLdListings(html) {
  throw new Error('NotImplemented: extractJsonLdListings');
}

/**
 * Detect candidate result collections from a normalized page model.
 * @param {Object} pageModel
 * @returns {Array<Object>}
 */
export function detectCollections(pageModel) {
  throw new Error('NotImplemented: detectCollections');
}

/**
 * Detect per-listing boundaries within one collection.
 * @param {Object} collection
 * @returns {Array<Object>}
 */
export function detectListingBoundaries(collection) {
  throw new Error('NotImplemented: detectListingBoundaries');
}
```

- [ ] **Step 4: Create `src/chrome/src/agent/listing-agent/extraction.js`**

```js
// AI Listing Agent — two-pass extraction/normalization (pure).
// Pass 1 normalizes list-card candidates; pass 2 merges detail-page data.
// Feature plan: Extraction. Design refs: §4.3.

/**
 * Normalize a raw candidate (list card or detail) into a partial canonical Listing.
 * @param {Object} raw
 * @param {{ pass?: 1|2, sourceUrl?: string }} [ctx]
 * @returns {Object}
 */
export function normalizeCandidate(raw, ctx = {}) {
  throw new Error('NotImplemented: normalizeCandidate');
}

/**
 * Merge pass-2 detail data into a pass-1 candidate, preferring higher-confidence evidence.
 * @param {Object} candidate
 * @param {Object} detail
 * @returns {Object}
 */
export function mergeDetail(candidate, detail) {
  throw new Error('NotImplemented: mergeDetail');
}
```

- [ ] **Step 5: Create `src/chrome/src/agent/listing-agent/evidence.js`**

```js
// AI Listing Agent — evidence model (pure).
// Feature plan: Extraction. Design refs: §5 (weighted average; mandatory attrs 2x).

/**
 * Build an evidence record for one extracted attribute.
 * @param {{ value: *, sourceText?: string, extractionMethod?: string, confidence?: number, verificationStatus?: string }} fields
 * @returns {Object}
 */
export function makeEvidence(fields) {
  throw new Error('NotImplemented: makeEvidence');
}

/**
 * Aggregate a listing's evidence into an overall confidence score (mandatory attrs weighted 2x).
 * @param {Object} listing
 * @param {import('./mission.js').ResearchMission} mission
 * @returns {number} 0..1
 */
export function aggregateConfidence(listing, mission) {
  throw new Error('NotImplemented: aggregateConfidence');
}
```

- [ ] **Step 6: Create `src/chrome/src/agent/listing-agent/requirements.js`**

```js
// AI Listing Agent — lenient eligibility evaluation (pure).
// Feature plan: Domain core. Design refs: §6 (PASS/FAIL/UNKNOWN_BLOCKED,
// strict_mandatory_unknown default false).

/**
 * Evaluate a single requirement against a listing.
 * @param {import('./mission.js').Requirement} requirement
 * @param {Object} listing
 * @returns {'PASS'|'FAIL'|'UNKNOWN'}
 */
export function evaluateRequirement(requirement, listing) {
  throw new Error('NotImplemented: evaluateRequirement');
}

/**
 * Evaluate a listing against a mission (lenient by default).
 * @param {Object} listing
 * @param {import('./mission.js').ResearchMission} mission
 * @param {{ strictMandatoryUnknown?: boolean }} [opts]
 * @returns {{ eligibility: 'PASS'|'FAIL'|'UNKNOWN_BLOCKED', perRequirement: Array<{ requirementId: string, status: 'PASS'|'FAIL'|'UNKNOWN' }> }}
 */
export function evaluateListing(listing, mission, opts = {}) {
  throw new Error('NotImplemented: evaluateListing');
}
```

- [ ] **Step 7: Create `src/chrome/src/agent/listing-agent/ranking.js`**

```js
// AI Listing Agent — transparent ranking (pure).
// Feature plan: Domain core. Design refs: §7 (explicit formula + breakdown).

/**
 * Compute a listing's ranking score and a human-readable breakdown.
 * @param {Object} listing
 * @param {import('./mission.js').ResearchMission} mission
 * @returns {{ score: number, breakdown: Array<{ factor: string, weight: number, contribution: number }> }}
 */
export function computeRanking(listing, mission) {
  throw new Error('NotImplemented: computeRanking');
}
```

- [ ] **Step 8: Create `src/chrome/src/agent/listing-agent/dedup.js`**

```js
// AI Listing Agent — duplicate detection (pure).
// Feature plan: Persistence. Design refs: §8 (levels 1-2).

/**
 * Derive a stable source listing id from a listing (Level 1 key).
 * @param {Object} listing
 * @returns {string|null}
 */
export function sourceListingId(listing) {
  throw new Error('NotImplemented: sourceListingId');
}

/**
 * Return the duplicate level between two listings (0 = distinct, 1 = same id, 2 = near-duplicate).
 * @param {Object} a
 * @param {Object} b
 * @returns {0|1|2}
 */
export function isDuplicate(a, b) {
  throw new Error('NotImplemented: isDuplicate');
}

/**
 * Partition listings into unique and duplicate sets.
 * @param {Object[]} listings
 * @returns {{ unique: Object[], duplicates: Array<{ listing: Object, duplicateOf: string, level: 1|2 }> }}
 */
export function dedupeListings(listings) {
  throw new Error('NotImplemented: dedupeListings');
}
```

- [ ] **Step 9: Create `src/chrome/src/agent/listing-agent/progress.js`**

```js
// AI Listing Agent — loop limits & progress tracking (pure).
// Feature plan: Controller. Design refs: §9 (limits, no-progress termination).

/** Default research loop limits (design §9). */
export const DEFAULT_LIMITS = Object.freeze({
  maxDurationMs: 10 * 60 * 1000, // 10 minutes
  maxPages: 20,
  maxListings: 300,
  noProgressPageThreshold: 2, // stop after N consecutive pages with no new unique listings
});

/**
 * Create a progress tracker for one research job.
 * @param {typeof DEFAULT_LIMITS} [limits]
 * @returns {{
 *   recordPage: (info: { newUnique: number, totalUnique: number, elapsedMs: number }) => void,
 *   snapshot: () => Object,
 *   shouldTerminate: () => { terminate: boolean, reason: string|null }
 * }}
 */
export function createProgressTracker(limits = DEFAULT_LIMITS) {
  throw new Error('NotImplemented: createProgressTracker');
}
```

- [ ] **Step 10: Create `src/chrome/src/agent/listing-agent/research-skill.js`**

```js
// AI Listing Agent — research skill prompt builder (pure).
// The research loop is MODEL-DRIVEN: this prompt instructs the existing agent
// loop how to page through results with existing tools, what to extract, which
// filters to apply, the exact structured output shape, and when to stop.
// Feature plan: Controller. Design refs: §4 (pipeline), §9 (limits), §10.

/**
 * Build the research skill/system prompt that steers the model.
 * @param {import('./mission.js').ResearchMission} mission
 * @param {typeof import('./progress.js').DEFAULT_LIMITS} limits
 * @returns {string}
 */
export function buildResearchSkillPrompt(mission, limits) {
  throw new Error('NotImplemented: buildResearchSkillPrompt');
}
```

- [ ] **Step 11: Create `src/chrome/src/agent/listing-agent/controller.js`**

```js
// AI Listing Agent — model-driven research controller (pure orchestrator).
// Dependency-injected so it stays Node-importable and unit-testable: it builds
// the skill prompt, starts a model-driven run via injected `startAgentRun`, and
// post-processes the model's extracted output through the pure pipeline
// (detection -> extraction -> evidence -> requirements -> ranking -> dedup),
// persisting via injected `persistence`. No background.js dependency.
// Feature plan: Controller. Design refs: §4, §9, §11.

/**
 * @typedef {Object} ControllerDeps
 * @property {(prompt: string, opts: Object) => Promise<Object>} startAgentRun  starts a model-driven agent run
 * @property {Object} persistence  the persistence module (or a compatible fake)
 * @property {() => number} now     injectable clock (ms); defaults to Date.now at call sites, not module load
 */

/**
 * Create a research controller bound to injected dependencies.
 * @param {ControllerDeps} deps
 * @returns {{ run: (mission: import('./mission.js').ResearchMission, options?: Object) => Promise<Object> }}
 */
export function createResearchController(deps) {
  throw new Error('NotImplemented: createResearchController');
}
```

- [ ] **Step 12: Create `src/chrome/src/agent/listing-agent/export.js`**

```js
// AI Listing Agent — result export (pure).
// Feature plan: Export. Design refs: §12 (JSON + CSV).

/**
 * Serialize a research job and its listings to a JSON string.
 * @param {Object} job
 * @param {Object[]} listings
 * @returns {string}
 */
export function listingsToJson(job, listings) {
  throw new Error('NotImplemented: listingsToJson');
}

/**
 * Serialize listings to a CSV string (RFC-4180 quoting).
 * @param {Object[]} listings
 * @returns {string}
 */
export function listingsToCsv(listings) {
  throw new Error('NotImplemented: listingsToCsv');
}
```

- [ ] **Step 13: Create `src/chrome/src/agent/listing-agent/persistence.js`**

```js
// AI Listing Agent — IndexedDB persistence (browser-only).
// Cloned wholesale from the recorder.js idiom with a distinct DB name.
// NOT imported by the Node unit runner; covered by the fixtures/browser suite.
// Feature plan: Persistence. Design refs: §3, §8.

export const DB_NAME = 'webbrain_listings';
export const DB_VERSION = 1;

export async function saveMission(mission) { throw new Error('NotImplemented: saveMission'); }
export async function saveJob(job) { throw new Error('NotImplemented: saveJob'); }
export async function saveListing(listing) { throw new Error('NotImplemented: saveListing'); }
export async function saveListings(listings) { throw new Error('NotImplemented: saveListings'); }
export async function listListings(jobId) { throw new Error('NotImplemented: listListings'); }
export async function getJob(jobId) { throw new Error('NotImplemented: getJob'); }
export async function listJobs() { throw new Error('NotImplemented: listJobs'); }
export async function deleteJob(jobId) { throw new Error('NotImplemented: deleteJob'); }
export async function clearAll() { throw new Error('NotImplemented: clearAll'); }
```

- [ ] **Step 14: Create `src/chrome/src/ui/research-command.js`**

```js
// AI Listing Agent — /research slash-command parser (pure).
// Mirrors the watch-command.js template. Failure => { ok:false, error, usage }.
// Feature plan: Controller/wiring. Design refs: §10.

export const RESEARCH_COMMAND_USAGE =
  '/research <objective> — research listings matching the objective on the current site';

/**
 * Parse a raw `/research ...` command string.
 * @param {string} value
 * @returns {{ ok: true, objective: string, flags: Object } | { ok: false, error: string, usage: string }}
 */
export function parseResearchSlashCommand(value) {
  throw new Error('NotImplemented: parseResearchSlashCommand');
}
```

- [ ] **Step 15: Create `src/chrome/src/ui/listings.html`**

```html
<!doctype html>
<!-- AI Listing Agent — Listing Workspace (stub). Feature plan: UI. Design refs: §11. -->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Listing Workspace</title>
  </head>
  <body>
    <main id="listing-workspace"><!-- populated by the UI feature plan --></main>
    <script src="listings.js" type="module"></script>
  </body>
</html>
```

- [ ] **Step 16: Create `src/chrome/src/ui/listings.js`**

```js
// AI Listing Agent — Listing Workspace logic (browser-only, stub).
// NOT imported by the Node unit runner. Feature plan: UI. Design refs: §11-§12.
export const LISTINGS_UI_READY = false;
```

- [ ] **Step 17: Mirror every owned file into the firefox build (byte-identical)**

Run:
```bash
mkdir -p src/firefox/src/agent/listing-agent
cp src/chrome/src/agent/listing-agent/mission.js src/chrome/src/agent/listing-agent/filter-planner.js src/chrome/src/agent/listing-agent/detection.js src/chrome/src/agent/listing-agent/extraction.js src/chrome/src/agent/listing-agent/evidence.js src/chrome/src/agent/listing-agent/requirements.js src/chrome/src/agent/listing-agent/ranking.js src/chrome/src/agent/listing-agent/dedup.js src/chrome/src/agent/listing-agent/progress.js src/chrome/src/agent/listing-agent/controller.js src/chrome/src/agent/listing-agent/research-skill.js src/chrome/src/agent/listing-agent/export.js src/chrome/src/agent/listing-agent/persistence.js src/firefox/src/agent/listing-agent/
cp src/chrome/src/ui/research-command.js src/chrome/src/ui/listings.html src/chrome/src/ui/listings.js src/firefox/src/ui/
```
Expected: no output, exit 0. (`src/firefox/src/ui/` already exists in the mirror; only the `listing-agent/` subdir is new.)

- [ ] **Step 18: Run the contract test to verify it now passes**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS. All `owned path exists: …` and `parity: …` checks print `✓`, the touchpoints section is empty, summary reads `32 passed, 0 failed` (16 owned-path + 16 parity checks), exit 0.

- [ ] **Step 19: Commit**

```bash
git add src/chrome/src/agent/listing-agent src/firefox/src/agent/listing-agent src/chrome/src/ui/research-command.js src/chrome/src/ui/listings.html src/chrome/src/ui/listings.js src/firefox/src/ui/research-command.js src/firefox/src/ui/listings.html src/firefox/src/ui/listings.js
git commit -m "feat: scaffold listing-agent module skeleton (chrome+firefox stubs)"
```

---

## Task 4: Standalone unit runner for pure modules

**Files:**
- Create: `test/listing-agent/run.mjs`

- [ ] **Step 1: Write the unit runner with a Foundation smoke test**

Create `test/listing-agent/run.mjs`:

```js
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
```

- [ ] **Step 2: Run the unit runner to verify it passes**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. 13 `imports: …` checks plus the `DEFAULT_LIMITS` check print `✓`; summary `14 passed, 0 failed (14 total)`, exit 0. (Importing a stub only evaluates its top level; the `throw`-ing bodies are never called here.)

- [ ] **Step 3: Commit**

```bash
git add test/listing-agent/run.mjs
git commit -m "test: add listing-agent unit runner with foundation smoke tests"
```

---

## Task 5: Wire package.json scripts

**Files:**
- Modify: `package.json` (the `test` script on line 8; append 3 new `scripts` keys)
- Modify: `test/listing-agent-contract.json` (add the `package.json` touchpoint)

- [ ] **Step 1: Append the new script keys**

In `package.json`, inside `"scripts"`, add these three keys immediately after the existing `"test:anonymous"` line:

```json
    "test:contract": "node test/listing-agent-contract.test.mjs",
    "test:listing-agent": "node test/listing-agent/run.mjs",
    "test:merge-safety": "npm run test:contract && npm run test:listing-agent && node test/listing-agent-merge-rehearsal.test.mjs",
```

After the edit, that region of `"scripts"` reads:

```json
    "test:anonymous": "node test/anonymous/run.mjs",
    "test:contract": "node test/listing-agent-contract.test.mjs",
    "test:listing-agent": "node test/listing-agent/run.mjs",
    "test:merge-safety": "npm run test:contract && npm run test:listing-agent && node test/listing-agent-merge-rehearsal.test.mjs",
    "test:ci": "node ci/test.mjs && node ci/cloud-capture.test.mjs",
```

- [ ] **Step 2: Chain the fast listing-agent checks into `npm test`**

Change the `"test"` script (line 8) from:

```json
    "test": "npm run test:toolbar-guard && node test/run.js && npm run test:security",
```

to:

```json
    "test": "npm run test:toolbar-guard && node test/run.js && npm run test:security && npm run test:contract && npm run test:listing-agent",
```

(The merge-rehearsal test is deliberately **not** chained here — it touches the network and creates a git worktree, so it belongs in the on-demand `test:merge-safety` gate, not every unit run.)

- [ ] **Step 3: Record `package.json` as a tracked touchpoint**

In `test/listing-agent-contract.json`, replace `"touchpoints": []` with:

```json
  "touchpoints": [
    {
      "file": "package.json",
      "mustContain": [
        "test/listing-agent-contract.test.mjs",
        "test/listing-agent/run.mjs",
        "npm run test:contract",
        "npm run test:listing-agent"
      ]
    }
  ]
```

- [ ] **Step 4: Run the contract test to verify the new touchpoint passes**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS, now with a `✓ touchpoint: package.json` line; summary `33 passed, 0 failed`, exit 0.

- [ ] **Step 5: Run the full `npm test` to verify the chain is green end-to-end**

Run:
```bash
npm test
```
Expected: the existing suite passes, then the contract test and the listing-agent unit runner both pass; overall exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json test/listing-agent-contract.json
git commit -m "build: register listing-agent test scripts and package.json touchpoint"
```

---

## Task 6: Merge-rehearsal test

**Files:**
- Create: `test/listing-agent-merge-rehearsal.test.mjs`

- [ ] **Step 1: Write the merge-rehearsal test**

Create `test/listing-agent-merge-rehearsal.test.mjs`:

```js
// Merge-safety rehearsal: proves the fork still merges cleanly with upstream.
// Creates a disposable DETACHED-HEAD worktree (so it never fights the branch
// checked out here), attempts a no-commit merge of upstream/main, and fails on
// conflict. If upstream is unreachable/unresolvable, it SKIPS (never a false
// CI failure when offline). Never touches the real working tree.
// Run: node test/listing-agent-merge-rehearsal.test.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const UPSTREAM_REF = process.env.LISTING_AGENT_UPSTREAM_REF || 'upstream/main';

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function gitQuiet(args) {
  try {
    return { ok: true, out: git(args) };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || ''), status: e.status };
  }
}

let failed = 0;
function fail(msg) {
  failed++;
  console.error('✗ ' + msg);
}
function pass(msg) {
  console.log('✓ ' + msg);
}

// Best-effort fetch; offline is fine as long as a local remote-tracking ref exists.
const fetched = gitQuiet(['fetch', '--quiet', 'upstream', 'main']);
if (!fetched.ok) {
  console.warn('  (warning) could not fetch upstream/main; will use local remote-tracking ref if present');
}

const head = gitQuiet(['rev-parse', 'HEAD']);
if (!head.ok) {
  fail('cannot resolve HEAD');
  console.log('\n1 failed');
  process.exit(1);
}

const upstream = gitQuiet(['rev-parse', '--verify', UPSTREAM_REF]);
if (!upstream.ok) {
  console.warn(`  (skip) ${UPSTREAM_REF} not available; merge rehearsal skipped`);
  console.log('\n0 failed (skipped)');
  process.exit(0);
}

const dir = mkdtempSync(path.join(os.tmpdir(), 'la-merge-'));
let added = false;
try {
  git(['worktree', 'add', '--detach', dir, head.out]);
  added = true;
  // May leave staged changes (clean) or unmerged paths (conflict).
  gitQuiet(['-C', dir, 'merge', '--no-commit', '--no-ff', UPSTREAM_REF]);
  const conflicts = gitQuiet(['-C', dir, 'ls-files', '-u']);
  const hasConflict = conflicts.ok && conflicts.out.trim().length > 0;
  // Always unwind the in-progress merge before removing the worktree.
  gitQuiet(['-C', dir, 'merge', '--abort']);
  gitQuiet(['-C', dir, 'reset', '--hard']);
  if (hasConflict) {
    fail(`merge with ${UPSTREAM_REF} conflicts (unmerged paths):\n${conflicts.out}`);
  } else {
    pass(`merges cleanly with ${UPSTREAM_REF}`);
  }
} catch (e) {
  fail(`merge rehearsal error: ${e && e.message ? e.message : e}`);
} finally {
  if (added) gitQuiet(['worktree', 'remove', '--force', dir]);
  else rmSync(dir, { recursive: true, force: true });
  gitQuiet(['worktree', 'prune']);
}

console.log(`\n${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run the merge-rehearsal test directly**

Run:
```bash
node test/listing-agent-merge-rehearsal.test.mjs
```
Expected: PASS — either `✓ merges cleanly with upstream/main` (network available and no conflict) or a `(skip) … merge rehearsal skipped` line (offline with no local `upstream/main`), both exit 0. If it reports a conflict, that is a real signal: resolve it before proceeding (per design §13.7, a failing upstream merge is a review blocker).

- [ ] **Step 3: Run the full merge-safety gate**

Run:
```bash
npm run test:merge-safety
```
Expected: contract test passes, unit runner passes, merge-rehearsal passes/skips; overall exit 0.

- [ ] **Step 4: Commit**

```bash
git add test/listing-agent-merge-rehearsal.test.mjs
git commit -m "test: add upstream merge-rehearsal gate for listing-agent fork"
```

---

## Task 7: Final full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Run the complete default suite**

Run:
```bash
npm test
```
Expected: all upstream tests plus `test:contract` and `test:listing-agent` pass; exit 0.

- [ ] **Step 2: Run the fixtures suite to confirm nothing broke the browser harness**

Run:
```bash
npm run test:fixtures
```
Expected: exit 0 (the new stub files add no fixtures and touch no fixture harness).

- [ ] **Step 3: Confirm the extension still packages**

Run:
```bash
npm run build:zip
```
Expected: exit 0, zips written under `dist/`. `build-zip` archives committed HEAD, so it will include the new `src/chrome` and `src/firefox` files that were committed in Task 3 — confirming the skeleton doesn't break packaging.

- [ ] **Step 4: Run the merge-safety gate one final time**

Run:
```bash
npm run test:merge-safety
```
Expected: exit 0 (clean merge or skip).

The Foundation is complete: a green baseline, a full owned-path skeleton mirrored across both builds, and a merge-safety harness (contract + rehearsal) that every future change and every upstream merge must pass.

---

## Self-Review

**1. Spec coverage (readiness checkpoint, design §15A / §13.7–§13.8):**
- Merge-safety regression harness added *before* any feature code — Tasks 2, 6 (contract test + merge-rehearsal). ✓
- Owned-paths contract enumerating every new file, with chrome/firefox parity enforcement — Task 2 + `mirroredPairs`. ✓
- Touchpoint tracking mechanism, seeded with the only touchpoint this plan creates (`package.json`) — Task 5. ✓
- Module skeleton for the full pipeline (mission, filter-planner, detection, extraction, evidence, requirements, ranking, dedup, progress, controller, research-skill, export, persistence) + UI (research-command, listings.html/js) — Task 3. ✓
- Model-driven controller decision reflected: `research-skill.js` present, `controller.js` dependency-injected/pure, **no `background.js` touchpoint** anywhere in the contract or scripts. ✓
- Standalone unit runner (feature plans extend it) rather than editing the monolithic `test/run.js` — Task 4. ✓
- Tests wired so they run under `npm test` (fast checks) and an on-demand `test:merge-safety` gate (network/worktree) — Task 5. ✓
- Deferred (correctly, to feature plans, each of which appends its own touchpoint): `settings.html` link to `listings.html`, `sidepanel.js` `/research` slash command, any `en.js` i18n keys, IndexedDB persistence behavior, and every stub body. Noted in File Structure.

**2. Placeholder scan:** No "TBD/implement later/handle edge cases" placeholders. The `throw new Error('NotImplemented: …')` bodies are intentional, complete scaffolding artifacts (feature plans replace them via TDD), not plan placeholders — every step shows full file content or an exact command with expected output.

**3. Type consistency:** Export names are defined once in the File Structure table and used identically in the stubs, the unit runner's `PURE_MODULES` list, and the contract's `ownedPaths`/`mirroredPairs`. `DEFAULT_LIMITS` keys (`maxDurationMs`, `maxPages`, `maxListings`, `noProgressPageThreshold`) match between `progress.js` and the runner's shape assertion. The contract's `mustContain` strings for `package.json` match the exact script values written in Task 5. `persistence.js` and `listings.js` are consistently excluded from the Node runner (browser-only) but included in the contract's existence/parity checks.
