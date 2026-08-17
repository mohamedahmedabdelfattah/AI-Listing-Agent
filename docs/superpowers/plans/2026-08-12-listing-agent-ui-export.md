# AI Listing Agent — Listing Workspace UI & Export Plan (Export Serializers · Workspace i18n · Listing Workspace Markup · Workspace Logic)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the persisted, ranked, evidence-backed listings produced by the controller into a reviewable **Listing Workspace** — a job picker, client-side filters/sort, ranked cards showing eligibility + per-requirement evidence, shortlist save/reject, and JSON/CSV export — backed by the pure `export.js` serializers.

**Architecture:** `export.js` is a **pure, Node-importable** module: `listingsToJson` wraps a job + its listings in a versioned envelope; `listingsToCsv` flattens each listing (including its nested `attributes`) into a fixed 16-column, RFC-4180-quoted, CRLF-delimited table. The UI is **browser-only**: `listings.html` is static markup with dark-theme styling identical to `traces.html`, and `listings.js` (which touches `document` at module load, so it is **excluded from the Node unit runner**) reads jobs/listings from the injected `persistence.js` IndexedDB layer, renders cards, filters/sorts entirely client-side (§13.6 — the same UI whether or not the site had native filters), toggles shortlist state via `saveListing`, and downloads exports via the house Blob/anchor idiom. All four files are already **owned** and **byte-identically mirrored** (Foundation), so implementing them and re-`cp`-ing keeps the contract's parity checks green.

