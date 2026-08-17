# AI Listing Agent — Controller & Wiring Plan (Progress · Research Skill · /research Parser · Controller · UI Wiring)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the remaining orchestration stubs — loop limits & progress tracking, the model-facing research-skill prompt, the pure `/research` command parser, and the dependency-injected research controller — then wire `/research` into the side panel and add a Listings-workspace pointer to Settings, so a free-text objective drives a real, model-driven research run whose output flows through the (already-built) deterministic pipeline into persisted, ranked, evidence-backed listings.

**Architecture:** The research loop is **model-driven**: `research-skill.js` builds a prompt that instructs the *existing* WebBrain agent loop (using its existing `get_accessibility_tree` / `read_page` / `extract_data` / `scroll` / `navigate` / `click` tools) how to page through results and what to emit. There is **no `background.js` touchpoint** — `/research` is intercepted early in `parseSlashCommands` and *returns the skill prompt into the existing send path* (exactly the mechanism a normal message uses), never `sendToBackground`. `controller.js` is a pure, dependency-injected orchestrator (Node-importable, unit-testable): it validates the mission, builds the prompt, starts the run via an injected `startAgentRun`, then post-processes the model's page output through `detection → extraction → evidence → dedup → requirements → ranking`, tracks limits via `progress.js`, and persists through an injected store. `progress.js` and `research-command.js` are pure.

