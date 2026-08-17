# AI Listing Agent — Acceptance & Merge-Gate Plan (Listing Fixtures · Node Integration Runner · Browser Acceptance Harness · Merge-Safety Gate)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the fully-wired Listing Agent satisfies the MVP-1 acceptance criteria — a deterministic Node integration runner drives the whole pure pipeline over committed Dubizzle fixtures, a Playwright harness exercises the persisted Listing Workspace end-to-end in a real Chrome extension, and a documented manual checklist covers the one live run — all folded into the upstream-merge regression gate.

**Architecture:** These are **acceptance tests layered over already-implemented modules** (Foundation → Domain-core → Pipeline → Controller → UI/Export are complete before this plan runs), so the rhythm is *lock-in*, not *stub-then-fill*: a new test starts RED only because its file/script/fixture is absent, and turns GREEN because the shipped code already behaves correctly. A red assertion here is a **real integration defect** — stop and reconcile against the cited plan/design section, do not weaken the test. Nothing in this plan adds an owned source file; the fixed 16-file owned inventory is untouched. New artifacts are **test infrastructure** (fixtures + two standalone `.mjs` runners + one manual checklist) plus additive `package.json` script wiring guarded by the existing `package.json` touchpoint.

**Tech Stack:** Node ESM (`type: module`); the repo's existing hand-rolled `test()`/`assert`/`load()` runner idiom (mirrors `test/listing-agent/run.mjs`); `playwright ^1.48.0` devDependency via `chromium.launchPersistentContext` + `--load-extension` (mirrors `test/anonymous/run.mjs`); real IndexedDB in the extension page for the persistence round-trip.

---

## Design references

This plan implements the design's verification chapter and acceptance list:

- **§13.1 — Listing fixtures.** Committed pages under `test/fixtures/listings/`: a multi-collection results page, a detail page, a listing with Furnished = Yes, a listing with Furnished = No, a listing missing an optional attribute, and a related-ads collection.
- **§13.2 — Mission-driven requirement tests.** The same fixtures under different missions (A: 2+ bed / ≤35k / New Cairo; B: + furnished; C: + furnished-or-unfurnished; D: + move-in-ready). *"The same listing must not change eligibility merely because a field exists on the source. Eligibility changes only when the mission requests that field."*
- **§13.3 — Native-filter planning tests.** Planner maps compatible requirements, ignores unrelated site filters, never invents a filter, never makes filter state the sole eligibility evidence, and falls back gracefully to unfiltered.
- **§13.4 — Unit tests** (pure functions) — already covered by `test/listing-agent/run.mjs` (87 tests). This plan does **not** re-implement them.
- **§13.5 — Integration tests.** `mission → filter planning → filter-application request → detection → extraction → evaluation → ranking → deduplication → persistence → progress`. The pure chain runs in Node; the **persistence** step needs real IndexedDB and therefore runs in the browser harness (Node has no `indexedDB` — `persistence.js` throws by design there).
- **§13.6 — Browser test.** One real Chrome run against validated Dubizzle source is the MVP-1 acceptance gate; it must verify the mission's eligible set **with native filters applied** and **without native filters applied**, proving filtering is an optimization, not a hidden dependency.
- **§13.7 — Upstream merge regression gate.** Owned files exist; touchpoints exist; hooks remain callable; unit + integration tests pass; Chrome builds; Firefox builds; a clean temp merge of `upstream/main` succeeds.
- **§13.8 — Ownership boundary.** Machine-readable manifest (`test/listing-agent-contract.json`) + contract test — extended here only by strengthening the existing `package.json` touchpoint.
- **§14 — Acceptance criteria.** The nine user-visible outcomes; this plan automates 1 (parse), 4, 5, 6, 7 and the self-termination of 9, and documents 2, 3, 8, and the live half of 1/6/7/9 in the manual checklist.

**Scope guardrails**

- **No new owned source files.** The owned inventory is fixed at 16 logical files (13 `agent/listing-agent/*.js` + `research-command.js` + `listings.html` + `listings.js`). This plan creates only `test/…` artifacts.
- **Never edit `test/run.js`** (the monolithic upstream runner) and **never edit `test/listing-agent/run.mjs`** (the 87-test unit runner). The integration tests live in a **new** standalone file so the 87-count unit baseline is untouched.
- **The integration runner is Node-pure.** It must not import `persistence.js` or reach for `indexedDB`, `window`, `document`, or `chrome`. Persistence is proven in the browser harness only.
- **`test:fixtures` already exists** (`node test/fixtures/run.mjs`, unrelated). Use the distinct script names `test:acceptance` (chained into `test`) and `test:acceptance:browser` (on-demand, like `test:anonymous`).
- Fixtures must be consumable by the **real** functions — every fixture field below matches an input shape proven in the Pipeline plan's unit tests.

**Baseline at the start of this plan** (Plans 1–5 complete, nothing from this plan applied yet)

```bash
node test/listing-agent/run.mjs      # 87 passed, 0 failed (87 total)
npm run test:contract                # 39 passed, 0 failed
node test/listing-agent/integration.mjs   # Error: Cannot find module (created in Task 2)
```

This plan leaves the unit runner at **87** and the contract at **39** (it strengthens one existing touchpoint, RED→GREEN, no new touchpoint file), and grows the new integration runner to **18**.

## Canonical shapes used across this plan

Exact shapes from the earlier plans' JSDoc — asserted verbatim here.