**Tech Stack:** JavaScript (native browser ESM), Node.js (`node:assert` + the repo's hand-rolled harness), the `test/listing-agent/run.mjs` unit runner, the `test/listing-agent-contract.test.mjs` merge-safety contract, the existing `i18n.js` / `utils.js` UI helpers, and the `persistence.js` IndexedDB store.

---

## Design references

- **§11 — Listing Workspace UI:** job picker, ranked cards with eligibility badge + per-requirement chips + evidence confidence, shortlist save/reject, empty state.
- **§12 — Export:** JSON (full fidelity, versioned envelope) and CSV (flattened, spreadsheet-friendly) downloads of the currently-visible listings.
- **§13.6 — With/without native site filters:** the workspace applies the **same** client-side filters and sort regardless of whether dubizzle's own filters were available during collection, so the reviewer always has a consistent control surface.

**Scope guardrails for this plan:**
- Fills these Foundation stubs only: `export.js` (`src/<build>/src/agent/listing-agent/`), and `listings.html` + `listings.js` (`src/<build>/src/ui/`). All three are already **owned** and **byte-identically mirrored** (Foundation), so implementing them and re-`cp`-ing keeps the contract's parity checks green at **39** after each mirror.
- Adds an `ls.*` translation block to `locales/en.js` in **both** builds (Task 2). `en.js` differs between chrome and firefox, so it is edited per-build (never `cp`) using a text anchor that is **identical across builds** — only line numbers drift.
- Extends `test/listing-agent/run.mjs` only (never the monolithic `test/run.js`). The unit runner grows **80 → 87** (Task 1's seven `export.js` tests). `listings.html` and `listings.js` touch `document` at load and stay out of the Node runner; their behavior is verified by the Plan 6 Playwright suite, and their merge-safety is guarded by the mirrored-pair parity check.
- **Adds no new touchpoint files and no new owned files.** Filter / sort / summary logic lives *inside* the browser-only `listings.js`. Task 2 only **strengthens** the two existing `en.js` touchpoints (adds the `"ls.title"` needle), so the contract stays at **39** throughout (the contract counts one check per touchpoint *file*, not per needle).
- `progress.js`, `research-skill.js`, `controller.js`, `research-command.js`, and the `/research` wiring remain as the Controller plan left them. Execution handoff is intentionally **not** offered at the end of this plan.

**Baseline at the start of this plan** (end of the Controller plan): `node test/listing-agent/run.mjs` → `80 passed, 0 failed (80 total)`; `node test/listing-agent-contract.test.mjs` → `39 passed, 0 failed`.

---

## Canonical shapes used across this plan

**Persisted job** (written by the controller, read by the workspace):

```js
// { id, mission_id, status, objective,
//   counts: { total, eligible, unknown, ineligible, duplicates } }
```

**Persisted listing** (one record; `attributes` is the normalized nested block, the rest are controller-added top-level fields):

```js
// { id: `${jobId}::${sid}`, job_id, mission_id,
//   title, description, source_url, source_listing_id, price, currency, frequency,
//   attributes: { property_type, bedrooms, bathrooms, area_m2, furnishing_state, location, ... },
//   eligibility,            // 'PASS' | 'FAIL' | 'UNKNOWN_BLOCKED'
//   per_requirement,        // [{ requirementId, status }]  status ∈ 'PASS'|'FAIL'|'UNKNOWN'
//   ranking_score, ranking_breakdown, evidence, evidence_confidence,
//   shortlisted?            // added by this plan's save/reject action
// }
```

**Export JSON envelope** (returned by `listingsToJson`):

```js
// { schema_version: 1, job: <job|null>, listing_count: <n>, listings: [<listing>, ...] }
```

**CSV columns** (the frozen 16-column order emitted by `listingsToCsv`; the six attribute columns are flattened out of `attributes`):

```js
// id, source_url, source_listing_id, title, price, currency, frequency,
// property_type, bedrooms, bathrooms, area_m2, furnishing_state, location,
// eligibility, ranking_score, evidence_confidence
```

---

## Task 1: Pure JSON + CSV result export (`export.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "UI: result export" block)
- Implement: `src/chrome/src/agent/listing-agent/export.js`
- Mirror: `src/firefox/src/agent/listing-agent/export.js`

- [ ] **Step 1: Append the failing export tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- UI: result export ------------------------------------------------------
const EXPORT_MOD = 'src/chrome/src/agent/listing-agent/export.js';

function sampleJob() {
  return {
    id: 'job-1000',
    mission_id: 'mission-1',
    status: 'completed',
    objective: 'Find 3-bedroom apartments for rent in New Cairo under 35000 EGP.',
    counts: { total: 2, eligible: 1, unknown: 0, ineligible: 1, duplicates: 0 },
  };
}

function sampleListings() {
  return [
    {
      id: 'job-1000::503863245', job_id: 'job-1000',
      source_url: 'https://www.dubizzle.com.eg/en/ad/spacious-flat-503863245.html',
      source_listing_id: '503863245',
      title: 'Cozy 3-bedroom, "New Cairo"',
      price: 30000, currency: 'EGP', frequency: 'monthly',
      attributes: {
        property_type: 'Apartment', bedrooms: 3, bathrooms: 2, area_m2: 140,
        furnishing_state: 'Furnished', location: 'First Settlement, New Cairo',
      },
      eligibility: 'PASS', ranking_score: 87, evidence_confidence: 0.82,
    },
    {
      id: 'job-1000::111111', job_id: 'job-1000',
      source_url: 'https://www.dubizzle.com.eg/en/ad/studio-111111.html',
      source_listing_id: '111111',
      title: 'Studio flat',
      price: 41000, currency: 'EGP', frequency: 'monthly',
      attributes: { property_type: 'Apartment', bedrooms: 1, location: 'Maadi' },
      eligibility: 'FAIL', ranking_score: 42, evidence_confidence: 0.5,
    },
  ];
}

test('listingsToJson: builds a versioned envelope wrapping job + listings', async () => {
  const { listingsToJson } = await load(EXPORT_MOD);
  const parsed = JSON.parse(listingsToJson(sampleJob(), sampleListings()));
  assert.equal(parsed.schema_version, 1);
  assert.equal(parsed.job.id, 'job-1000');
  assert.equal(parsed.listing_count, 2);
  assert.equal(parsed.listings.length, 2);
  assert.equal(parsed.listings[0].id, 'job-1000::503863245');
});

test('listingsToJson: null job and missing listings degrade to an empty envelope', async () => {
  const { listingsToJson } = await load(EXPORT_MOD);
  const parsed = JSON.parse(listingsToJson(null, undefined));
  assert.equal(parsed.schema_version, 1);
  assert.equal(parsed.job, null);
  assert.equal(parsed.listing_count, 0);
  assert.deepEqual(parsed.listings, []);
});

test('listingsToCsv: first row is the exact column header', async () => {
  const { listingsToCsv, CSV_COLUMNS } = await load(EXPORT_MOD);
  const lines = listingsToCsv(sampleListings()).split('\r\n');
  assert.equal(lines[0], CSV_COLUMNS.join(','));
});

test('listingsToCsv: emits one header row plus one row per listing', async () => {
  const { listingsToCsv } = await load(EXPORT_MOD);
  const lines = listingsToCsv(sampleListings()).split('\r\n');
  assert.equal(lines.length, 3);
});

test('listingsToCsv: flattens attributes into their own columns', async () => {
  const { listingsToCsv } = await load(EXPORT_MOD);
  const lines = listingsToCsv(sampleListings()).split('\r\n');
  const cells = lines[2].split(','); // the comma-free "Studio flat" row
  assert.equal(cells[7], 'Apartment'); // property_type
  assert.equal(cells[8], '1');         // bedrooms
});

test('listingsToCsv: RFC-4180-quotes fields containing commas and quotes', async () => {
  const { listingsToCsv } = await load(EXPORT_MOD);
  const lines = listingsToCsv(sampleListings()).split('\r\n');
  assert.ok(lines[1].includes('"Cozy 3-bedroom, ""New Cairo"""'));
});

test('listingsToCsv: header-only output for an empty listing array', async () => {
  const { listingsToCsv } = await load(EXPORT_MOD);
  assert.equal(listingsToCsv([]).split('\r\n').length, 1);
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: RED. The seven new tests throw `NotImplemented: listingsToJson` / `NotImplemented: listingsToCsv` (the Foundation stub). Summary `80 passed, 7 failed (87 total)`, exit 1.

- [ ] **Step 3: Replace the `export.js` stub with the real serializers**

Overwrite `src/chrome/src/agent/listing-agent/export.js` (which currently throws `NotImplemented`) with:

```js
// AI Listing Agent — result export (pure).
// Feature plan: Export. Design refs: §12 (JSON + CSV).

export const EXPORT_SCHEMA_VERSION = 1;

export const CSV_COLUMNS = Object.freeze([
  'id', 'source_url', 'source_listing_id', 'title', 'price', 'currency', 'frequency',
  'property_type', 'bedrooms', 'bathrooms', 'area_m2', 'furnishing_state', 'location',
  'eligibility', 'ranking_score', 'evidence_confidence',
]);

// Columns that live inside the nested `attributes` block rather than at top level.
const ATTRIBUTE_COLUMNS = Object.freeze([
  'property_type', 'bedrooms', 'bathrooms', 'area_m2', 'furnishing_state', 'location',
]);

/**
 * Full-fidelity JSON envelope: schema version + job + all listings.
 * @param {Object|null} job
 * @param {Object[]} listings
 * @returns {string} pretty-printed JSON
 */
export function listingsToJson(job, listings) {
  const rows = Array.isArray(listings) ? listings : [];
  return JSON.stringify({
    schema_version: EXPORT_SCHEMA_VERSION,
    job: job || null,
    listing_count: rows.length,
    listings: rows,
  }, null, 2);
}

// RFC-4180: quote a field iff it contains a comma, quote, CR, or LF; double interior quotes.
function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function cellFor(listing, column) {
  const attrs = (listing && listing.attributes) || {};
  if (ATTRIBUTE_COLUMNS.includes(column)) return attrs[column];
  return listing ? listing[column] : undefined;
}

/**
 * Flattened, spreadsheet-friendly CSV. Header row + one row per listing, CRLF-delimited.
 * @param {Object[]} listings
 * @returns {string}
 */
export function listingsToCsv(listings) {
  const rows = Array.isArray(listings) ? listings : [];
  const lines = [CSV_COLUMNS.join(',')];
  for (const listing of rows) {
    lines.push(CSV_COLUMNS.map((col) => csvCell(cellFor(listing, col))).join(','));
  }
  return lines.join('\r\n');
}
```

- [ ] **Step 4: Run the unit runner to verify the new tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: GREEN. Summary `87 passed, 0 failed (87 total)`, exit 0.

- [ ] **Step 5: Mirror `export.js` into the firefox build (byte-identical)**

Run:
```bash
cp src/chrome/src/agent/listing-agent/export.js src/firefox/src/agent/listing-agent/export.js
```
Expected: no output, exit 0.

- [ ] **Step 6: Run the contract test to confirm parity is preserved**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS. The `export.js` parity check prints `✓`; summary `39 passed, 0 failed`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add test/listing-agent/run.mjs src/chrome/src/agent/listing-agent/export.js src/firefox/src/agent/listing-agent/export.js
git commit -m "feat: implement pure JSON + CSV result export"
```

---

## Task 2: Listing Workspace translations (`locales/en.js`, both builds)

**Files:**
- Modify: `test/listing-agent-contract.json` (strengthen the two `en.js` touchpoints)
- Modify: `src/chrome/src/ui/locales/en.js`
- Modify: `src/firefox/src/ui/locales/en.js`

- [ ] **Step 1: Strengthen the `en.js` touchpoints in the contract manifest**

In `test/listing-agent-contract.json`, the two `en.js` touchpoints (added by the Controller plan) currently read:

```json
    { "file": "src/chrome/src/ui/locales/en.js", "mustContain": ["sp.slash.research", "st.display.listing_workspace.desc_html", "listings.html"] },
    { "file": "src/firefox/src/ui/locales/en.js", "mustContain": ["sp.slash.research", "st.display.listing_workspace.desc_html", "listings.html"] },
```

Append `"ls.title"` to **both** `mustContain` arrays so they become:

```json
    { "file": "src/chrome/src/ui/locales/en.js", "mustContain": ["sp.slash.research", "st.display.listing_workspace.desc_html", "listings.html", "ls.title"] },
    { "file": "src/firefox/src/ui/locales/en.js", "mustContain": ["sp.slash.research", "st.display.listing_workspace.desc_html", "listings.html", "ls.title"] },
```

- [ ] **Step 2: Run the contract test to verify the new needle fails**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: RED. Both `en.js` touchpoints now miss the `ls.title` needle. Summary `37 passed, 2 failed`, exit 1. (The count stays at 39 total checks — the contract counts one check per touchpoint *file*, not per needle.)

- [ ] **Step 3: Add the `ls.*` block to the chrome `en.js`**

In `src/chrome/src/ui/locales/en.js`, find the anchor line (unique in the file):

```js
  'tr.event.step': 'step {step}',
```

Insert the following block immediately **after** that line (2-space indent to match the surrounding entries):

```js
  'ls.title': 'Listing Workspace',
  'ls.listings': '{n} listings',
  'ls.listing': '{n} listing',
  'ls.btn.refresh': '↻ Refresh',
  'ls.btn.refresh.title': 'Reload jobs and listings',
  'ls.btn.export_json': '⇩ Export JSON',
  'ls.btn.export_json.title': 'Download the current results as JSON',
  'ls.btn.export_csv': '⇩ Export CSV',
  'ls.btn.export_csv.title': 'Download the current results as CSV',
  'ls.job.label': 'Research job',
  'ls.job.none': '(no jobs yet)',
  'ls.job.status': 'status',
  'ls.job.listings': 'listings',
  'ls.filter.search_placeholder': 'Filter by title / location',
  'ls.filter.eligibility.all': 'All eligibility',
  'ls.filter.eligibility.pass': 'Eligible',
  'ls.filter.eligibility.fail': 'Ineligible',
  'ls.filter.eligibility.unknown': 'Unknown',
  'ls.filter.min_score': 'Min score',
  'ls.filter.min_bedrooms': 'Min bedrooms',
  'ls.filter.max_price': 'Max price',
  'ls.sort.label': 'Sort',
  'ls.sort.score_desc': 'Ranking (high → low)',
  'ls.sort.price_asc': 'Price (low → high)',
  'ls.sort.price_desc': 'Price (high → low)',
  'ls.no_match': 'No listings match.',
  'ls.empty.title': 'No research results yet.',
  'ls.empty.hint_html': 'Run <b>/research &lt;objective&gt;</b> from the side panel, then return here to review the ranked listings.',
  'ls.card.score': 'Score {n}',
  'ls.card.eligible': 'Eligible',
  'ls.card.ineligible': 'Ineligible',
  'ls.card.unknown': 'Unknown',
  'ls.card.evidence': 'Evidence {pct}%',
  'ls.card.no_price': 'Price not listed',
  'ls.action.open': 'Open',
  'ls.action.save': 'Save',
  'ls.action.reject': 'Reject',
  'ls.saved': 'Saved to shortlist.',
  'ls.rejected': 'Removed from shortlist.',
  'ls.export.none': 'No listings to export yet.',
  'ls.export.json_done': 'Exported listings as JSON.',
  'ls.export.csv_done': 'Exported listings as CSV.',
  'ls.load_error': 'Could not load the listing workspace.',
```

- [ ] **Step 4: Add the identical `ls.*` block to the firefox `en.js`**

In `src/firefox/src/ui/locales/en.js`, find the same anchor line:

```js
  'tr.event.step': 'step {step}',
```

Insert the **identical** `ls.*` block from Step 3 immediately after it. The block text is byte-for-byte the same as chrome; only the line number of the anchor differs between builds.

- [ ] **Step 5: Run the contract test to verify the touchpoints pass**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS. Both `en.js` touchpoints now find every needle including `ls.title`. Summary `39 passed, 0 failed`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add test/listing-agent-contract.json src/chrome/src/ui/locales/en.js src/firefox/src/ui/locales/en.js
git commit -m "feat: add Listing Workspace translations (both builds)"
```

---

## Task 3: Listing Workspace markup (`listings.html`)

**Files:**
- Implement: `src/chrome/src/ui/listings.html`
- Mirror: `src/firefox/src/ui/listings.html`

This page is browser-only (no Node unit tests). Its markup is verified structurally by the Plan 6 Playwright suite; here, the **mirrored-pair parity check is the test** — editing chrome breaks parity (RED), re-`cp`-ing restores it (GREEN).

- [ ] **Step 1: Replace the `listings.html` stub with the full workspace markup**

Overwrite `src/chrome/src/ui/listings.html` (currently the Foundation stub `<main id="listing-workspace">…</main>`) with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Listing Workspace</title>
  <style>
    :root {
      --bg: #1a1a2e;
      --bg2: #16213e;
      --bg3: #1e2746;
      --bg4: #2a3558;
      --text: #e8e8e8;
      --text2: #a0a0b8;
      --text3: #6d6d87;
      --accent: #6c63ff;
      --accent2: #5a52d5;
      --border: rgba(255,255,255,0.08);
      --success: #4caf50;
      --warning: #ff9800;
      --error: #f44336;
      --radius: 10px;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    header {
      padding: 12px 18px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 14px;
      flex-shrink: 0;
    }
    h1 {
      font-size: 18px;
      background: linear-gradient(135deg, var(--accent), #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .spacer { flex: 1; }
    .pill {
      background: var(--bg2);
      border: 1px solid var(--border);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      color: var(--text2);
    }
    button, select, input[type=text], input[type=number] {
      background: var(--bg3);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
    }
    button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    button.primary:hover { background: var(--accent2); }
    button:hover { background: var(--bg4); }
    input[type=text], input[type=number] { cursor: text; }

    /* Toolbar: job picker + filters + sort */
    #toolbar {
      padding: 10px 18px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      flex-shrink: 0;
    }
    #toolbar label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--text2);
    }
    #job-meta { font-size: 11px; color: var(--text2); }
    #filter-search { min-width: 200px; }
    #filter-min-score, #filter-min-bedrooms, #filter-max-price { width: 100px; }

    /* Scroll region + list */
    main {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding: 16px 18px;
    }
    #listing-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    #empty-state {
      display: none;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--text3);
      text-align: center;
    }
    #empty-state div { max-width: 360px; }

    /* Listing card */
    .card {
      background: var(--bg2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 12px 14px;
    }
    .card-top {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }
    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      flex: 1;
      min-width: 200px;
    }
    .card-score {
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 11px;
      color: var(--accent);
    }
    .card-price { font-size: 13px; color: var(--text); margin-bottom: 4px; }
    .card-attrs { font-size: 12px; color: var(--text2); margin-bottom: 8px; }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 600;
    }
    .badge-eligible { background: rgba(76,175,80,0.16); color: var(--success); }
    .badge-ineligible { background: rgba(244,67,54,0.16); color: var(--error); }
    .badge-unknown { background: rgba(255,152,0,0.16); color: var(--warning); }
    .badge-evidence { background: var(--bg3); color: var(--text2); }

    .req-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .req-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      background: var(--bg3);
      color: var(--text2);
      border: 1px solid var(--border);
    }
    .req-pass { color: var(--success); border-color: rgba(76,175,80,0.4); }
    .req-fail { color: var(--error); border-color: rgba(244,67,54,0.4); }
    .req-unknown { color: var(--warning); border-color: rgba(255,152,0,0.4); }

    .card-actions { display: flex; gap: 8px; align-items: center; }
    .card-actions a, .card-actions button {
      background: var(--bg3);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 12px;
      text-decoration: none;
      cursor: pointer;
    }
    .card-actions a:hover, .card-actions button:hover { background: var(--bg4); }

    /* Toast */
    #toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg3);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 12px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
      z-index: 1000;
    }
    #toast.show { opacity: 1; }
  </style>