**Tech Stack:** JavaScript (native browser ESM), Node.js (`node:assert` + the repo's hand-rolled harness), the `test/listing-agent/run.mjs` unit runner, the `test/listing-agent-contract.test.mjs` merge-safety contract, the existing side-panel slash-command + i18n plumbing.

---

## Design references

- **§4 — Pipeline:** the model surfaces raw page output; everything is normalized/deduped/scored by the deterministic modules before display.
- **§9 — Loop limits & termination:** max duration, max pages, max listings, and a no-progress streak (N consecutive results pages adding no new unique listings).
- **§10 — Mission creation & the `/research` entry point:** free-text objective; `--strict` flips lenient UNKNOWN handling; the model does elicitation, the parser only validates the invocation.
- **§11 — Controller orchestration:** validate → prompt → model run → post-process → persist; an invalid mission never starts a run.

**Scope guardrails for this plan:**
- Fills these Foundation stubs only: `progress.js`, `research-skill.js`, `controller.js` (all `src/<build>/src/agent/listing-agent/`), and `research-command.js` (`src/<build>/src/ui/`). All four are already **owned** and **byte-identically mirrored** (Foundation), so implementing them and re-`cp`-ing keeps the contract's parity checks green at **33** through Tasks 1–4.
- Wires four **upstream** files (Tasks 5–6): `settings.html` + `locales/en.js` + `sidepanel.js`, in **both** builds. These files differ between chrome and firefox, so they are edited per-build (never `cp`) and tracked as **touchpoints** (not mirrored pairs). Each edit uses a text anchor that is **identical across builds** — only line numbers drift.
- Extends `test/listing-agent/run.mjs` only (never the monolithic `test/run.js`). The unit runner grows **57 → 80**.
- Appends touchpoints to `test/listing-agent-contract.json`: Task 5 adds 4 (→ contract 37), Task 6 adds 2 (→ contract 39).
- `export.js`, `listings.js`, `listings.html` remain untouched stubs (UI & Export plan). Execution handoff is intentionally **not** offered at the end of this plan.

**Baseline at the start of this plan** (end of the Pipeline plan): `node test/listing-agent/run.mjs` → `57 passed, 0 failed (57 total)`; `node test/listing-agent-contract.test.mjs` → `33 passed, 0 failed`.

---

## Canonical shapes used across this plan

**Limits** (frozen default in `progress.js`, overridable per run):

```js
// { maxDurationMs, maxPages, maxListings, noProgressPageThreshold }
```

**Progress tracker** (returned by `createProgressTracker`):

```js
// { recordPage(info?), snapshot() -> { pages, totalUnique, elapsedMs, noProgressStreak },
//   shouldTerminate() -> { terminate, reason } }   // reason ∈ null|'max_duration'|'max_pages'|'max_listings'|'no_progress'
```

**Controller deps** (injected into `createResearchController`):

```js
// { startAgentRun(prompt, ctx) -> Promise<{ pages: Page[], terminationReason?: string }>,
//   persistence?: { saveMission, saveJob, saveListings }, now?: () => number }
```

**Page** (what `startAgentRun` resolves with; the model/loop supplies these):

```js
// results page: { kind?: 'results', html?: string, pageModel?: Node, candidates?: Object[], elapsedMs?: number }
// detail  page: { kind: 'detail', detail: Object, elapsedMs?: number }
```

**Controller result** (returned by `run`): `{ job, mission, listings, terminationReason }`.

---

## Task 1: Loop limits & progress tracking (`progress.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Controller — progress tracker" block)
- Implement: `src/chrome/src/agent/listing-agent/progress.js`
- Mirror: `src/firefox/src/agent/listing-agent/progress.js`

- [ ] **Step 1: Append the failing progress-tracker tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Controller: progress tracker ------------------------------------------
const PROGRESS_MOD = 'src/chrome/src/agent/listing-agent/progress.js';

test('createProgressTracker: fresh snapshot is all-zero and does not terminate', async () => {
  const { createProgressTracker } = await load(PROGRESS_MOD);
  const tracker = createProgressTracker();
  assert.deepEqual(tracker.snapshot(), { pages: 0, totalUnique: 0, elapsedMs: 0, noProgressStreak: 0 });
  assert.equal(tracker.shouldTerminate().terminate, false);
});

test('createProgressTracker: recordPage accumulates pages, unique counts, and elapsed', async () => {
  const { createProgressTracker } = await load(PROGRESS_MOD);
  const tracker = createProgressTracker();
  tracker.recordPage({ newUnique: 5, elapsedMs: 1000 });
  tracker.recordPage({ newUnique: 3, elapsedMs: 2000 });
  const s = tracker.snapshot();
  assert.equal(s.pages, 2);
  assert.equal(s.totalUnique, 8);
  assert.equal(s.elapsedMs, 2000);
  assert.equal(s.noProgressStreak, 0);
});

test('createProgressTracker: terminates on max pages', async () => {
  const { createProgressTracker } = await load(PROGRESS_MOD);
  const tracker = createProgressTracker({ maxPages: 2 });
  tracker.recordPage({ newUnique: 1 });
  assert.equal(tracker.shouldTerminate().terminate, false);
  tracker.recordPage({ newUnique: 1 });
  assert.deepEqual(tracker.shouldTerminate(), { terminate: true, reason: 'max_pages' });
});

test('createProgressTracker: terminates on max listings', async () => {
  const { createProgressTracker } = await load(PROGRESS_MOD);
  const tracker = createProgressTracker({ maxListings: 10 });
  tracker.recordPage({ newUnique: 10 });
  assert.deepEqual(tracker.shouldTerminate(), { terminate: true, reason: 'max_listings' });
});

test('createProgressTracker: no-progress streak terminates and resets on progress', async () => {
  const { createProgressTracker } = await load(PROGRESS_MOD);
  const tracker = createProgressTracker({ noProgressPageThreshold: 2 });
  tracker.recordPage({ newUnique: 0 });
  assert.equal(tracker.shouldTerminate().terminate, false);
  tracker.recordPage({ newUnique: 4 }); // progress resets the streak
  assert.equal(tracker.snapshot().noProgressStreak, 0);
  tracker.recordPage({ newUnique: 0 });
  tracker.recordPage({ newUnique: 0 });
  assert.deepEqual(tracker.shouldTerminate(), { terminate: true, reason: 'no_progress' });
});

test('createProgressTracker: max duration takes priority over other limits', async () => {
  const { createProgressTracker } = await load(PROGRESS_MOD);
  const tracker = createProgressTracker({ maxDurationMs: 1000, maxPages: 1 });
  tracker.recordPage({ newUnique: 1, elapsedMs: 5000 });
  assert.deepEqual(tracker.shouldTerminate(), { terminate: true, reason: 'max_duration' });
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. The 57 prior tests pass; the 6 new tests print `✗` with `NotImplemented: createProgressTracker`. Summary `57 passed, 6 failed (63 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/progress.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — loop limits & progress tracking (pure).
// Feature plan: Controller. Design refs: §9 (limits, no-progress termination).

export const DEFAULT_LIMITS = Object.freeze({
  maxDurationMs: 10 * 60 * 1000, // 10 minutes
  maxPages: 20,
  maxListings: 300,
  noProgressPageThreshold: 2, // stop after N consecutive pages with no new unique listings
});

/**
 * Create a progress tracker for one research run.
 *
 * `recordPage` is called once per results page the model works through;
 * `shouldTerminate` reports the first limit reached so the model-driven loop
 * knows when to stop (design §9). The tracker holds no timers — elapsed time is
 * supplied by the caller so the module stays pure and Node-testable.
 *
 * @param {typeof DEFAULT_LIMITS} [limits]
 * @returns {{
 *   recordPage: (info?: { newUnique?: number, totalUnique?: number, elapsedMs?: number }) => void,
 *   snapshot: () => { pages: number, totalUnique: number, elapsedMs: number, noProgressStreak: number },
 *   shouldTerminate: () => { terminate: boolean, reason: string|null },
 * }}
 */
export function createProgressTracker(limits = DEFAULT_LIMITS) {
  const lim = Object.assign({}, DEFAULT_LIMITS, limits || {});
  let pages = 0;
  let totalUnique = 0;
  let elapsedMs = 0;
  let noProgressStreak = 0;
  return {
    recordPage(info = {}) {
      pages += 1;
      const newUnique = Number(info.newUnique) || 0;
      if (info.totalUnique != null) totalUnique = Number(info.totalUnique) || 0;
      else totalUnique += newUnique;
      if (info.elapsedMs != null) elapsedMs = Number(info.elapsedMs) || 0;
      if (newUnique <= 0) noProgressStreak += 1;
      else noProgressStreak = 0;
    },
    snapshot() {
      return { pages, totalUnique, elapsedMs, noProgressStreak };
    },
    shouldTerminate() {
      if (elapsedMs >= lim.maxDurationMs) return { terminate: true, reason: 'max_duration' };
      if (pages >= lim.maxPages) return { terminate: true, reason: 'max_pages' };
      if (totalUnique >= lim.maxListings) return { terminate: true, reason: 'max_listings' };
      if (noProgressStreak >= lim.noProgressPageThreshold) return { terminate: true, reason: 'no_progress' };
      return { terminate: false, reason: null };
    },
  };
}
```

- [ ] **Step 4: Run the unit runner to verify the progress tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `63 passed, 0 failed (63 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/agent/listing-agent/progress.js src/firefox/src/agent/listing-agent/progress.js
```
Expected: no output, exit 0.

- [ ] **Step 6: Run the contract test to confirm parity**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS, `33 passed, 0 failed`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/chrome/src/agent/listing-agent/progress.js src/firefox/src/agent/listing-agent/progress.js test/listing-agent/run.mjs
git commit -m "feat: implement loop limits & progress tracking (controller)"
```

---

## Task 2: Model-facing research skill prompt (`research-skill.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Controller — research skill" block)
- Implement: `src/chrome/src/agent/listing-agent/research-skill.js` (imports `./progress.js` from Task 1)
- Mirror: `src/firefox/src/agent/listing-agent/research-skill.js`

- [ ] **Step 1: Append the failing research-skill tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Controller: research skill prompt -------------------------------------
const SKILL_MOD = 'src/chrome/src/agent/listing-agent/research-skill.js';

function skillMission(over) {
  return Object.assign({
    objective: 'Find apartments for rent in New Cairo.',
    mandatory: [
      { id: 'bedrooms', attribute: 'bedrooms', operator: 'gte', value: 2, raw: '2+ bedrooms' },
      { id: 'price', attribute: 'price', operator: 'lte', value: 35000, raw: '<= 35,000 EGP', currency: 'EGP' },
    ],
    preferred: [{ id: 'garden', attribute: 'garden', operator: 'exists', value: true, raw: 'garden' }],
    exclusions: [{ id: 'level', attribute: 'level', operator: 'eq', value: 'ground', raw: 'no ground floor' }],
    sourceDomain: 'dubizzle.com.eg',
    options: { strict_mandatory_unknown: false },
  }, over || {});
}

test('buildResearchSkillPrompt: includes the objective and mandatory requirements', async () => {
  const { buildResearchSkillPrompt } = await load(SKILL_MOD);
  const p = buildResearchSkillPrompt(skillMission());
  assert.match(p, /OBJECTIVE: Find apartments for rent in New Cairo/);
  assert.match(p, /MANDATORY/);
  assert.match(p, /2\+ bedrooms/);
});

test('buildResearchSkillPrompt: includes preferred and exclusion requirements', async () => {
  const { buildResearchSkillPrompt } = await load(SKILL_MOD);
  const p = buildResearchSkillPrompt(skillMission());
  assert.match(p, /PREFERRED/);
  assert.match(p, /garden/);
  assert.match(p, /EXCLUSION/);
  assert.match(p, /no ground floor/);
});

test('buildResearchSkillPrompt: names the existing agent tools it should drive', async () => {
  const { buildResearchSkillPrompt } = await load(SKILL_MOD);
  const p = buildResearchSkillPrompt(skillMission());
  for (const tool of ['get_accessibility_tree', 'extract_data', 'scroll', 'navigate']) {
    assert.ok(p.includes(tool), `prompt must mention ${tool}`);
  }
});

test('buildResearchSkillPrompt: renders stop conditions from the provided limits', async () => {
  const { buildResearchSkillPrompt } = await load(SKILL_MOD);
  const p = buildResearchSkillPrompt(skillMission(), {
    maxPages: 7, maxListings: 42, maxDurationMs: 5 * 60 * 1000, noProgressPageThreshold: 3,
  });
  assert.match(p, /42 unique listings/);
  assert.match(p, /7 results pages/);
  assert.match(p, /5 minutes/);
  assert.match(p, /3 consecutive/);
});

test('buildResearchSkillPrompt: uses the mission source domain, falling back to the current site', async () => {
  const { buildResearchSkillPrompt } = await load(SKILL_MOD);
  assert.match(buildResearchSkillPrompt(skillMission()), /dubizzle\.com\.eg/);
  assert.match(buildResearchSkillPrompt(skillMission({ sourceDomain: '' })), /the current site/);
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. The 63 prior tests pass; the 5 new tests print `✗` with `NotImplemented: buildResearchSkillPrompt`. Summary `63 passed, 5 failed (68 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/research-skill.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — research skill prompt builder (pure).
// The research loop is MODEL-DRIVEN: this prompt instructs the existing agent
// loop how to page through results with existing tools, what to extract, which
// filters to apply, the exact structured output shape, and when to stop.
// Feature plan: Controller. Design refs: §4 (pipeline), §9 (limits), §10.
import { DEFAULT_LIMITS } from './progress.js';

// Render a requirement list as prompt bullets, preferring the user's raw phrase.
function bullets(reqs) {
  const list = Array.isArray(reqs) ? reqs : [];
  if (!list.length) return '  - (none)';
  return list
    .map((r) => `  - ${(r && (r.raw || `${r.attribute} ${r.operator} ${r.value}`)) || ''}`)
    .join('\n');
}

/**
 * Build the model-facing research prompt for a mission.
 * @param {import('./mission.js').ResearchMission} mission
 * @param {typeof DEFAULT_LIMITS} [limits]
 * @returns {string}
 */
export function buildResearchSkillPrompt(mission, limits = DEFAULT_LIMITS) {
  const m = mission && typeof mission === 'object' ? mission : {};
  const lim = Object.assign({}, DEFAULT_LIMITS, limits || {});
  const site = (m.sourceDomain && String(m.sourceDomain).trim()) || 'the current site';
  const minutes = Math.round(lim.maxDurationMs / 60000);
  return [
    `You are researching real-estate listings on ${site}. Work methodically and record what you find.`,
    '',
    `OBJECTIVE: ${m.objective || '(none given)'}`,
    '',
    'MANDATORY requirements (a listing must satisfy every one to be eligible):',
    bullets(m.mandatory),
    '',
    'PREFERRED requirements (nice-to-have; they improve ranking but must never exclude a listing):',
    bullets(m.preferred),
    '',
    'EXCLUSIONS (a listing matching any of these is disqualified):',
    bullets(m.exclusions),
    '',
    'HOW TO WORK THE PAGE:',
    '  1. Call get_accessibility_tree to understand the current results page structure.',
    '  2. Apply only the native site filters that map to MANDATORY requirements. Never invent a filter the site does not expose; filters are an accelerator, not evidence.',
    '  3. Use read_page and extract_data to pull each result card: title, price, currency, bedrooms, bathrooms, area, location, furnishing, and the listing URL.',
    '  4. Use scroll to load more results on the current page; use navigate to move to the next results page or into a listing detail page for enrichment.',
    '  5. Use click only when a control must be operated to reveal results or open a detail page.',
    '',
    'OUTPUT: for each listing, emit a candidate object carrying its source_url plus the fields above (scalars top-level, the rest under `attributes`). Do not judge eligibility or rank yourself — the deterministic pipeline handles normalization, evidence, dedup, eligibility, and ranking.',
    '',
    'STOP when ANY of these limits is reached:',
    `  - you have collected about ${lim.maxListings} unique listings, or`,
    `  - you have visited about ${lim.maxPages} results pages, or`,
    `  - about ${minutes} minutes have elapsed, or`,
    `  - ${lim.noProgressPageThreshold} consecutive results pages add no new unique listings.`,
  ].join('\n');
}
```

- [ ] **Step 4: Run the unit runner to verify the research-skill tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `68 passed, 0 failed (68 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/agent/listing-agent/research-skill.js src/firefox/src/agent/listing-agent/research-skill.js
```
Expected: no output, exit 0.

- [ ] **Step 6: Run the contract test to confirm parity**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS, `33 passed, 0 failed`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/chrome/src/agent/listing-agent/research-skill.js src/firefox/src/agent/listing-agent/research-skill.js test/listing-agent/run.mjs
git commit -m "feat: implement model-driven research skill prompt (controller)"
```

---

## Task 3: The `/research` command parser (`research-command.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Controller — /research parser" block)
- Implement: `src/chrome/src/ui/research-command.js`
- Mirror: `src/firefox/src/ui/research-command.js`

- [ ] **Step 1: Append the failing /research-parser tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Controller: /research command parser ----------------------------------
const RESEARCH_CMD_MOD = 'src/chrome/src/ui/research-command.js';

test('parseResearchSlashCommand: bare objective → ok, strict defaults to false', async () => {
  const { parseResearchSlashCommand } = await load(RESEARCH_CMD_MOD);
  const r = parseResearchSlashCommand('/research 2-bed flats in New Cairo under 35k');
  assert.equal(r.ok, true);
  assert.equal(r.objective, '2-bed flats in New Cairo under 35k');
  assert.equal(r.flags.strict, false);
});

test('parseResearchSlashCommand: --strict sets the flag and is stripped from the objective', async () => {
  const { parseResearchSlashCommand } = await load(RESEARCH_CMD_MOD);
  const r = parseResearchSlashCommand('/research --strict apartments in Maadi');
  assert.equal(r.ok, true);
  assert.equal(r.flags.strict, true);
  assert.equal(r.objective, 'apartments in Maadi');
});

test('parseResearchSlashCommand: "--" terminates options so the objective may start with dashes', async () => {
  const { parseResearchSlashCommand } = await load(RESEARCH_CMD_MOD);
  const r = parseResearchSlashCommand('/research -- --not-a-flag listing');
  assert.equal(r.ok, true);
  assert.equal(r.objective, '--not-a-flag listing');
  assert.equal(r.flags.strict, false);
});

test('parseResearchSlashCommand: rejects a non-/research command', async () => {
  const { parseResearchSlashCommand } = await load(RESEARCH_CMD_MOD);
  const r = parseResearchSlashCommand('/watch something');
  assert.equal(r.ok, false);
  assert.equal(r.error, 'not-research-command');
});

test('parseResearchSlashCommand: rejects unknown and duplicate options', async () => {
  const { parseResearchSlashCommand } = await load(RESEARCH_CMD_MOD);
  assert.equal(parseResearchSlashCommand('/research --loose foo').error, 'unknown-option');
  assert.equal(parseResearchSlashCommand('/research --strict --strict foo').error, 'duplicate-option');
});

test('parseResearchSlashCommand: rejects a missing objective', async () => {
  const { parseResearchSlashCommand } = await load(RESEARCH_CMD_MOD);
  assert.equal(parseResearchSlashCommand('/research').error, 'missing-objective');
  assert.equal(parseResearchSlashCommand('/research --strict').error, 'missing-objective');
  assert.equal(parseResearchSlashCommand('/research --strict   ').error, 'missing-objective');
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. The 68 prior tests pass; the 6 new tests print `✗` with `NotImplemented: parseResearchSlashCommand`. Summary `68 passed, 6 failed (74 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/ui/research-command.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — /research slash-command parser (pure).
// Mirrors the watch-command.js template. Failure => { ok:false, error, usage }.
// Feature plan: Controller/wiring. Design refs: §10.

export const RESEARCH_COMMAND_USAGE =
  '/research [--strict] <objective> — research listings matching the objective on the current site';

function invalid(error, details = {}) {
  return { ok: false, error, usage: RESEARCH_COMMAND_USAGE, ...details };
}

function nextToken(value) {
  return String(value || '').match(/^\S+/)?.[0] || '';
}

/**
 * Parse one complete /research invocation.
 *
 * Options precede the free-form objective; `--` ends option parsing so an
 * objective may itself begin with dashes. `--strict` flips the lenient default
 * so an UNKNOWN mandatory attribute is treated as FAIL (design §6/§10).
 *
 * @param {string} value
 * @returns {{ ok: true, objective: string, flags: { strict: boolean } }
 *          | { ok: false, error: string, usage: string, option?: string }}
 */
export function parseResearchSlashCommand(value) {
  const text = String(value || '').trim();
  const commandMatch = /^\/research(?:\s|$)/i.exec(text);
  if (!commandMatch) return invalid('not-research-command');

  let rest = text.slice(commandMatch[0].length).trimStart();
  let strict = false;
  const seen = new Set();

  while (rest.startsWith('--')) {
    const option = nextToken(rest).toLowerCase();
    if (option === '--') {
      rest = rest.slice(2).trimStart();
      break;
    }
    if (option !== '--strict') return invalid('unknown-option', { option });
    if (seen.has(option)) return invalid('duplicate-option', { option });
    seen.add(option);
    rest = rest.slice(nextToken(rest).length).trimStart();
    strict = true;
  }

  const objective = rest.trim();
  if (!objective) return invalid('missing-objective');
  return { ok: true, objective, flags: { strict } };
}
```

- [ ] **Step 4: Run the unit runner to verify the parser tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `74 passed, 0 failed (74 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/ui/research-command.js src/firefox/src/ui/research-command.js
```
Expected: no output, exit 0.

- [ ] **Step 6: Run the contract test to confirm parity**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS, `33 passed, 0 failed`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/chrome/src/ui/research-command.js src/firefox/src/ui/research-command.js test/listing-agent/run.mjs
git commit -m "feat: implement /research slash-command parser (controller)"
```

---

## Task 4: Model-driven research controller (`controller.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Controller — orchestration" block)
- Implement: `src/chrome/src/agent/listing-agent/controller.js` (imports the pipeline + domain modules from prior plans)
- Mirror: `src/firefox/src/agent/listing-agent/controller.js`

- [ ] **Step 1: Append the failing controller tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Controller: orchestration ---------------------------------------------
const CONTROLLER_MOD = 'src/chrome/src/agent/listing-agent/controller.js';

// A valid acceptance mission (bedrooms 2+, price <= 35000 EGP, location New Cairo).
function ctrlMission() {
  return {
    objective: 'Find apartments for rent in New Cairo.',
    mandatory: [
      { id: 'bedrooms', attribute: 'bedrooms', operator: 'gte', value: 2, raw: '2+ bedrooms' },
      { id: 'price', attribute: 'price', operator: 'lte', value: 35000, raw: '<= 35000 EGP', currency: 'EGP' },
      { id: 'location', attribute: 'location', operator: 'contains', value: 'New Cairo', raw: 'New Cairo' },
    ],
    preferred: [],
    exclusions: [],
    sourceDomain: 'dubizzle.com.eg',
    options: { strict_mandatory_unknown: false },
  };
}

// Results page 1: two JSON-LD listings (503863245 eligible, 111111 over budget).
const CTRL_PAGE1_HTML = [
  '<html><head>',
  '<script type="application/ld+json">',
  JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product',
    name: 'Cozy 3BR in New Cairo',
    url: 'https://www.dubizzle.com.eg/en/ad/spacious-flat-503863245.html',
    numberOfBedrooms: 3,
    address: { '@type': 'PostalAddress', addressLocality: 'First Settlement, New Cairo' },
    offers: { '@type': 'Offer', price: '30000', priceCurrency: 'EGP' },
  }),
  '</script>',
  '<script type="application/ld+json">',
  JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Product',
    name: 'Large 4BR',
    url: 'https://www.dubizzle.com.eg/en/ad/big-flat-111111.html',
    numberOfBedrooms: 4,
    address: { '@type': 'PostalAddress', addressLocality: 'New Cairo' },
    offers: { '@type': 'Offer', price: '40000', priceCurrency: 'EGP' },
  }),
  '</script>',
  '</head><body></body></html>',
].join('');

// Two pages of model output + one detail page. Page 2's pageModel repeats the
// same listing (222222) twice → one duplicate. Page 3 enriches 503863245.
const CTRL_PAGES = [
  { kind: 'results', html: CTRL_PAGE1_HTML, elapsedMs: 1000 },
  {
    kind: 'results', elapsedMs: 2000,
    pageModel: {
      role: 'main',
      children: [
        {
          role: 'list',
          children: [
            { role: 'listitem', name: 'Cozy 2BR', href: 'https://www.dubizzle.com.eg/en/ad/cozy-flat-222222.html', price: '28000 EGP', bedrooms: '2', location: 'New Cairo' },
            { role: 'listitem', name: 'Cozy 2BR', href: 'https://www.dubizzle.com.eg/en/ad/cozy-flat-222222.html', price: '28000 EGP', bedrooms: '2', location: 'New Cairo' },
          ],
        },
      ],
    },
  },
  {
    kind: 'detail', elapsedMs: 3000,
    detail: { source_listing_id: '503863245', description: 'Spacious and bright', bathrooms: 2, area_m2: 150, furnished: false },
  },
];

function makeStore() {
  const missions = [];
  const jobs = [];
  const listings = [];
  return {
    missions, jobs, listings,
    async saveMission(m) { missions.push(m); return m; },
    async saveJob(j) { jobs.push(j); return j; },
    async saveListings(ls) { for (const l of ls) listings.push(l); return ls.length; },
  };
}

async function runControllerFixture(missionOverride) {
  const { createResearchController } = await load(CONTROLLER_MOD);
  const store = makeStore();
  const calls = [];
  const controller = createResearchController({
    now: () => 1000,
    persistence: store,
    startAgentRun: async (prompt, ctx) => {
      calls.push({ prompt, ctx });
      return { pages: CTRL_PAGES, terminationReason: 'no_progress' };
    },
  });
  const result = await controller.run(missionOverride || ctrlMission());
  return { result, store, calls };
}

test('createResearchController.run: starts exactly one model run and completes the job', async () => {
  const { result, calls } = await runControllerFixture();
  assert.equal(calls.length, 1);
  assert.equal(result.job.id, 'job-1000');
  assert.equal(result.job.status, 'completed');
  assert.equal(result.terminationReason, 'no_progress');
});

test('createResearchController.run: normalizes, dedupes, and counts listings', async () => {
  const { result } = await runControllerFixture();
  assert.equal(result.listings.length, 3);
  assert.equal(result.job.counts.total, 3);
  assert.equal(result.job.counts.duplicates, 1);
});

test('createResearchController.run: applies lenient eligibility per listing', async () => {
  const { result } = await runControllerFixture();
  const byId = Object.fromEntries(result.listings.map((l) => [l.source_listing_id, l]));
  assert.equal(byId['503863245'].eligibility, 'PASS');
  assert.equal(byId['222222'].eligibility, 'PASS');
  assert.equal(byId['111111'].eligibility, 'FAIL');
  assert.equal(result.job.counts.eligible, 2);
  assert.equal(result.job.counts.ineligible, 1);
});

test('createResearchController.run: merges pass-2 detail into the matching listing', async () => {
  const { result } = await runControllerFixture();
  const l = result.listings.find((x) => x.source_listing_id === '503863245');
  assert.equal(l.attributes.bathrooms, 2);
  assert.equal(l.attributes.area_m2, 150);
  assert.equal(l.attributes.furnishing_state, 'unfurnished');
  assert.match(l.description, /Spacious and bright/);
});

test('createResearchController.run: attaches evidence/ranking/ids and persists everything', async () => {
  const { result, store } = await runControllerFixture();
  const l = result.listings.find((x) => x.source_listing_id === '503863245');
  assert.ok(Array.isArray(l.evidence) && l.evidence.length > 0, 'evidence records present');
  assert.equal(typeof l.evidence_confidence, 'number');
  assert.equal(typeof l.ranking_score, 'number');
  assert.equal(l.id, 'job-1000::503863245');
  assert.equal(l.job_id, 'job-1000');
  assert.equal(typeof l.mission_id, 'string');
  assert.equal(result.job.progress.pages, 2);
  assert.equal(result.job.progress.totalUnique, 3);
  assert.equal(store.missions.length, 1);
  assert.equal(store.jobs.length, 1);
  assert.equal(store.listings.length, 3);
});

test('createResearchController.run: an invalid mission never starts a model run', async () => {
  const { createResearchController } = await load(CONTROLLER_MOD);
  let started = 0;
  const controller = createResearchController({
    now: () => 1000,
    startAgentRun: async () => { started += 1; return { pages: [] }; },
  });
  const res = await controller.run({ objective: '', mandatory: [], preferred: [], exclusions: [] });
  assert.equal(started, 0, 'must not start a run for an invalid mission');
  assert.equal(res.job.status, 'error');
  assert.equal(res.terminationReason, 'invalid_mission');
  assert.match(res.job.error, /objective/);
  assert.equal(res.listings.length, 0);
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. The 74 prior tests pass; the 6 new tests print `✗` with `NotImplemented: createResearchController`. Summary `74 passed, 6 failed (80 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/controller.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — model-driven research controller (pure orchestrator).
// Dependency-injected so it stays Node-importable and unit-testable: it builds
// the skill prompt, starts a model-driven run via the injected `startAgentRun`,
// then post-processes the model's page output through the pure pipeline
// (detection -> extraction -> evidence -> requirements -> ranking -> dedup) and
// persists via the injected store.
// No background.js dependency.
// Feature plan: Controller. Design refs: §4, §9, §11.

import { DEFAULT_LIMITS, createProgressTracker } from './progress.js';
import { buildResearchSkillPrompt } from './research-skill.js';
import { validateMission } from './mission.js';
import { extractJsonLdListings, detectCollections, detectListingBoundaries } from './detection.js';
import { normalizeCandidate, mergeDetail } from './extraction.js';
import { makeEvidence, aggregateConfidence } from './evidence.js';
import { evaluateListing } from './requirements.js';
import { computeRanking } from './ranking.js';
import { dedupeListings, sourceListingId } from './dedup.js';

/**
 * @typedef {Object} ControllerDeps
 * @property {(prompt: string, ctx: Object) => Promise<{ pages: Object[], terminationReason?: string }>} startAgentRun
 * @property {{ saveMission: Function, saveJob: Function, saveListings: Function }} [persistence]
 * @property {() => number} [now]  defaults to Date.now at call sites, not module load
 */

// Confidence per extraction method (design §5).
const METHOD_CONFIDENCE = Object.freeze({ 'json-ld': 0.9, structural: 0.6 });

// Attributes to build per-attribute evidence for (design §3/§5).
const EVIDENCE_ATTRS = [
  'bedrooms', 'bathrooms', 'area_m2', 'furnishing_state', 'location',
  'property_type', 'level', 'view', 'parking', 'garden', 'compound', 'availability',
];

// Approximate key for counting unique listings during paging; the authoritative
// dedup is dedupeListings(). Source-listing id first, else the source URL.
function keyOf(listing) {
  if (!listing) return null;
  return sourceListingId(listing) || (listing.source_url ? String(listing.source_url).trim().toLowerCase() : null);
}

// Pull raw candidates from one results page, tagging each with the extraction
// method that produced it (drives evidence confidence).
function extractCandidates(page) {
  if (!page || typeof page !== 'object') return [];
  if (typeof page.html === 'string' && page.html) {
    const entities = extractJsonLdListings(page.html);
    if (entities.length) return entities.map((raw) => ({ raw, method: 'json-ld' }));
  }
  if (page.pageModel) {
    const collections = detectCollections(page.pageModel);
    if (collections.length) {
      return detectListingBoundaries(collections[0]).map((raw) => ({ raw, method: 'structural' }));
    }
  }
  if (Array.isArray(page.candidates)) {
    return page.candidates.map((raw) => ({ raw, method: (raw && raw.extraction_method) || 'structural' }));
  }
  return [];
}

function isDetailPage(page) {
  return !!(page && (page.kind === 'detail' || (page.detail && !page.html && !page.pageModel && !page.candidates)));
}

// Build per-attribute evidence for a listing using the method that produced it.
function buildEvidence(listing, method) {
  const confidence = METHOD_CONFIDENCE[method] != null ? METHOD_CONFIDENCE[method] : 0.5;
  const records = [];
  const consider = (attribute, value) => {
    if (value == null || value === '') return;
    records.push(makeEvidence({
      value,
      attribute,
      sourceText: String(value),
      extractionMethod: method || 'unknown',
      confidence,
      verificationStatus: 'unverified',
    }));
  };
  consider('title', listing.title);
  consider('price', listing.price);
  const attrs = listing.attributes || {};
  for (const attr of EVIDENCE_ATTRS) consider(attr, attrs[attr]);
  return records;
}

function errorJob(jobId, missionId, message, reason, stamp) {
  return {
    id: jobId,
    mission_id: missionId,
    status: 'error',
    error: message,
    terminationReason: reason,
    counts: { total: 0, eligible: 0, unknown: 0, ineligible: 0, duplicates: 0 },
    created_at: stamp,
  };
}

/**
 * Create a model-driven research controller.
 * @param {ControllerDeps} deps
 * @returns {{ run: (mission: Object, options?: { limits?: Object }) => Promise<{ job: Object, mission: Object, listings: Object[], terminationReason: string }> }}
 */
export function createResearchController(deps = {}) {
  const startAgentRun = typeof deps.startAgentRun === 'function' ? deps.startAgentRun : null;
  const persistence = deps.persistence || null;
  const now = typeof deps.now === 'function' ? deps.now : Date.now;

  async function run(mission, options = {}) {
    const limits = Object.assign({}, DEFAULT_LIMITS, options.limits || {});
    const stamp = now();
    const jobId = `job-${stamp}`;
    const missionId = (mission && mission.id) || `mission-${stamp}`;

    // 1) Validate — an invalid mission never starts a model run (§11).
    const validation = validateMission(mission);
    if (!validation.ok) {
      const job = errorJob(jobId, missionId, validation.errors.join('; '), 'invalid_mission', stamp);
      if (persistence) await persistence.saveJob(job);
      return { job, mission, listings: [], terminationReason: 'invalid_mission' };
    }

    const missionRecord = { ...mission, id: missionId };

    // 2) Build the skill prompt and start the model-driven run.
    const prompt = buildResearchSkillPrompt(missionRecord, limits);
    let runResult;
    try {
      runResult = startAgentRun
        ? await startAgentRun(prompt, { mission: missionRecord, limits, jobId })
        : { pages: [] };
    } catch (error) {
      const job = errorJob(jobId, missionId, (error && error.message) || String(error), 'error', stamp);
      if (persistence) await persistence.saveJob(job);
      return { job, mission: missionRecord, listings: [], terminationReason: 'error' };
    }

    // 3) Post-process the model output through the pure pipeline.
    const pages = runResult && Array.isArray(runResult.pages) ? runResult.pages : [];
    const tracker = createProgressTracker(limits);
    const allCandidates = [];
    const details = [];
    const seen = new Set();

    for (const page of pages) {
      if (isDetailPage(page)) {
        const detail = normalizeCandidate(page.detail || {});
        if (keyOf(detail)) details.push(detail);
        continue;
      }
      let newUnique = 0;
      for (const { raw, method } of extractCandidates(page)) {
        const listing = normalizeCandidate(raw);
        listing.__method = method;
        allCandidates.push(listing);
        const key = keyOf(listing);
        if (key && !seen.has(key)) {
          seen.add(key);
          newUnique += 1;
        }
      }
      tracker.recordPage({ newUnique, totalUnique: seen.size, elapsedMs: page.elapsedMs });
    }

    // 4) Dedup, then index detail pages by source-listing id for merging.
    const { unique, duplicates } = dedupeListings(allCandidates);
    const detailBySid = new Map();
    for (const detail of details) {
      const sid = sourceListingId(detail);
      if (sid) detailBySid.set(sid, detail);
    }

    // 5) Enrich each unique listing: merge detail -> evidence -> eligibility -> ranking.
    const listings = unique.map((base) => {
      const method = base.__method || 'unknown';
      const sid = sourceListingId(base);
      const withoutMethod = { ...base };
      delete withoutMethod.__method;
      const merged = sid && detailBySid.has(sid)
        ? mergeDetail(withoutMethod, detailBySid.get(sid))
        : withoutMethod;
      const evidence = buildEvidence(merged, method);
      const evidence_confidence = aggregateConfidence({ ...merged, evidence }, missionRecord);
      const scored = { ...merged, evidence, evidence_confidence };
      const evaluation = evaluateListing(scored, missionRecord);
      const ranking = computeRanking(scored, missionRecord);
      return {
        ...scored,
        id: `${jobId}::${sid || keyOf(merged) || 'unknown'}`,
        job_id: jobId,
        mission_id: missionId,
        eligibility: evaluation.eligibility,
        per_requirement: evaluation.perRequirement,
        ranking_score: ranking.score,
        ranking_breakdown: ranking.breakdown,
      };
    });

    listings.sort((a, b) => (b.ranking_score || 0) - (a.ranking_score || 0));

    // 6) Finalize the job record and persist mission + job + listings.
    const counts = {
      total: listings.length,
      eligible: listings.filter((l) => l.eligibility === 'PASS').length,
      unknown: listings.filter((l) => l.eligibility === 'UNKNOWN_BLOCKED').length,
      ineligible: listings.filter((l) => l.eligibility === 'FAIL').length,
      duplicates: duplicates.length,
    };
    const terminationReason =
      (runResult && runResult.terminationReason) || tracker.shouldTerminate().reason || 'completed';
    const job = {
      id: jobId,
      mission_id: missionId,
      status: 'completed',
      objective: missionRecord.objective,
      terminationReason,
      progress: tracker.snapshot(),
      counts,
      created_at: stamp,
    };

    if (persistence) {
      await persistence.saveMission(missionRecord);
      await persistence.saveJob(job);
      await persistence.saveListings(listings);
    }

    return { job, mission: missionRecord, listings, terminationReason };
  }

  return { run };
}
```

- [ ] **Step 4: Run the unit runner to verify the controller tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `80 passed, 0 failed (80 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/agent/listing-agent/controller.js src/firefox/src/agent/listing-agent/controller.js
```
Expected: no output, exit 0.

- [ ] **Step 6: Run the contract test to confirm parity**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS, `33 passed, 0 failed`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/chrome/src/agent/listing-agent/controller.js src/firefox/src/agent/listing-agent/controller.js test/listing-agent/run.mjs
git commit -m "feat: implement model-driven research controller (controller)"
```

---

## Task 5: Settings pointer + i18n strings (both builds)

This task wires two **upstream** files in **both** builds: `locales/en.js` (three new slash/research strings + a Settings workspace label) and `settings.html` (a Listings-workspace pointer row). These files are **not** byte-identical across builds, so they are edited per-build — but the search anchors below are **identical text** in chrome and firefox (only line numbers differ). New behavior is proven by the contract's touchpoint hooks, so this task is contract-driven RED→GREEN.

**Files:**
- Modify: `test/listing-agent-contract.json` (add 4 touchpoints)
- Modify: `src/chrome/src/ui/locales/en.js` and `src/firefox/src/ui/locales/en.js`
- Modify: `src/chrome/src/ui/settings.html` and `src/firefox/src/ui/settings.html`

- [ ] **Step 1: Add the four touchpoints to the contract**

In `test/listing-agent-contract.json`, replace the `touchpoints` array (which at the start of this plan contains only the `package.json` entry seeded by the Foundation plan) with the following — the original entry plus four new ones:

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
    },
    {
      "file": "src/chrome/src/ui/locales/en.js",
      "mustContain": ["sp.slash.research", "st.display.listing_workspace.desc_html", "listings.html"]
    },
    {
      "file": "src/firefox/src/ui/locales/en.js",
      "mustContain": ["sp.slash.research", "st.display.listing_workspace.desc_html", "listings.html"]
    },
    {
      "file": "src/chrome/src/ui/settings.html",
      "mustContain": ["st.display.listing_workspace.desc_html"]
    },
    {
      "file": "src/firefox/src/ui/settings.html",
      "mustContain": ["st.display.listing_workspace.desc_html"]
    }
  ]
```

- [ ] **Step 2: Run the contract test to verify the new touchpoints fail**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: FAIL. The 33 prior checks pass; the 4 new touchpoint checks fail (the files do not yet contain the needles). Summary `33 passed, 4 failed`, exit 1.

- [ ] **Step 3: Add the new i18n keys to `src/chrome/src/ui/locales/en.js`**

Find the existing `/progress` slash string:

```js
  'sp.slash.check_progress': 'Show the current progress ledger',
```

Insert these three lines immediately **after** it:

```js
  'sp.slash.research': 'Research listings matching an objective on the current site',
  'sp.slash.research_strict': 'Treat unknown mandatory attributes as failing (strict)',
  'sp.research.started': 'Researching: {objective}',
```

Then find the tracing description string:

```js
  'st.display.tracing.desc_html': 'Persist every run (LLM requests, responses, tool calls, screenshots) into local IndexedDB so you can inspect and compare models side-by-side. Opens in a separate Traces tab. Off by default because it adds disk writes per step. <a href="traces.html" target="_blank" style="color:var(--accent);">Open Traces page →</a>',
```

Insert these two lines immediately **after** it:

```js
  'st.display.listing_workspace.label': 'Listing research workspace',
  'st.display.listing_workspace.desc_html': 'Browse, filter, and export the apartment listings collected by /research. <a href="listings.html" target="_blank" style="color:var(--accent);">Open Listings page →</a>',
```

- [ ] **Step 4: Add the same i18n keys to `src/firefox/src/ui/locales/en.js`**

Apply the **identical** two insertions to the firefox copy (same anchor strings `'sp.slash.check_progress': 'Show the current progress ledger',` and `'st.display.tracing.desc_html': '...'`; only the line numbers differ from chrome).

- [ ] **Step 5: Add the Listings-workspace row to `src/chrome/src/ui/settings.html`**

Find the tracing setting-row and the verbose setting-row that follows it (the tracing toggle's `id="toggle-tracing"` makes this anchor unique):

```html
            <label class="toggle">
              <input type="checkbox" id="toggle-tracing">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label" data-i18n="st.display.verbose.label"></div>
```

Insert a new setting-row between the tracing row's closing `</div>` and the verbose `<div class="setting-row">`, producing:

```html
            <label class="toggle">
              <input type="checkbox" id="toggle-tracing">
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label" data-i18n="st.display.listing_workspace.label"></div>
              <div class="setting-desc" data-i18n-html="st.display.listing_workspace.desc_html"></div>
            </div>
          </div>
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label" data-i18n="st.display.verbose.label"></div>
```

(The new row has no toggle — it is a navigational pointer whose description carries the `listings.html` link rendered via `data-i18n-html`.)

- [ ] **Step 6: Add the same row to `src/firefox/src/ui/settings.html`**

Apply the **identical** insertion to the firefox copy (same anchor block; only the line numbers differ from chrome).

- [ ] **Step 7: Run the contract test to verify the touchpoints pass**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS. Summary `37 passed, 0 failed`, exit 0.

- [ ] **Step 8: Commit**

```bash
git add test/listing-agent-contract.json src/chrome/src/ui/locales/en.js src/firefox/src/ui/locales/en.js src/chrome/src/ui/settings.html src/firefox/src/ui/settings.html
git commit -m "feat: add /research i18n strings and Settings listings pointer (both builds)"
```

---

## Task 6: Wire `/research` into the side panel (both builds)

This task wires `/research` into `sidepanel.js` in **both** builds. Because the research loop is **model-driven**, `/research` is intercepted by an early branch that **returns the skill prompt into the existing send path** (mirroring the `/watch` early branch's position) — it does **not** call `sendToBackground`. The `sidepanel.js` files differ across builds, so edits are per-build; the anchors are identical text (only line numbers differ). Contract-driven RED→GREEN.

**Files:**
- Modify: `test/listing-agent-contract.json` (add 2 touchpoints)
- Modify: `src/chrome/src/ui/sidepanel.js` and `src/firefox/src/ui/sidepanel.js`

- [ ] **Step 1: Add the two sidepanel touchpoints to the contract**

In `test/listing-agent-contract.json`, replace the `touchpoints` array with the Task-5 array plus the two new sidepanel entries (7 entries total):

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
    },
    {
      "file": "src/chrome/src/ui/locales/en.js",
      "mustContain": ["sp.slash.research", "st.display.listing_workspace.desc_html", "listings.html"]
    },
    {
      "file": "src/firefox/src/ui/locales/en.js",
      "mustContain": ["sp.slash.research", "st.display.listing_workspace.desc_html", "listings.html"]
    },
    {
      "file": "src/chrome/src/ui/settings.html",
      "mustContain": ["st.display.listing_workspace.desc_html"]
    },
    {
      "file": "src/firefox/src/ui/settings.html",
      "mustContain": ["st.display.listing_workspace.desc_html"]
    },
    {
      "file": "src/chrome/src/ui/sidepanel.js",
      "mustContain": ["research-command.js", "parseResearchSlashCommand", "buildResearchSkillPrompt"]
    },
    {
      "file": "src/firefox/src/ui/sidepanel.js",
      "mustContain": ["research-command.js", "parseResearchSlashCommand", "buildResearchSkillPrompt"]
    }
  ]
```

- [ ] **Step 2: Run the contract test to verify the new touchpoints fail**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: FAIL. The 37 prior checks pass; the 2 new sidepanel touchpoint checks fail. Summary `37 passed, 2 failed`, exit 1.

- [ ] **Step 3: Add the imports to `src/chrome/src/ui/sidepanel.js` (Edit A)**

Find the existing watch-command import:

```js
import { parseWatchSlashCommand, WATCH_COMMAND_USAGE } from './watch-command.js';
```

Insert these three imports immediately **after** it:

```js
import { parseResearchSlashCommand } from './research-command.js';
import { buildResearchSkillPrompt } from '../agent/listing-agent/research-skill.js';
import { parseMission } from '../agent/listing-agent/mission.js';
```

- [ ] **Step 4: Add the `/research` autocomplete entry (Edit B)**

Find the `/progress` entry in the `SLASH_COMMANDS` array:

```js
  { value: '/progress', usage: '/progress', descriptionKey: 'sp.slash.check_progress', action: 'show', outOfBand: true },
```

Insert this entry immediately **before** it:

```js
  {
    value: '/research',
    usage: '/research [--strict] <objective>',
    descriptionKey: 'sp.slash.research',
    action: 'research',
    acceptsPayload: true,
    options: [
      { value: '--strict', descriptionKey: 'sp.slash.research_strict' },
    ],
  },
```

(No `outOfBand` flag: unlike `/watch`, `/research` produces a payload that is sent to the model. The `action: 'research'` value is never dispatched because Edit C intercepts `/research` earlier and returns; the entry exists for the autocomplete menu and `--help`.)

- [ ] **Step 5: Add the early model-driven `/research` branch (Edit C)**

Inside `async function parseSlashCommands(...)`, the `/watch` early branch ends and is immediately followed by the first `parseSlashInvocation` call:

```js
    return '';
  }
  const invocation = parseSlashInvocation(text);
  if (!invocation) return text;
```

Insert the `/research` branch between the `/watch` branch's closing `}` and `const invocation = parseSlashInvocation(text);`, producing:

```js
    return '';
  }
  if (/^\s*\/research(?:\s|$)/i.test(text) && !/^\s*\/research\s+--help\s*$/i.test(text)) {
    const parsed = parseResearchSlashCommand(text);
    if (!parsed.ok) {
      showComposerToast(t('sp.slash.invalid_usage', { usage: parsed.usage }), { duration: 5000 });
      return '';
    }
    const mission = parseMission(parsed.objective, {
      options: { strict_mandatory_unknown: parsed.flags.strict === true },
    });
    addPersistentSlashMessage(t('sp.research.started', { objective: parsed.objective }));
    // Model-driven: return the skill prompt into the existing send path (no background touchpoint).
    return buildResearchSkillPrompt(mission);
  }
  const invocation = parseSlashInvocation(text);
  if (!invocation) return text;
```

- [ ] **Step 6: Apply Edits A/B/C to `src/firefox/src/ui/sidepanel.js`**

Apply the **identical** three edits to the firefox copy, using the same anchors (`import { parseWatchSlashCommand, WATCH_COMMAND_USAGE } from './watch-command.js';`, the `/progress` entry, and the `return '';` → `}` → `const invocation = parseSlashInvocation(text);` block). Only the line numbers differ from chrome.

- [ ] **Step 7: Run the contract test to verify the touchpoints pass**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS. Summary `39 passed, 0 failed`, exit 0.

- [ ] **Step 8: Commit**

```bash
git add test/listing-agent-contract.json src/chrome/src/ui/sidepanel.js src/firefox/src/ui/sidepanel.js
git commit -m "feat: wire model-driven /research into the side panel (both builds)"
```

---

## Task 7: Full-suite & merge-safety verification

**Files:** none (verification only)

- [ ] **Step 1: Run the complete default suite**

Run:
```bash
npm test
```
Expected: all upstream tests pass, then `test:contract` prints `39 passed, 0 failed` and `test:listing-agent` prints `80 passed, 0 failed (80 total)`; overall exit 0.

- [ ] **Step 2: Confirm the extension still packages for both builds**

Run:
```bash
npm run build:zip
```
Expected: exit 0, zips written under `dist/`. The four newly-implemented modules are pure/browser-safe and the wiring edits are additive, so packaging is unaffected.

- [ ] **Step 3: Run the merge-safety gate**

Run:
```bash
npm run test:merge-safety
```
Expected: contract `39 passed, 0 failed`, unit runner `80 passed, 0 failed (80 total)`, merge-rehearsal passes (`✓ merges cleanly with upstream/main`) or skips (offline); overall exit 0.

The controller layer is complete: a free-text `/research` objective now parses into a mission, drives the existing model loop via a generated skill prompt, and post-processes the model's page output through the deterministic pipeline into ranked, evidence-backed, persisted listings — with loop limits and termination reasons — and no `background.js` touchpoint.

---

## Self-Review

**1. Spec coverage:**
- §9 loop limits & termination (max duration/pages/listings + no-progress streak, with a stated priority order) — Task 1 covers a fresh tracker, accumulation, each limit, streak reset, and duration priority. `shouldTerminate` returns a `reason` consumed by the controller. ✓
- §10 `/research` entry point (free-text objective; `--strict`; parser validates the invocation, model does elicitation) — Task 3 covers bare/strict/`--`/non-command/unknown+duplicate option/missing objective; Task 6 wires it to `parseMission` with the strict flag mapped to `strict_mandatory_unknown`. ✓
- §4 pipeline (model surfaces raw output; deterministic modules normalize/dedup/score) — Task 4's controller runs `detection → extraction → evidence → dedup → requirements → ranking` over JSON-LD *and* structural pages plus a detail-page merge, verified end-to-end (counts, eligibility, merge, evidence/ranking/ids). ✓
- §11 controller orchestration (validate → prompt → run → post-process → persist; invalid mission never starts a run) — Task 4 covers the happy path with persistence and the invalid-mission short-circuit (`startAgentRun` never called; `status:'error'`, `terminationReason:'invalid_mission'`). ✓
- Model-driven, no-background decision — Task 2 builds a prompt naming the real WebBrain tools (`get_accessibility_tree`/`read_page`/`extract_data`/`scroll`/`navigate`/`click`); Task 6's early branch **returns** the prompt into the send path and never calls `sendToBackground`. ✓
- Merge-safety — Tasks 1–4 keep the contract at 33 (owned, mirrored stubs implemented + re-`cp`'d); Tasks 5–6 add the six upstream touchpoints (→ 39), and Task 7 runs the merge rehearsal. ✓

**2. Placeholder scan:** No "TBD/implement later/handle edge cases." Every implementation step shows the full file contents (Tasks 1–4) or an exact anchored edit (Tasks 5–6); every run step states the exact command and pass/fail counts. The controller's `startAgentRun`-throws branch is real defensive code (mirrors the `/watch` try/catch), not a placeholder.

**3. Type consistency:**
- `DEFAULT_LIMITS` shape (`maxDurationMs`, `maxPages`, `maxListings`, `noProgressPageThreshold`) is defined in `progress.js` and consumed unchanged by `research-skill.js` (stop conditions) and `controller.js` (limits merge + tracker). ✓
- `createProgressTracker` returns `{ recordPage, snapshot, shouldTerminate }`; the controller calls all three with the documented arguments; `shouldTerminate().reason` values (`max_duration`/`max_pages`/`max_listings`/`no_progress`) are the same strings the controller may surface as `terminationReason`. ✓
- `parseResearchSlashCommand` returns `{ ok, objective, flags:{ strict } }` (success) / `{ ok:false, error, usage }` (failure); Task 6's branch reads exactly `parsed.ok`, `parsed.usage`, `parsed.objective`, `parsed.flags.strict`. ✓
- The controller imports match the prior plans' exports exactly: `validateMission` → `{ ok, errors }`; `extractJsonLdListings`/`detectCollections`/`detectListingBoundaries` (detection); `normalizeCandidate`/`mergeDetail` (extraction, which merges nested `attributes` and re-derives `source_listing_id`); `makeEvidence`/`aggregateConfidence` (evidence); `evaluateListing` → `{ eligibility, perRequirement }`; `computeRanking` → `{ score, breakdown }`; `dedupeListings` → `{ unique, duplicates }` and `sourceListingId`. ✓
- The persisted job/listing field names (`id`, `mission_id`, `job_id`, `status`, `terminationReason`, `progress`, `counts`, `eligibility`, `per_requirement`, `ranking_score`, `ranking_breakdown`, `evidence`, `evidence_confidence`) are consistent between the controller and the `persistence.js` stores (`missions`/`jobs`/`listings`, `keyPath: 'id'`, `job_id`/`source_listing_id` indexes). ✓
- Contract touchpoint entries use the `file` field (matching `test/listing-agent-contract.test.mjs`, which does `existsSync(path.join(ROOT, tp.file))` + `src.includes(needle)`), not `path`. ✓