```js
// Requirement (parseMission output; planFilters/requirements/ranking input):
//   { id, attribute, operator, value, raw, currency? }
//   operator ∈ 'eq'|'contains'|'gte'|'lte'|'gt'|'lt'|'in'|'exists'|'not'
//
// ResearchMission (parseMission return):
//   { objective, mandatory: Requirement[], preferred: Requirement[], exclusions: Requirement[],
//     sourceDomain, options: { strict_mandatory_unknown: boolean } }
//
// Canonical Listing (normalizeCandidate/mergeDetail output):
//   { source_url, source_listing_id, title, description, price, currency, frequency,
//     attributes: { property_type, bedrooms, bathrooms, area_m2, furnishing_state,
//                   location, level, view, parking, garden, compound, availability },
//     evidence: EvidenceRecord[], evidence_confidence }
// EvidenceRecord: { value, source_text, extraction_method, confidence, verification_status, attribute? }
//
// planFilters(mission, capabilities) -> { filters: [{ attribute, value }], unmapped: Requirement[] }
//   capabilities: [{ attribute, type, values? }]
// evaluateListing(listing, mission, opts?) -> { eligibility, perRequirement: [{ requirementId, status }] }
//   eligibility ∈ 'PASS'|'FAIL'|'UNKNOWN_BLOCKED'; status ∈ 'PASS'|'FAIL'|'UNKNOWN'
// computeRanking(listing, mission) -> { score, breakdown: [{ factor, weight, contribution }] }
//   factors, in order: ['preferred','price','evidence','completeness']; weights: [50,25,15,10]
// isDuplicate(a, b) -> 1 (L1 exact URL) | 2 (L2 same source id) | 0 (distinct)
// dedupeListings(list) -> { unique: Listing[], duplicates: [{ listing, duplicateOf, level }] }
// createProgressTracker(limits?) -> { recordPage({ newUnique, elapsedMs? }),
//   snapshot() -> { pages, totalUnique, elapsedMs, noProgressStreak },
//   shouldTerminate() -> { terminate, reason } }
//   reason ∈ null|'max_duration'|'max_pages'|'max_listings'|'no_progress'
// parseResearchSlashCommand(text) -> { objective, flags: { strict?, ... }, error? }
//
// Persisted job (controller): { id, mission_id, status, terminationReason, progress,
//   counts: { total, eligible, unknown, ineligible, duplicates } }
// Persisted listing (controller): { id: `${jobId}::${sid}`, job_id, mission_id, source_url,
//   source_listing_id, title, price, currency, frequency, attributes,
//   eligibility, per_requirement: [{ requirementId, status }],
//   ranking_score, ranking_breakdown, evidence, evidence_confidence }
// persistence.js: saveMission(m), saveJob(j), saveListings(ls),
//   listJobs()->job[], getJob(id)->job, listListings(jobId)->listing[]
```

---

## Task 1: Listing fixtures (`test/fixtures/listings/`)

**Files:**
- Create: `test/fixtures/listings/results.jsonld.html`
- Create: `test/fixtures/listings/results.pagemodel.json`
- Create: `test/fixtures/listings/cards.json`
- Create: `test/fixtures/listings/detail.json`

These are static data — no test cycle of their own; Task 2 is the first consumer and its RED/GREEN validates them. Each fixture header comment cites the §13.1 case it covers.

- [ ] **Step 1: Create the JSON-LD results page** — `test/fixtures/listings/results.jsonld.html`

Covers §13.1 "multi-collection results page" (JSON-LD collection) and the §8 dedup duplicate. `@graph` holds four listing entities plus one non-listing (Organization) that `extractJsonLdListings` must skip. `E4` repeats `E1`'s source id `503863245` at a different URL → a Level-2 duplicate.

```html
<!doctype html>
<!-- Fixture (design §13.1): Dubizzle New Cairo results page, JSON-LD collection.
     4 listing entities (E1 eligible 2BR/30k, E2 eligible 3BR/32k, E3 ineligible
     1BR Maadi, E4 = repost duplicate of E1's id 503863245) + 1 non-listing that
     extractJsonLdListings must ignore. Used by test/listing-agent/integration.mjs. -->
<html lang="en"><head><meta charset="utf-8"><title>Apartments for rent in New Cairo</title>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "name": "dubizzle Egypt", "url": "https://www.dubizzle.com.eg" },
    { "@type": "Product", "name": "New Cairo 2BR", "description": "Bright flat in Fifth Settlement",
      "url": "https://www.dubizzle.com.eg/en/ad/newcairo-2br-503863245.html",
      "numberOfBedrooms": 2, "address": { "addressLocality": "New Cairo" },
      "offers": { "@type": "Offer", "price": "30000", "priceCurrency": "EGP" } },
    { "@type": "Product", "name": "New Cairo 3BR", "description": "Spacious flat",
      "url": "https://www.dubizzle.com.eg/en/ad/newcairo-3br-600000111.html",
      "numberOfBedrooms": 3, "address": { "addressLocality": "New Cairo" },
      "offers": { "@type": "Offer", "price": "32000", "priceCurrency": "EGP" } },
    { "@type": "Product", "name": "Maadi 1BR", "description": "Cozy studio-style flat",
      "url": "https://www.dubizzle.com.eg/en/ad/maadi-1br-700000222.html",
      "numberOfBedrooms": 1, "address": { "addressLocality": "Maadi" },
      "offers": { "@type": "Offer", "price": "18000", "priceCurrency": "EGP" } },
    { "@type": "Product", "name": "New Cairo 2BR (reposted)", "description": "Bright flat in Fifth Settlement",
      "url": "https://www.dubizzle.com.eg/en/ad/newcairo-2br-repost-503863245.html",
      "numberOfBedrooms": 2, "address": { "addressLocality": "New Cairo" },
      "offers": { "@type": "Offer", "price": "30000", "priceCurrency": "EGP" } }
  ]
}
</script>
</head><body><main><h1>Apartments for rent in New Cairo</h1></main></body></html>
```

- [ ] **Step 2: Create the multi-collection page model** — `test/fixtures/listings/results.pagemodel.json`

Covers §13.1 "multi-collection results page" (structural detection) and "related-ads collection". A large `list` of repeated `listitem`s (main results) and a smaller repeated `list` (related ads). `detectCollections` returns repeated-sibling groups **largest-first**, so the main results collection precedes the related-ads collection.

```json
{
  "role": "main",
  "children": [
    { "role": "heading", "name": "Apartments for rent in New Cairo" },
    { "role": "list", "name": "search-results", "children": [
      { "role": "listitem", "name": "New Cairo 2BR" },
      { "role": "listitem", "name": "New Cairo 3BR" },
      { "role": "listitem", "name": "New Cairo 2BR no area" },
      { "role": "listitem", "name": "Maadi 1BR" }
    ] },
    { "role": "complementary", "name": "related-ads", "children": [
      { "role": "list", "name": "you-may-also-like", "children": [
        { "role": "listitem", "name": "Sponsored 4BR" },
        { "role": "listitem", "name": "Sponsored villa" }
      ] }
    ] }
  ]
}
```

- [ ] **Step 3: Create the structural cards** — `test/fixtures/listings/cards.json`

Covers §13.1 "Furnished = Yes" (C1), "Furnished = No" (C2), and "missing an optional attribute" (C3 has no `area_m2` and no furnishing field). These are the per-listitem objects a model would extract in pass 1; they feed `normalizeCandidate` via the card path (alternate key spellings, `furnished` boolean).

```json
[
  { "title": "Furnished 2BR New Cairo", "href": "/en/ad/furn-800000333.html",
    "price": "EGP 33,000", "frequency": "Monthly", "bedrooms": "2", "furnished": true,
    "location": "Fifth Settlement, New Cairo", "property_type": "Apartment", "area_m2": 120 },
  { "title": "Unfurnished 3BR New Cairo", "href": "/en/ad/unfurn-900000444.html",
    "price": "EGP 32,000", "frequency": "Monthly", "bedrooms": "3", "furnished": false,
    "location": "New Cairo", "property_type": "Apartment", "area_m2": 140 },
  { "title": "2BR New Cairo (no area)", "href": "/en/ad/noarea-100000555.html",
    "price": "EGP 28,000", "frequency": "Monthly", "bedrooms": "2",
    "location": "New Cairo", "property_type": "Apartment" }
]
```