</head>
<body>
  <header>
    <h1 data-i18n="ls.title"></h1>
    <span id="count-pill" class="pill"></span>
    <div class="spacer"></div>
    <button id="btn-refresh" data-i18n="ls.btn.refresh" data-i18n-title="ls.btn.refresh.title"></button>
    <button id="btn-export-json" class="primary" data-i18n="ls.btn.export_json" data-i18n-title="ls.btn.export_json.title"></button>
    <button id="btn-export-csv" data-i18n="ls.btn.export_csv" data-i18n-title="ls.btn.export_csv.title"></button>
  </header>
  <section id="toolbar">
    <label>
      <span data-i18n="ls.job.label"></span>
      <select id="job-select"></select>
    </label>
    <span id="job-meta"></span>
    <div class="spacer"></div>
    <input type="text" id="filter-search" data-i18n-placeholder="ls.filter.search_placeholder">
    <select id="filter-eligibility">
      <option value="all" data-i18n="ls.filter.eligibility.all"></option>
      <option value="PASS" data-i18n="ls.filter.eligibility.pass"></option>
      <option value="FAIL" data-i18n="ls.filter.eligibility.fail"></option>
      <option value="UNKNOWN_BLOCKED" data-i18n="ls.filter.eligibility.unknown"></option>
    </select>
    <input type="number" id="filter-min-score" min="0" max="100" data-i18n-placeholder="ls.filter.min_score">
    <input type="number" id="filter-min-bedrooms" min="0" data-i18n-placeholder="ls.filter.min_bedrooms">
    <input type="number" id="filter-max-price" min="0" data-i18n-placeholder="ls.filter.max_price">
    <label>
      <span data-i18n="ls.sort.label"></span>
      <select id="sort-select">
        <option value="score_desc" data-i18n="ls.sort.score_desc"></option>
        <option value="price_asc" data-i18n="ls.sort.price_asc"></option>
        <option value="price_desc" data-i18n="ls.sort.price_desc"></option>
      </select>
    </label>
  </section>
  <main>
    <div id="listing-list"></div>
    <div id="empty-state">
      <div>
        <p style="font-size:14px;margin-bottom:10px;" data-i18n="ls.empty.title"></p>
        <p style="color:var(--text3);" data-i18n-html="ls.empty.hint_html"></p>
      </div>
    </div>
  </main>
  <div id="toast"></div>
  <script src="listings.js" type="module"></script>