- [ ] **Step 4: Create the detail page** — `test/fixtures/listings/detail.json`

Covers §13.1 "detail page" (§4.6 detail-page facts). The pass-2 detail object enriches E1 (`503863245`) with `bathrooms`, `area_m2`, and `view` via `mergeDetail` without dropping pass-1 fields.

```json
{
  "description": "Bright corner unit, garden view, recently renovated.",
  "attributes": { "bathrooms": 2, "area_m2": 135, "view": "garden", "level": 5 }
}
```

- [ ] **Step 5: Commit**

```bash
git add test/fixtures/listings/
git commit -m "test: add Dubizzle listing fixtures for acceptance suite (design §13.1)"
```

---

## Task 2: Node integration runner — the pure pipeline (`test/listing-agent/integration.mjs`)

**Files:**
- Create: `test/listing-agent/integration.mjs`
- Modify: `package.json` (add `test:acceptance`, `test:acceptance:browser`; chain `test:acceptance` into `test`)
- Modify: `test/listing-agent-contract.json` (strengthen the existing `package.json` touchpoint)

Drives §13.5 in Node: `mission → filter planning → detection → extraction → evidence → evaluation → ranking → dedup → progress`. The persistence step is deferred to Task 4 (Node has no IndexedDB). Twelve tests this task.

- [ ] **Step 1: Add the `test:acceptance` needle to the contract (RED)**

In `test/listing-agent-contract.json`, find the touchpoint object whose `"file"` is `"package.json"` and append two needles to its `mustContain` array (leave the existing `test:contract`/`test:listing-agent` needles in place):

```json
        "\"test:acceptance\":",
        "npm run test:acceptance"
```

- [ ] **Step 2: Run the contract test to verify it now fails**

Run:
```bash
npm run test:contract
```
Expected: FAIL. The `package.json` touchpoint check fails (needles absent from `package.json`). Summary `38 passed, 1 failed`, exit 1.

- [ ] **Step 3: Wire the scripts in `package.json`**

Add both script entries to the `scripts` block (place next to the other `test:*` entries):

```json
    "test:acceptance": "node test/listing-agent/integration.mjs",
    "test:acceptance:browser": "node test/listing-agent/browser.mjs",
```

Then append `test:acceptance` to the default `test` script. The Foundation plan left it as:

```json
    "test": "npm run test:toolbar-guard && node test/run.js && npm run test:security && npm run test:contract && npm run test:listing-agent",
```

Change it to:

```json
    "test": "npm run test:toolbar-guard && node test/run.js && npm run test:security && npm run test:contract && npm run test:listing-agent && npm run test:acceptance",
```

- [ ] **Step 4: Run the contract test to confirm it passes again (GREEN)**

Run:
```bash
npm run test:contract
```
Expected: PASS. Summary `39 passed, 0 failed` (count unchanged — one existing touchpoint file, now stricter).

- [ ] **Step 5: Create the integration runner scaffold + pipeline tests**

Create `test/listing-agent/integration.mjs`:

```js
#!/usr/bin/env node
// Listing Agent — Node integration runner (design §13.5).
//
// Drives the whole PURE pipeline over committed Dubizzle fixtures:
//   mission -> filter planning -> detection -> extraction -> evidence
//           -> evaluation -> ranking -> deduplication -> progress
// Persistence (§13.5's IndexedDB step) and the workspace UI (§14 items
// 4-7) are proven in the browser harness (test/listing-agent/browser.mjs),
// because Node has no `indexedDB` and persistence.js throws there by design.
//
// These are ACCEPTANCE tests over already-shipped modules: a red assertion
// is a real integration defect — reconcile against the cited plan/design
// section, do not weaken the test.
//
// Run: npm run test:acceptance

import { strict as assert } from 'node:assert';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function load(rel) { return import(pathToFileURL(path.join(ROOT, rel)).href); }
function fixture(rel) { return readFileSync(path.join(ROOT, 'test', 'fixtures', 'listings', rel), 'utf-8'); }
function fixtureJson(rel) { return JSON.parse(fixture(rel)); }

const MISSION_MOD = 'src/chrome/src/agent/listing-agent/mission.js';
const FILTER_MOD = 'src/chrome/src/agent/listing-agent/filter-planner.js';
const DETECT_MOD = 'src/chrome/src/agent/listing-agent/detection.js';
const EXTRACT_MOD = 'src/chrome/src/agent/listing-agent/extraction.js';
const EVIDENCE_MOD = 'src/chrome/src/agent/listing-agent/evidence.js';
const REQ_MOD = 'src/chrome/src/agent/listing-agent/requirements.js';
const RANK_MOD = 'src/chrome/src/agent/listing-agent/ranking.js';
const DEDUP_MOD = 'src/chrome/src/agent/listing-agent/dedup.js';
const PROGRESS_MOD = 'src/chrome/src/agent/listing-agent/progress.js';
const RESEARCH_CMD_MOD = 'src/chrome/src/ui/research-command.js';

// The canonical MVP-1 acceptance mission (design §1.2 / Appendix J).
const ACCEPTANCE_MISSION = [
  'Objective: Find apartments for rent in New Cairo.',
  '',
  'Mandatory:',
  '2+ bedrooms',
  '≤ 35,000 EGP',
  'New Cairo',
].join('\n');

// Normalize every card in cards.json against the site origin (shared helper).
async function normalizedCards() {
  const { normalizeCandidate } = await load(EXTRACT_MOD);
  return fixtureJson('cards.json').map((c) =>
    normalizeCandidate(c, { sourceUrl: 'https://www.dubizzle.com.eg' }));
}

// Extract + normalize the JSON-LD results page (shared helper).
async function normalizedJsonLd() {
  const { extractJsonLdListings } = await load(DETECT_MOD);
  const { normalizeCandidate } = await load(EXTRACT_MOD);
  const entities = extractJsonLdListings(fixture('results.jsonld.html'));
  return { entities, listings: entities.map((e) => normalizeCandidate(e)) };
}

// --- §13.5 pipeline: mission --------------------------------------------------
test('mission: acceptance objective parses to exactly 3 mandatory requirements', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const m = parseMission(ACCEPTANCE_MISSION, { sourceDomain: 'dubizzle.com.eg' });
  assert.equal(m.mandatory.length, 3);
  assert.equal(m.preferred.length, 0);
  assert.match(m.objective, /Find apartments for rent in New Cairo/);
  const attrs = m.mandatory.map((r) => r.attribute).sort();
  assert.deepEqual(attrs, ['bedrooms', 'location', 'price']);
});

// --- §13.5 pipeline: filter planning (+ §13.3) --------------------------------
test('filter planning: maps mandatory reqs where the site exposes them; unmapped otherwise', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const { planFilters } = await load(FILTER_MOD);
  const mission = parseMission(ACCEPTANCE_MISSION);
  const capsFull = [
    { attribute: 'bedrooms', type: 'number' },
    { attribute: 'price', type: 'number' },
    { attribute: 'location', type: 'text' },
    { attribute: 'amenities', type: 'select', values: ['pool', 'gym'] }, // unrelated
  ];
  const { filters, unmapped } = planFilters(mission, capsFull);
  const byAttr = Object.fromEntries(filters.map((f) => [f.attribute, f.value]));
  assert.ok('bedrooms' in byAttr && 'price' in byAttr && 'location' in byAttr);
  assert.ok(!filters.some((f) => f.attribute === 'amenities'), 'must not invent an unrequested filter');
  assert.equal(unmapped.length, 0);

  // §13.3 item 6: no capabilities -> nothing mapped -> graceful unfiltered fallback.
  const none = planFilters(mission, []);
  assert.deepEqual(none.filters, []);
  assert.equal(none.unmapped.length, 3);
});

// --- §13.5 pipeline: detection (§4.5) -----------------------------------------
test('detection: JSON-LD extraction returns listings only, ignoring non-listings', async () => {
  const { entities } = await normalizedJsonLd();
  assert.equal(entities.length, 4, 'Organization entity must be dropped');
  assert.ok(entities.every((e) => e.name && e.url));
});

test('detection: structural collections are largest-first with related-ads last', async () => {
  const { detectCollections, detectListingBoundaries } = await load(DETECT_MOD);
  const pageModel = fixtureJson('results.pagemodel.json');
  const collections = detectCollections(pageModel);
  assert.ok(collections.length >= 2, 'main results + related-ads');
  assert.ok(collections[0].size >= collections[1].size, 'largest collection first');
  assert.equal(collections[0].size, 4);
  assert.equal(detectListingBoundaries(collections[0]).length, 4);
  assert.equal(detectListingBoundaries(collections[1]).length, 2, 'related-ads group');
});

// --- §13.5 pipeline: extraction (§4.4) ----------------------------------------
test('extraction: JSON-LD entity normalizes to a canonical listing with source id', async () => {
  const { listings } = await normalizedJsonLd();
  const l = listings.find((x) => x.source_listing_id === '503863245');
  assert.ok(l, 'E1 by id');
  assert.equal(l.price, 30000);
  assert.equal(l.currency, 'EGP');
  assert.equal(l.attributes.bedrooms, 2);
  assert.equal(l.attributes.location, 'New Cairo');
});

test('extraction: cards normalize furnished/unfurnished and tolerate a missing attribute', async () => {
  const cards = await normalizedCards();
  const [c1, c2, c3] = cards;
  assert.equal(c1.attributes.furnishing_state, 'furnished');
  assert.equal(c1.price, 33000);
  assert.equal(c2.attributes.furnishing_state, 'unfurnished');
  assert.equal(c3.source_listing_id, '100000555');
  assert.equal(c3.attributes.area_m2, undefined, 'missing optional stays absent, not invented');
});

test('extraction: mergeDetail enriches the pass-1 candidate without losing fields', async () => {
  const { mergeDetail } = await load(EXTRACT_MOD);
  const { listings } = await normalizedJsonLd();
  const e1 = listings.find((x) => x.source_listing_id === '503863245');
  const merged = mergeDetail(e1, fixtureJson('detail.json'));
  assert.equal(merged.title, e1.title, 'pass-1 title preserved');
  assert.equal(merged.attributes.bedrooms, 2, 'pass-1 attribute preserved');
  assert.equal(merged.attributes.bathrooms, 2, 'pass-2 attribute added');
  assert.equal(merged.attributes.area_m2, 135);
  assert.equal(merged.source_listing_id, '503863245');
});

// --- §13.5 pipeline: evidence (§5) --------------------------------------------
test('evidence: aggregateConfidence weights mandatory-referenced attributes 2x', async () => {
  const { makeEvidence, aggregateConfidence } = await load(EVIDENCE_MOD);
  const listing = {
    evidence: [
      makeEvidence({ attribute: 'bedrooms', confidence: 1.0 }),
      makeEvidence({ attribute: 'price', confidence: 0.8 }),
      makeEvidence({ attribute: 'view', confidence: 0.4 }),
    ],
  };
  const mission = { mandatory: [{ attribute: 'bedrooms' }, { attribute: 'price' }] };
  const c = aggregateConfidence(listing, mission);
  assert.ok(c >= 0 && c <= 1);
  assert.equal(c, 0.8);
});

// --- §13.5 pipeline: evaluation (§6) ------------------------------------------
test('evaluation: mission A yields PASS/PASS/FAIL over the JSON-LD listings', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const { evaluateListing } = await load(REQ_MOD);
  const { dedupeListings } = await load(DEDUP_MOD);
  const mission = parseMission(ACCEPTANCE_MISSION);
  const { unique } = dedupeListings((await normalizedJsonLd()).listings);
  const verdict = Object.fromEntries(
    unique.map((l) => [l.source_listing_id, evaluateListing(l, mission).eligibility]));
  assert.equal(verdict['503863245'], 'PASS');   // 2BR / 30k / New Cairo
  assert.equal(verdict['600000111'], 'PASS');   // 3BR / 32k / New Cairo
  assert.equal(verdict['700000222'], 'FAIL');   // 1BR / Maadi
});

// --- §13.5 pipeline: deduplication (§8) ---------------------------------------
test('deduplication: the reposted ad is a Level-2 duplicate of the original', async () => {
  const { dedupeListings } = await load(DEDUP_MOD);
  const { unique, duplicates } = dedupeListings((await normalizedJsonLd()).listings);
  assert.equal(unique.length, 3);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].level, 2);
  assert.equal(duplicates[0].duplicateOf, '503863245');
});

// --- §13.5 pipeline: ranking (§7) ---------------------------------------------
test('ranking: breakdown carries the canonical factors/weights and a bounded score', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const { computeRanking } = await load(RANK_MOD);
  const mission = parseMission(ACCEPTANCE_MISSION);
  const e1 = (await normalizedJsonLd()).listings.find((x) => x.source_listing_id === '503863245');
  const { score, breakdown } = computeRanking(e1, mission);
  assert.deepEqual(breakdown.map((b) => b.factor), ['preferred', 'price', 'evidence', 'completeness']);
  assert.deepEqual(breakdown.map((b) => b.weight), [50, 25, 15, 10]);
  assert.ok(score >= 0 && score <= 100);
  // Cheaper listing ranks the price term no lower than a pricier one.
  const pricier = { ...e1, price: 34000 };
  assert.ok(computeRanking(e1, mission).score >= computeRanking(pricier, mission).score);
});

// --- §13.5 full-chain assembly: counts mirror the controller's job.counts -----
test('full chain: assembled counts are total=3, eligible=2, ineligible=1, unknown=0, duplicates=1', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const { evaluateListing } = await load(REQ_MOD);
  const { dedupeListings } = await load(DEDUP_MOD);
  const mission = parseMission(ACCEPTANCE_MISSION);
  const { unique, duplicates } = dedupeListings((await normalizedJsonLd()).listings);
  const evald = unique.map((l) => evaluateListing(l, mission).eligibility);
  const counts = {
    total: unique.length,
    eligible: evald.filter((e) => e === 'PASS').length,
    unknown: evald.filter((e) => e === 'UNKNOWN_BLOCKED').length,
    ineligible: evald.filter((e) => e === 'FAIL').length,
    duplicates: duplicates.length,
  };
  assert.deepEqual(counts, { total: 3, eligible: 2, unknown: 0, ineligible: 1, duplicates: 1 });
});

// --- run ---
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`✓ ${t.name}`); passed++; }
  catch (err) { console.error(`✗ ${t.name}\n  ${err && err.message}`); failed++; }
}
console.log(`\n${passed} passed, ${failed} failed (${tests.length} total)`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 6: Run the integration runner and confirm all pass**

Run:
```bash
npm run test:acceptance
```
Expected: PASS. Summary `12 passed, 0 failed (12 total)`, exit 0. A failure here is a genuine pipeline integration defect — reconcile against the cited section before continuing.

- [ ] **Step 7: Commit**

```bash
git add test/listing-agent/integration.mjs package.json test/listing-agent-contract.json
git commit -m "test: Node integration runner for the Listing Agent pipeline (design §13.5)"
```

---

## Task 3: Node integration runner — mission variance, filter invariant, termination, parse-confirm

**Files:**
- Modify: `test/listing-agent/integration.mjs` (append six tests above the `// --- run ---` divider)