</body>
</html>
```

- [ ] **Step 2: Run the contract test to verify parity is broken**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: RED. The `listings.html` parity check fails (chrome now differs from the firefox stub). Summary `38 passed, 1 failed`, exit 1.

- [ ] **Step 3: Mirror `listings.html` into the firefox build (byte-identical)**

Run:
```bash
cp src/chrome/src/ui/listings.html src/firefox/src/ui/listings.html
```
Expected: no output, exit 0.

- [ ] **Step 4: Run the contract test to verify parity is restored**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS. Summary `39 passed, 0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/chrome/src/ui/listings.html src/firefox/src/ui/listings.html
git commit -m "feat: build Listing Workspace markup (both builds)"
```

---

## Task 4: Listing Workspace logic (`listings.js`)

**Files:**
- Implement: `src/chrome/src/ui/listings.js`
- Mirror: `src/firefox/src/ui/listings.js`

This module touches `document` at load, so it is **excluded from the Node unit runner** (Foundation). Its behavior — job selection, client-side filtering/sort (§13.6), card rendering, shortlist save/reject, and JSON/CSV download — is verified by the Plan 6 Playwright suite. Here, as in Task 3, the **mirrored-pair parity check is the test**.

- [ ] **Step 1: Replace the `listings.js` stub with the full workspace logic**

Overwrite `src/chrome/src/ui/listings.js` (currently `export const LISTINGS_UI_READY = false;`) with:

```js
// AI Listing Agent — Listing Workspace logic (browser-only).
// NOT imported by the Node unit runner (touches `document` at module load).
// Behavior is verified by the Plan 6 Playwright suite. Feature plan: UI.
// Design refs: §11 (workspace), §12 (export), §13.6 (client-side filtering).