Covers §13.2 (eligibility tracks the *mission*, not field presence), §13.6/§4.3 (filters never change a listing's judgment), §14 item 9 (self-termination), and the deterministic core of §14 item 1 (parse → confirm).

- [ ] **Step 1: Append the mission-variance, invariant, termination, and parse tests**

Insert immediately **above** the `// --- run ---` divider in `test/listing-agent/integration.mjs`:

```js
// --- §13.2 mission variance: eligibility follows the mission, not field presence ---
// Build B/C/D by parsing A then adding one explicit mandatory requirement, so the
// listings are byte-identical across missions — only the mission changes.
async function missionsAtoD() {
  const { parseMission } = await load(MISSION_MOD);
  const A = parseMission(ACCEPTANCE_MISSION, { sourceDomain: 'dubizzle.com.eg' });
  const withReq = (req) => ({ ...A, mandatory: [...A.mandatory, req] });
  return {
    A,
    B: withReq({ id: 'req-furn', attribute: 'furnishing_state', operator: 'eq', value: 'furnished', raw: 'furnished' }),
    C: withReq({ id: 'req-furn2', attribute: 'furnishing_state', operator: 'in', value: ['furnished', 'unfurnished'], raw: 'furnished or unfurnished' }),
    D: withReq({ id: 'req-ready', attribute: 'availability', operator: 'contains', value: 'ready', raw: 'move-in ready' }),
  };
}

test('§13.2: a known unfurnished listing flips PASS->FAIL only when the mission requests furnishing', async () => {
  const { evaluateListing } = await load(REQ_MOD);
  const { A, B } = await missionsAtoD();
  const [c1, c2] = await normalizedCards(); // c1 furnished, c2 unfurnished — both New Cairo, >=2BR, <=35k
  assert.equal(evaluateListing(c1, A).eligibility, 'PASS');
  assert.equal(evaluateListing(c2, A).eligibility, 'PASS'); // furnishing field present but NOT requested
  assert.equal(evaluateListing(c1, B).eligibility, 'PASS'); // is furnished
  assert.equal(evaluateListing(c2, B).eligibility, 'FAIL'); // is unfurnished, now requested
});

test('§13.2: a listing lacking the field goes UNKNOWN_BLOCKED (lenient), never a silent FAIL', async () => {
  const { evaluateListing } = await load(REQ_MOD);
  const { A, B } = await missionsAtoD();
  const c3 = (await normalizedCards())[2]; // no furnishing field at all
  assert.equal(evaluateListing(c3, A).eligibility, 'PASS');            // not requested -> fine
  assert.equal(evaluateListing(c3, B).eligibility, 'UNKNOWN_BLOCKED'); // requested but unknown -> blocked, not failed
});

test('§13.2: mission C (furnished OR unfurnished) admits both furnished and unfurnished listings', async () => {
  const { evaluateListing } = await load(REQ_MOD);
  const { C } = await missionsAtoD();
  const [c1, c2] = await normalizedCards();
  assert.equal(evaluateListing(c1, C).eligibility, 'PASS');
  assert.equal(evaluateListing(c2, C).eligibility, 'PASS');
});

test('§13.2: mission D (move-in ready) blocks on the unknown availability of both cards', async () => {
  const { evaluateListing } = await load(REQ_MOD);
  const { D } = await missionsAtoD();
  const [c1, c2] = await normalizedCards();
  assert.equal(evaluateListing(c1, D).eligibility, 'UNKNOWN_BLOCKED');
  assert.equal(evaluateListing(c2, D).eligibility, 'UNKNOWN_BLOCKED');
});

// --- §13.6 / §4.3: native filters are an optimization, never eligibility evidence ---
test('§13.6: a listing is judged identically whether or not the site offered native filters', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const { planFilters } = await load(FILTER_MOD);
  const { evaluateListing } = await load(REQ_MOD);
  const { computeRanking } = await load(RANK_MOD);
  const mission = parseMission(ACCEPTANCE_MISSION);
  const e1 = (await normalizedJsonLd()).listings.find((x) => x.source_listing_id === '503863245');

  // "With filters": the site exposes bedrooms/price/location -> a non-empty plan.
  const withPlan = planFilters(mission, [
    { attribute: 'bedrooms', type: 'number' },
    { attribute: 'price', type: 'number' },
    { attribute: 'location', type: 'text' },
  ]);
  assert.ok(withPlan.filters.length > 0);
  // "Without filters": the site exposes none -> empty plan, unfiltered crawl.
  const withoutPlan = planFilters(mission, []);
  assert.deepEqual(withoutPlan.filters, []);

  // evaluateListing/computeRanking never receive the plan; the verdict is invariant.
  const judge = () => ({
    eligibility: evaluateListing(e1, mission).eligibility,
    score: computeRanking(e1, mission).score,
  });
  assert.deepEqual(judge(), judge());
  assert.equal(evaluateListing(e1, mission).eligibility, 'PASS');
});

// --- §14 item 9: the run self-terminates within its configured limits -----------
test('§14.9: progress tracker terminates on max listings and on a no-progress streak', async () => {
  const { createProgressTracker } = await load(PROGRESS_MOD);
  const byListings = createProgressTracker({ maxListings: 3 });
  byListings.recordPage({ newUnique: 3 });
  assert.deepEqual(byListings.shouldTerminate(), { terminate: true, reason: 'max_listings' });

  const byStall = createProgressTracker({ noProgressPageThreshold: 2 });
  byStall.recordPage({ newUnique: 0 });
  byStall.recordPage({ newUnique: 0 });
  assert.deepEqual(byStall.shouldTerminate(), { terminate: true, reason: 'no_progress' });
});

// --- §14 item 1: /research parses the acceptance mission into a confirmable summary ---
test('§14.1: parseResearchSlashCommand + parseMission produce a confirmable 3-requirement mission', async () => {
  const { parseResearchSlashCommand } = await load(RESEARCH_CMD_MOD);
  const { parseMission } = await load(MISSION_MOD);
  const parsed = parseResearchSlashCommand('/research ' + ACCEPTANCE_MISSION);
  assert.equal(parsed.error, undefined);
  assert.match(parsed.objective, /Find apartments for rent in New Cairo/);
  const mission = parseMission(parsed.objective, { sourceDomain: 'dubizzle.com.eg' });
  assert.equal(mission.mandatory.length, 3, 'the confirmation would show 3 mandatory requirements');
});
```

- [ ] **Step 2: Run the integration runner and confirm all pass**

Run:
```bash
npm run test:acceptance
```
Expected: PASS. Summary `18 passed, 0 failed (18 total)`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add test/listing-agent/integration.mjs
git commit -m "test: mission-variance, filter invariant, termination & parse-confirm (design §13.2/§13.6/§14)"
```

---

## Task 4: Browser acceptance harness (`test/listing-agent/browser.mjs`)

**Files:**
- Create: `test/listing-agent/browser.mjs`

Runs the §13.5 **persistence round-trip** and §14 acceptance items **4** (structured attributes, eligibility, ranking, evidence), **5** (no duplicates), **6** (open original URL), and **7** (export JSON + CSV) against a real Chrome extension. It seeds IndexedDB via `persistence.js` in the page context, reloads the workspace, and asserts the rendered result. It needs **no** LLM provider (it never runs the agent loop). On-demand only (headed Chromium), via `npm run test:acceptance:browser`; not chained into `npm test`.

- [ ] **Step 1: Create the harness**

Create `test/listing-agent/browser.mjs`:

```js
#!/usr/bin/env node
// Listing Agent — browser acceptance harness (design §13.5 persistence round-trip
// + §14 acceptance items 4,5,6,7).
//
// Loads the unpacked Chrome extension, opens the Listing Workspace, seeds a job
// + listings straight into the page's real IndexedDB via persistence.js, reloads,
// and asserts the workspace renders eligible/deduped cards with links, then that
// JSON and CSV export round-trip. No LLM provider is required (no agent loop).
//
// Run: npm run test:acceptance:browser

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { strict as assert } from 'node:assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const extensionPath = path.join(root, 'src', 'chrome');
const profileDir = path.join(__dirname, '.acceptance-profile');

// Seed matches the controller's persisted job/listing shapes. Three unique
// listings (the reposted duplicate is intentionally absent — dedup already
// dropped it upstream, so item 5 "no duplicate records" holds by construction).
const MISSION_ID = 'mission-accept-1';
const JOB_ID = 'job-accept-1';
const listing = (sid, over) => ({
  id: `${JOB_ID}::${sid}`, job_id: JOB_ID, mission_id: MISSION_ID,
  source_listing_id: sid, frequency: 'Monthly', currency: 'EGP',
  per_requirement: [{ requirementId: 'r-bed', status: 'PASS' }],
  ranking_breakdown: [
    { factor: 'preferred', weight: 50, contribution: 50 },
    { factor: 'price', weight: 25, contribution: 20 },
    { factor: 'evidence', weight: 15, contribution: 12 },
    { factor: 'completeness', weight: 10, contribution: 8 },
  ],
  evidence: [{ attribute: 'bedrooms', value: 2, source_text: '2 BR',
    extraction_method: 'jsonld', confidence: 0.9, verification_status: 'unverified' }],
  evidence_confidence: 0.85,
  ...over,
});
const SEED = {
  mission: { id: MISSION_ID, objective: 'Find apartments for rent in New Cairo.',
    mandatory: [{ id: 'r-bed', attribute: 'bedrooms', operator: 'gte', value: 2, raw: '2+ bedrooms' }],
    preferred: [], exclusions: [], sourceDomain: 'dubizzle.com.eg',
    options: { strict_mandatory_unknown: false } },
  job: { id: JOB_ID, mission_id: MISSION_ID, status: 'complete', terminationReason: 'no_progress',
    counts: { total: 3, eligible: 2, unknown: 0, ineligible: 1, duplicates: 1 } },
  listings: [
    listing('503863245', { title: 'New Cairo 2BR', price: 30000, eligibility: 'PASS', ranking_score: 90,
      source_url: 'https://www.dubizzle.com.eg/en/ad/newcairo-2br-503863245.html',
      attributes: { bedrooms: 2, location: 'New Cairo', furnishing_state: 'furnished', area_m2: 135 } }),
    listing('600000111', { title: 'New Cairo 3BR', price: 32000, eligibility: 'PASS', ranking_score: 88,
      source_url: 'https://www.dubizzle.com.eg/en/ad/newcairo-3br-600000111.html',
      attributes: { bedrooms: 3, location: 'New Cairo', area_m2: 150 } }),
    listing('700000222', { title: 'Maadi 1BR', price: 18000, eligibility: 'FAIL', ranking_score: 20,
      source_url: 'https://www.dubizzle.com.eg/en/ad/maadi-1br-700000222.html',
      attributes: { bedrooms: 1, location: 'Maadi' } }),
  ],
};

function skip(msg) { console.log(`SKIP (browser acceptance): ${msg}`); process.exit(0); }

async function main() {
  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: false,
      acceptDownloads: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
  } catch (e) {
    skip(`could not launch headed Chromium (${e && e.message}). Run from a desktop session.`);
  }

  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 10_000 });
  const extensionId = new URL(sw.url()).host;
  console.log(`extension loaded, id=${extensionId}`);

  const page = await context.newPage();
  const workspaceUrl = `chrome-extension://${extensionId}/src/ui/listings.html`;
  await page.goto(workspaceUrl);

  // Seed real IndexedDB through the shipped persistence module, then reload so
  // listings.js reads it back — this IS the §13.5 persistence round-trip.
  await page.evaluate(async (seed) => {
    const p = await import('/src/agent/listing-agent/persistence.js');
    await p.saveMission(seed.mission);
    await p.saveJob(seed.job);
    await p.saveListings(seed.listings);
  }, SEED);

  // Confirm the round-trip at the data layer before touching the DOM.
  const readBack = await page.evaluate(async (jobId) => {
    const p = await import('/src/agent/listing-agent/persistence.js');
    const jobs = await p.listJobs();
    const job = await p.getJob(jobId);
    const listings = await p.listListings(jobId);
    return { jobCount: jobs.length, counts: job && job.counts, listingCount: listings.length };
  }, JOB_ID);
  assert.equal(readBack.jobCount, 1, 'one job persisted');
  assert.equal(readBack.listingCount, 3, 'three listings persisted');
  assert.equal(readBack.counts.duplicates, 1, 'job.counts.duplicates survived the round-trip');

  await page.reload();
  await page.waitForSelector('#listing-list .card', { timeout: 10_000 });

  // §14.4: structured cards with eligibility + ranking rendered.
  const cardCount = await page.locator('#listing-list .card').count();
  assert.equal(cardCount, 3, '§14.4: three listing cards render');
  const badges = await page.locator('#listing-list .badge').allInnerTexts();
  assert.ok(badges.some((b) => /PASS/i.test(b)), '§14.4: eligibility badge shown');

  // §14.5: no duplicate records — count pill reflects the 3 unique listings.
  const pill = (await page.locator('#count-pill').innerText()).trim();
  assert.match(pill, /3/, '§14.5: count reflects 3 unique listings, no duplicate row');

  // §14.6: each card links to the original ad URL.
  const links = await page.locator('#listing-list .card a[href^="https://www.dubizzle.com.eg/"]').count();
  assert.equal(links, 3, '§14.6: every card exposes its source_url');

  // §14.7: JSON export round-trips to a schema-versioned array of 3 listings.
  const [jsonDl] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-export-json'),
  ]);
  const jsonText = readFileSync(await jsonDl.path(), 'utf-8');
  const parsed = JSON.parse(jsonText);
  assert.equal(parsed.schema_version, 1, '§14.7: export carries EXPORT_SCHEMA_VERSION');
  assert.equal(parsed.listings.length, 3, '§14.7: JSON export has 3 listings');

  // §14.7: CSV export round-trips with the 16-column header row.
  const [csvDl] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-export-csv'),
  ]);
  const csvText = readFileSync(await csvDl.path(), 'utf-8');
  const header = csvText.split(/\r?\n/)[0];
  assert.equal(header.split(',').length, 16, '§14.7: CSV header has all 16 columns');

  await context.close();
  console.log('\nPASS (browser acceptance): §13.5 persistence round-trip + §14 items 4,5,6,7');
}

main().catch((err) => {
  console.error(`\nFAIL (browser acceptance): ${err && err.stack || err}`);
  process.exit(1);
});
```

- [ ] **Step 2: Run the harness on a desktop session**

Run:
```bash
npm run test:acceptance:browser
```
Expected: a Chromium window opens, the workspace renders the seeded job, and the run prints `PASS (browser acceptance): …` and exits 0. On a headless/CI box with no display it prints `SKIP (browser acceptance): …` and exits 0. A `FAIL` line with a non-zero exit is a real workspace/persistence/export defect — reconcile against Plan 5 (UI/Export) or the Pipeline plan's persistence store.

- [ ] **Step 3: Commit**

```bash
git add test/listing-agent/browser.mjs
git commit -m "test: Playwright workspace acceptance harness (design §13.5 persistence + §14.4-7)"
```

---

## Task 5: Manual live-run acceptance checklist (`test/fixtures/listings/ACCEPTANCE.md`)

**Files:**
- Create: `test/fixtures/listings/ACCEPTANCE.md`

§13.6 requires **one real Chrome run against validated Dubizzle source**, verifying the eligible set **with** and **without** native filters. That run is inherently manual (live site, live LLM). This checklist is the committed record of it and covers the live half of §14 items 1, 2, 3, 6, 7, 8, and 9.

- [ ] **Step 1: Write the checklist**

Create `test/fixtures/listings/ACCEPTANCE.md`:

```markdown
# MVP-1 Live Acceptance Checklist (design §13.6, §14)