import { listJobs, getJob, listListings, saveListing } from '../agent/listing-agent/persistence.js';
import { t, applyDOMTranslations } from './i18n.js';
import { escapeHtml, escapeAttr } from './utils.js';
import { listingsToJson, listingsToCsv } from '../agent/listing-agent/export.js';

const ELIGIBILITY_BADGE = {
  PASS: { cls: 'badge-eligible', key: 'ls.card.eligible' },
  FAIL: { cls: 'badge-ineligible', key: 'ls.card.ineligible' },
  UNKNOWN_BLOCKED: { cls: 'badge-unknown', key: 'ls.card.unknown' },
};
const REQ_MARK = { PASS: '✓', FAIL: '✗', UNKNOWN: '?' };
const REQ_CLASS = { PASS: 'req-pass', FAIL: 'req-fail', UNKNOWN: 'req-unknown' };

const state = {
  jobs: [],
  jobId: new URLSearchParams(location.search).get('jobId'),
  job: null,
  listings: [],
};

const el = {};
function cache() {
  for (const id of [
    'job-select', 'job-meta', 'filter-search', 'filter-eligibility', 'filter-min-score',
    'filter-min-bedrooms', 'filter-max-price', 'sort-select', 'listing-list', 'empty-state',
    'count-pill', 'btn-refresh', 'btn-export-json', 'btn-export-csv', 'toast',
  ]) { el[id] = document.getElementById(id); }
}