One real Chrome run against dubizzle.com.eg. Prerequisites: build + load the
unpacked Chrome extension (`npm run build:zip` or load `src/chrome/`), configure
an LLM provider in Settings. Record date, provider/model, and the run's job id.

The automated suites already cover the deterministic half:
`npm run test:acceptance` (pipeline, mission variance, filter invariant,
termination, parse) and `npm run test:acceptance:browser` (persistence round-trip,
workspace render, export). This checklist covers only what needs the live site.

## Run

- [ ] **§14.1 — Mission creation.** In the side panel type `/research` with the
      Appendix J mission (Objective: Find apartments for rent in New Cairo;
      Mandatory: 2+ bedrooms, ≤ 35,000 EGP, New Cairo). Confirm the panel echoes
      a parsed mission with **exactly 3 mandatory requirements** before starting.
- [ ] **§14.2 — Start in place.** From the New Cairo apartments-for-rent results
      page, start the research run.
- [ ] **§14.3 — Auto-advance.** The agent advances through result pages on its
      own — no manual scrolling or clicking.
- [ ] **§13.6 WITH native filters.** Let the agent apply the site's bedrooms /
      price / location filters. Record the eligible listing set (ids).
- [ ] **§13.6 WITHOUT native filters.** Re-run the same mission with native
      filters cleared/disabled. Record the eligible set again.
- [ ] **§13.6 invariant.** Every listing that appears in **both** runs has the
      **same eligibility and ranking**. Filters changed only *which* listings
      were surfaced and how fast — never *how* a surfaced listing was judged.
- [ ] **§14.6 — Open original.** Open at least one listing's original ad URL
      from the workspace.
- [ ] **§14.7 — Export.** Export the results as JSON and as CSV; open both.
- [ ] **§14.8 — Cancel.** Start another run and stop/cancel it mid-crawl; the
      agent halts promptly and the partial job is still viewable.