let toastTimer = null;
function toast(msg) {
  if (!el.toast) return;
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2500);
}

function humanize(id) {
  return String(id || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function formatPrice(price, currency, frequency) {
  if (price == null || price === '') return t('ls.card.no_price');
  const amount = Number(price).toLocaleString('en-US');
  const cur = currency ? String(currency) + ' ' : '';
  const freq = frequency ? ' / ' + String(frequency) : '';
  return cur + amount + freq;
}

async function refresh() {
  state.jobs = await listJobs();
  if (!state.jobId && state.jobs.length) state.jobId = state.jobs[0].id;
  renderJobOptions();
  await loadJob();
}

async function loadJob() {
  if (!state.jobId) { state.job = null; state.listings = []; render(); return; }
  try {
    state.job = await getJob(state.jobId);
    state.listings = await listListings(state.jobId);
  } catch {
    state.job = null; state.listings = []; toast(t('ls.load_error'));
  }
  render();
}

function visibleListings() {
  const elig = el['filter-eligibility'].value;
  const minScore = parseFloat(el['filter-min-score'].value);
  const minBeds = parseFloat(el['filter-min-bedrooms'].value);
  const maxPrice = parseFloat(el['filter-max-price'].value);
  const needle = el['filter-search'].value.trim().toLowerCase();
  let rows = state.listings.filter((l) => {
    if (elig !== 'all' && l.eligibility !== elig) return false;
    if (!Number.isNaN(minScore) && (l.ranking_score || 0) < minScore) return false;
    const attrs = l.attributes || {};
    if (!Number.isNaN(minBeds) && (Number(attrs.bedrooms) || 0) < minBeds) return false;
    if (!Number.isNaN(maxPrice) && l.price != null && Number(l.price) > maxPrice) return false;
    if (needle) {
      const hay = ((l.title || '') + ' ' + (attrs.location || '')).toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const sort = el['sort-select'].value;
  rows = rows.slice().sort((a, b) => {
    if (sort === 'price_asc') return (a.price ?? Infinity) - (b.price ?? Infinity);
    if (sort === 'price_desc') return (b.price ?? -Infinity) - (a.price ?? -Infinity);
    return (b.ranking_score || 0) - (a.ranking_score || 0);
  });
  return rows;
}

function renderJobOptions() {
  const sel = el['job-select'];
  if (!state.jobs.length) {
    sel.innerHTML = `<option value="">${escapeHtml(t('ls.job.none'))}</option>`;
    return;
  }
  sel.innerHTML = state.jobs.map((j) =>
    `<option value="${escapeAttr(j.id)}"${j.id === state.jobId ? ' selected' : ''}>${escapeHtml(j.objective || j.id)}</option>`
  ).join('');
}

function renderJobMeta() {
  if (!state.job) { el['job-meta'].textContent = ''; return; }
  const c = state.job.counts || {};
  el['job-meta'].textContent = `${t('ls.job.status')}: ${state.job.status || '—'} · ${t('ls.job.listings')}: ${c.total ?? state.listings.length}`;
}

function requirementChips(listing) {
  const reqs = Array.isArray(listing.per_requirement) ? listing.per_requirement : [];
  return reqs.map((r) => {
    const cls = REQ_CLASS[r.status] || 'req-unknown';
    const mark = REQ_MARK[r.status] || '?';
    return `<span class="req-chip ${cls}">${mark} ${escapeHtml(humanize(r.requirementId))}</span>`;
  }).join('');
}

function cardHtml(listing) {
  const badge = ELIGIBILITY_BADGE[listing.eligibility] || ELIGIBILITY_BADGE.UNKNOWN_BLOCKED;
  const attrs = listing.attributes || {};
  const attrLine = [
    attrs.property_type,
    attrs.bedrooms != null ? `${attrs.bedrooms} 🛏` : null,
    attrs.bathrooms != null ? `${attrs.bathrooms} 🛁` : null,
    attrs.area_m2 != null ? `${attrs.area_m2} m²` : null,
    attrs.furnishing_state,
    attrs.location,
  ].filter(Boolean).map((x) => escapeHtml(x)).join(' · ');
  const pct = Math.round((listing.evidence_confidence || 0) * 100);
  const url = listing.source_url || '#';
  return `
    <article class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(listing.title || listing.source_listing_id || listing.id)}</span>
        <span class="card-score">${escapeHtml(t('ls.card.score', { n: listing.ranking_score ?? 0 }))}</span>
        <span class="badge ${badge.cls}">${escapeHtml(t(badge.key))}</span>
        <span class="badge badge-evidence">${escapeHtml(t('ls.card.evidence', { pct }))}</span>
      </div>
      <div class="card-price">${escapeHtml(formatPrice(listing.price, listing.currency, listing.frequency))}</div>
      <div class="card-attrs">${attrLine}</div>
      <div class="req-chips">${requirementChips(listing)}</div>
      <div class="card-actions">
        <a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('ls.action.open'))}</a>
        <button data-act="${listing.shortlisted ? 'reject' : 'save'}" data-id="${escapeAttr(listing.id)}">${escapeHtml(listing.shortlisted ? t('ls.action.reject') : t('ls.action.save'))}</button>
      </div>
    </article>`;
}

function render() {
  renderJobMeta();
  const rows = visibleListings();
  const total = state.listings.length;
  el['count-pill'].textContent = rows.length === 1 ? t('ls.listing', { n: 1 }) : t('ls.listings', { n: rows.length });
  if (total === 0) {
    el['listing-list'].innerHTML = '';
    el['listing-list'].style.display = 'none';
    el['empty-state'].style.display = 'flex';
    return;
  }
  el['empty-state'].style.display = 'none';
  el['listing-list'].style.display = 'flex';
  if (rows.length === 0) {
    el['listing-list'].innerHTML = `<p style="color:var(--text3);text-align:center;padding:20px;">${escapeHtml(t('ls.no_match'))}</p>`;
    return;
  }
  el['listing-list'].innerHTML = rows.map(cardHtml).join('');
}

function downloadText(text, mime, filename) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  try { a.click(); } finally { a.remove(); setTimeout(() => URL.revokeObjectURL(url), 7000); }
}

function stamp() { return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'); }

function onExportJson() {
  const rows = visibleListings();
  if (!rows.length) { toast(t('ls.export.none')); return; }
  downloadText(listingsToJson(state.job, rows), 'application/json', `webbrain-listings-${stamp()}.json`);
  toast(t('ls.export.json_done'));
}

function onExportCsv() {
  const rows = visibleListings();
  if (!rows.length) { toast(t('ls.export.none')); return; }
  downloadText(listingsToCsv(rows), 'text/csv', `webbrain-listings-${stamp()}.csv`);
  toast(t('ls.export.csv_done'));
}

async function onListClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  const listing = state.listings.find((l) => l.id === id);
  if (!listing) return;
  const act = btn.getAttribute('data-act');
  listing.shortlisted = act === 'save';
  try {
    await saveListing(listing);
    toast(act === 'save' ? t('ls.saved') : t('ls.rejected'));
  } catch { toast(t('ls.load_error')); }
  render();
}

function onJobChange() { state.jobId = el['job-select'].value || null; loadJob(); }

function wire() {
  el['btn-refresh'].addEventListener('click', () => refresh().catch(() => toast(t('ls.load_error'))));
  el['btn-export-json'].addEventListener('click', onExportJson);
  el['btn-export-csv'].addEventListener('click', onExportCsv);
  el['job-select'].addEventListener('change', onJobChange);
  el['sort-select'].addEventListener('change', render);
  el['filter-eligibility'].addEventListener('change', render);
  for (const id of ['filter-search', 'filter-min-score', 'filter-min-bedrooms', 'filter-max-price']) {
    el[id].addEventListener('input', render);
  }
  el['listing-list'].addEventListener('click', onListClick);
  document.addEventListener('wb-locale-changed', () => { renderJobOptions(); render(); });
}

cache();
applyDOMTranslations(document);
wire();
refresh().catch(() => toast(t('ls.load_error')));
```

- [ ] **Step 2: Run the contract test to verify parity is broken**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: RED. The `listings.js` parity check fails (chrome now differs from the firefox stub). Summary `38 passed, 1 failed`, exit 1.

- [ ] **Step 3: Mirror `listings.js` into the firefox build (byte-identical)**

Run:
```bash
cp src/chrome/src/ui/listings.js src/firefox/src/ui/listings.js
```
Expected: no output, exit 0.

- [ ] **Step 4: Run the contract test to verify parity is restored**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS. Summary `39 passed, 0 failed`, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/chrome/src/ui/listings.js src/firefox/src/ui/listings.js
git commit -m "feat: implement Listing Workspace logic (both builds)"
```

---

## Task 5: Full-suite & merge-safety verification

**Files:** none (verification only)

- [ ] **Step 1: Run the complete default suite**

Run:
```bash
npm test
```
Expected: all upstream tests pass, then `test:contract` prints `39 passed, 0 failed` and `test:listing-agent` prints `87 passed, 0 failed (87 total)`; overall exit 0.

- [ ] **Step 2: Confirm the extension still packages for both builds**

Run:
```bash
npm run build:zip
```
Expected: exit 0, zips written under `dist/`. `export.js` is pure and browser-safe; `listings.html`/`listings.js` are additive UI files reachable only from the Settings pointer, so packaging is unaffected.

- [ ] **Step 3: Run the merge-safety gate**

Run:
```bash
npm run test:merge-safety
```
Expected: contract `39 passed, 0 failed`, unit runner `87 passed, 0 failed (87 total)`, merge-rehearsal passes (`✓ merges cleanly with upstream/main`) or skips (offline); overall exit 0.

The workspace layer is complete: persisted, ranked, evidence-backed listings now render as a reviewable, filterable, sortable Listing Workspace with eligibility badges and per-requirement evidence chips, shortlist save/reject persists through IndexedDB, and the currently-visible set exports to a full-fidelity JSON envelope or a flattened, RFC-4180 CSV — all with dark-theme styling and i18n identical to the rest of the extension, in both the chrome and firefox builds.

---

## Self-Review

**1. Spec coverage:**
- §11 Listing Workspace UI (job picker, ranked cards, eligibility, per-requirement evidence, shortlist, empty state) — Task 3's markup provides the job `<select>`, count pill, card container, and empty state; Task 4's `render`/`cardHtml`/`requirementChips` draw ranked cards with the eligibility badge (`ELIGIBILITY_BADGE`), evidence-confidence badge, and per-requirement chips (`REQ_MARK`/`REQ_CLASS`), and `onListClick` toggles `shortlisted` via `saveListing`. Task 2 supplies every `ls.*` string. ✓
- §12 Export (JSON full-fidelity + CSV flattened) — Task 1's `listingsToJson` (versioned envelope) and `listingsToCsv` (16 columns, attribute flattening, RFC-4180 quoting, CRLF), covered by seven unit tests; Task 4's `onExportJson`/`onExportCsv` wire them to the header buttons over the currently-visible set with the house download idiom, guarding the empty case with `ls.export.none`. ✓
- §13.6 With/without native filters (consistent client-side control surface) — Task 4's `visibleListings` applies eligibility / min-score / min-bedrooms / max-price / text filters and score/price sort purely in `listings.js`, independent of whether the source site offered native filters. ✓
- Merge-safety — Task 1 keeps the contract at 39 (owned, mirrored `export.js` implemented + re-`cp`'d); Task 2 strengthens the two `en.js` touchpoints without changing the count; Tasks 3–4 break then restore the `listings.html`/`listings.js` parity checks; Task 5 runs the merge rehearsal. ✓

**2. Placeholder scan:** No "TBD/implement later/handle edge cases." Every implementation step shows the full file contents (Tasks 1, 3, 4) or an exact anchored/append edit (Task 2); every run step states the exact command and pass/fail counts. The `try/catch` blocks in `loadJob`/`onListClick` and the `.catch()` on `refresh()` are real defensive code surfacing `ls.load_error`, not placeholders.

**3. Type consistency:**
- `listings.js` imports match the prior plans' exports exactly: `listJobs`/`getJob`/`listListings`/`saveListing` from `persistence.js` (all `async`); `t`/`applyDOMTranslations` from `i18n.js`; `escapeHtml`/`escapeAttr` from `utils.js`; `listingsToJson`/`listingsToCsv` from this plan's `export.js`. ✓
- Field names read by the UI match the controller's persisted shape: `eligibility` ∈ `'PASS'`/`'FAIL'`/`'UNKNOWN_BLOCKED'` (keys of `ELIGIBILITY_BADGE`); `per_requirement` entries `{ requirementId, status }` with `status` ∈ `'PASS'`/`'FAIL'`/`'UNKNOWN'` (keys of `REQ_MARK`/`REQ_CLASS`); `ranking_score`, `evidence_confidence`, `attributes.{property_type,bedrooms,bathrooms,area_m2,furnishing_state,location}`, `price`/`currency`/`frequency`, `source_url`, `id`. ✓
- `CSV_COLUMNS` order (id, source_url, source_listing_id, title, price, currency, frequency, property_type, bedrooms, bathrooms, area_m2, furnishing_state, location, eligibility, ranking_score, evidence_confidence) matches the Task 1 tests' cell indices (property_type=7, bedrooms=8) and `ATTRIBUTE_COLUMNS` is the exact subset flattened from `attributes`. ✓
- The DOM element IDs cached in `listings.js` (`job-select`, `job-meta`, `filter-search`, `filter-eligibility`, `filter-min-score`, `filter-min-bedrooms`, `filter-max-price`, `sort-select`, `listing-list`, `empty-state`, `count-pill`, `btn-refresh`, `btn-export-json`, `btn-export-csv`, `toast`) each have a matching element in Task 3's `listings.html`; the eligibility `<option>` values (`all`/`PASS`/`FAIL`/`UNKNOWN_BLOCKED`) and sort `<option>` values (`score_desc`/`price_asc`/`price_desc`) match the branches in `visibleListings`. ✓
- Contract touchpoint entries use the `file` field (matching `test/listing-agent-contract.test.mjs`, which does `existsSync(path.join(ROOT, tp.file))` + `src.includes(needle)`), not `path`. ✓