- [ ] **§14.9 — Self-terminate.** Start a run and leave it; it self-terminates
      within the configured limits (max pages / max listings / no-progress /
      max duration) without manual intervention.

## Result

- Date / provider / model / job id: ______________________
- WITH-filters eligible ids: ______________________
- WITHOUT-filters eligible ids: ______________________
- Invariant held (common listings judged identically): ☐ yes ☐ no — notes: ____
```

- [ ] **Step 2: Commit**

```bash
git add test/fixtures/listings/ACCEPTANCE.md
git commit -m "docs: MVP-1 live acceptance checklist (design §13.6/§14)"
```

---

## Task 6: Full merge-safety gate (§13.7) & Self-Review

**Files:**
- Modify: `package.json` (chain `test:acceptance` into `test:merge-safety`)

Folds the integration runner into the on-demand merge gate and runs the whole §13.7 seven-point regression: owned files exist, touchpoints exist, hooks callable, unit + integration pass, Chrome builds, Firefox builds, clean upstream merge.

- [ ] **Step 1: Chain `test:acceptance` into the merge-safety gate**

The Foundation plan defined:

```json
    "test:merge-safety": "npm run test:contract && npm run test:listing-agent && node test/listing-agent-merge-rehearsal.test.mjs",
```

Insert `test:acceptance` between the unit runner and the merge rehearsal (so §13.7 item 4 includes integration tests before the network-touching rehearsal):

```json
    "test:merge-safety": "npm run test:contract && npm run test:listing-agent && npm run test:acceptance && node test/listing-agent-merge-rehearsal.test.mjs",
```

- [ ] **Step 2: Run the default suite (owned files, touchpoints, hooks, unit + integration)**

Run:
```bash
npm test
```
Expected: PASS end-to-end. The trailing Listing-Agent stages print `39 passed, 0 failed` (contract), `87 passed, 0 failed (87 total)` (unit), and `18 passed, 0 failed (18 total)` (integration). This satisfies §13.7 items 1–4.

- [ ] **Step 3: Build both browser targets (§13.7 items 5–6)**

Run:
```bash
npm run build:zip
```
Expected: PASS — the Chrome and Firefox zips build with no missing-file or parse errors, confirming both trees (including every owned mirrored module) are shippable.

- [ ] **Step 4: Run the on-demand merge gate (§13.7 items 1–4 + 7)**

Run:
```bash
npm run test:merge-safety
```
Expected: PASS — contract + unit + integration pass, then the merge rehearsal dry-merges `upstream/main` in a disposable detached worktree with no conflict (or prints its offline SKIP). A conflict here is a blocking merge regression, not a test bug.

- [ ] **Step 5: Run the browser acceptance harness once (desktop)**

Run:
```bash
npm run test:acceptance:browser
```
Expected: `PASS (browser acceptance): …` and exit 0 on a desktop session (or `SKIP …` with no display).

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "test: fold integration runner into the merge-safety gate (design §13.7)"
```

- [ ] **Step 7: Final review**

The Listing Agent MVP-1 is now verified end-to-end: deterministic Node integration over committed Dubizzle fixtures, a real-extension persistence-and-workspace round-trip, a documented live run, and a self-guarding upstream-merge gate — with the owned 16-file inventory untouched and the contract still at 39.

## Self-Review

**1. Spec coverage.**

- §13.1 listing fixtures (multi-collection page, detail page, Furnished Yes/No, missing optional attribute, related-ads) — Task 1's four fixtures; each §13.1 case is annotated in a fixture header. ✓
- §13.2 mission-driven requirement tests (A/B/C/D; "field presence ≠ eligibility change") — Task 3's four variance tests, including the known-value FAIL vs unknown-value UNKNOWN_BLOCKED contrast. ✓
- §13.3 native-filter planning (map / ignore unrelated / never invent / not sole evidence / graceful fallback) — mapping + no-invent + empty-caps fallback in Task 2's filter test; "not sole evidence" is Task 3's §13.6 invariant (eligibility never receives the plan). ✓
- §13.4 unit tests — pre-existing (`run.mjs`, 87); explicitly not duplicated. ✓
- §13.5 integration chain (mission → filter → detection → extraction → evaluation → ranking → dedup → progress) — Task 2 end-to-end; the **persistence** link runs in Task 4's browser round-trip because Node has no IndexedDB. ✓
- §13.6 browser test with/without native filters — deterministic invariant in Task 3 + the live with/without comparison in Task 5's checklist. ✓
- §13.7 merge regression gate (7 checks) — Task 6: items 1–4 (`npm test` incl. integration), 5–6 (`build:zip`), 1–3 + 7 (`test:merge-safety` + rehearsal). ✓
- §13.8 ownership boundary — no new owned files; the existing `package.json` touchpoint is strengthened (RED→GREEN), contract stays 39. ✓
- §14 items 1,4,5,6,7,9 — automated across Tasks 2–4; items 2,3,8 and the live half of 1,6,7,9 — Task 5 checklist. ✓

**2. Placeholder scan.** No "TBD / implement later / handle edge cases". Every runner is shown in full; every fixture is complete literal data; every run step states the exact command and the exact expected summary line. The browser harness's `skip()`/`FAIL` branches are real environment handling (mirroring `test/anonymous/run.mjs`), not stubs.

**3. Type consistency.** Assertions match the shapes defined in the earlier plans: `evaluateListing → { eligibility, perRequirement }` (eligibility ∈ PASS/FAIL/UNKNOWN_BLOCKED); `computeRanking → { score, breakdown:[{factor,weight,contribution}] }` with factors `['preferred','price','evidence','completeness']`/weights `[50,25,15,10]`; `dedupeListings → { unique, duplicates:[{listing,duplicateOf,level}] }` (level 2 for a same-source-id repost); `planFilters → { filters:[{attribute,value}], unmapped }`; `createProgressTracker().shouldTerminate() → { terminate, reason }`; `parseResearchSlashCommand → { objective, flags, error? }`. The browser seed uses the controller's persisted field names (`id`=`${jobId}::${sid}`, `job_id`, `mission_id`, `eligibility`, `per_requirement`, `ranking_score`, `ranking_breakdown`, `evidence`, `evidence_confidence`, `counts.{total,eligible,unknown,ineligible,duplicates}`) and the `persistence.js` API (`saveMission`/`saveJob`/`saveListings`/`listJobs`/`getJob`/`listListings`). The workspace selectors (`#listing-list`, `.card`, `.badge`, `#count-pill`, `#btn-export-json`, `#btn-export-csv`) and the export shape (`schema_version`, `listings[]`, 16-column CSV header) match Plan 5. ✓
