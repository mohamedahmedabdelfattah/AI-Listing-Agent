# AI Listing Agent — Detection / Extraction / Evidence / Dedup / Persistence Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the pipeline stubs that turn the model's raw page output into clean, evidence-backed, de-duplicated, persistable `Listing` records — JSON-LD/structural detection, two-pass extraction/normalization, the evidence model + confidence aggregation, Level 1–2 deduplication, and the IndexedDB store — so the domain core (mission → eligibility → ranking) has real listings to evaluate.

**Architecture:** The research loop is model-driven, but everything the model surfaces flows through these deterministic, pure modules before it is scored or shown. `detection.js` provides Level 0 (JSON-LD) and Level 1 (repeated-sibling structural heuristics); Level 2 boundary reasoning stays with the model (design §4.5). `extraction.js` normalizes heterogeneous candidates (JSON-LD entities, list cards, model-emitted objects) into the canonical `Listing` shape and merges pass-2 detail data. `evidence.js` builds per-attribute evidence and aggregates confidence (mandatory attrs weighted 2×). `dedup.js` implements Level 1 (exact URL) and Level 2 (source-listing-ID) dedup. `persistence.js` is the browser-only IndexedDB store, cloned from the repo's existing `chat-history-store.js`/`recorder.js` idiom.

**Tech Stack:** JavaScript (native browser ESM), Node.js (`node:assert` + the repo's hand-rolled harness), the `test/listing-agent/run.mjs` unit runner, IndexedDB (browser-only).

---

## Design references

- **§3 — Data model:** canonical `Listing` (`source_url`, `source_listing_id`, `title`, `price`, `currency`, `frequency`, `attributes{…}`, `evidence[]`, `evidence_confidence`); IndexedDB store "following `trace/recorder.js`'s existing open/versioning idiom exactly."
- **§4.4 — Two-pass extraction:** pass 1 = result-card candidate fields; pass 2 = detail-page enrichment.
- **§4.5 — Detection escalation:** Level 0 JSON-LD, Level 1 structural heuristics (multiple result collections must be detectable), Level 2 = LLM reasoning (not this module).
- **§4.6 — Validation facts:** the live listing exposes `Ad id 503863245` and the same numeric id in its URL; `Furnished: No` is a valid listing (furnishing never globally mandatory).
- **§5 — Evidence model:** per-attribute `{value, source_text, extraction_method, confidence, verification_status}`; `evidence_confidence` = weighted average, mandatory-referenced attributes weighted 2×.
- **§8 — Deduplication:** Level 1 exact URL, Level 2 source listing ID from the dubizzle URL slug's numeric suffix.
- **§13.4 — Unit tests:** evidence aggregation and dedup levels 1–2 are pure unit tests. Persistence is **not** listed here — it is covered by §13.5 integration and §13.6 browser tests.

**Scope guardrails for this plan:**
- Fills these Foundation stubs only: `detection.js`, `extraction.js`, `evidence.js`, `dedup.js`, `persistence.js`.
- Creates **no new owned files** and adds **no new upstream touchpoints** → `test/listing-agent-contract.json` is unchanged and `node test/listing-agent-contract.test.mjs` stays at `33 passed`.
- Extends `test/listing-agent/run.mjs` only. Every implemented chrome module is mirrored **byte-identically** into firefox in the same task.
- **Task order note:** `dedup.js` is implemented before `extraction.js` because `extraction.normalizeCandidate` reuses `dedup.sourceListingId` (DRY). `detection.js` and `evidence.js` have no cross-module deps.
- **Persistence testing:** per design §13.4/§13.6, `persistence.js` behavior is verified by the browser/fixtures suite (acceptance-tests plan), not by a Node behavioral test. This plan implements it fully with real IndexedDB code and adds a Node **guard** that proves the stub bodies were replaced with real IndexedDB-touching code (RED→GREEN) — without adding a fake-IndexedDB dependency, keeping the fork's zero-dependency, minimal-touch ethos.
- `controller.js`, `research-skill.js`, `progress.js`, `export.js`, and the UI files remain untouched stubs (later plans).

---

## Canonical shapes used across this plan

**Listing** (produced by `extraction.js`, consumed downstream — design §3):

```js
// { source_url, source_listing_id, title, description, price, currency, frequency,
//   attributes: { property_type, bedrooms, bathrooms, area_m2, furnishing_state,
//                 location, level, view, parking, garden, compound, availability },
//   evidence: EvidenceRecord[], evidence_confidence }
```

**EvidenceRecord** (produced by `evidence.makeEvidence` — design §5; `attribute` added so aggregation can weight mandatory attrs):

```js
// { value, source_text, extraction_method, confidence, verification_status, attribute? }
```

**PageModel node** (input to `detection.detectCollections`; a generic accessibility/DOM-derived tree the controller/model supplies):

```js
// Node = { role?, tag?, name?, href?, children?: Node[] }
// A PageModel is a root Node (or an array of Nodes).
```

---

## Task 1: Detection — JSON-LD + structural collections (`detection.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Pipeline — detection" block)
- Implement: `src/chrome/src/agent/listing-agent/detection.js`
- Mirror: `src/firefox/src/agent/listing-agent/detection.js`

- [ ] **Step 1: Append the failing detection tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Pipeline: detection ---------------------------------------------------
const DETECT_MOD = 'src/chrome/src/agent/listing-agent/detection.js';

test('extractJsonLdListings: returns listing-typed entities, ignores non-listings', async () => {
  const { extractJsonLdListings } = await load(DETECT_MOD);
  const html = [
    '<html><head>',
    '<script type="application/ld+json">{"@type":"Organization","name":"Dubizzle"}</script>',
    '<script type="application/ld+json">{"@type":"Product","name":"3 BR Apartment","offers":{"@type":"Offer","price":"30000","priceCurrency":"EGP"}}</script>',
    '</head><body></body></html>',
  ].join('');
  const found = extractJsonLdListings(html);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, '3 BR Apartment');
});

test('extractJsonLdListings: flattens @graph and skips malformed JSON', async () => {
  const { extractJsonLdListings } = await load(DETECT_MOD);
  const html = [
    '<script type="application/ld+json">{ this is not json }</script>',
    '<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":"RealEstateListing","name":"Flat A"}]}</script>',
  ].join('');
  const found = extractJsonLdListings(html);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Flat A');
});

test('detectCollections: finds multiple repeated-sibling collections (§4.5)', async () => {
  const { detectCollections } = await load(DETECT_MOD);
  const pageModel = {
    role: 'main',
    children: [
      { role: 'section', name: 'Elite Ads', children: [
        { role: 'article', href: '/a' }, { role: 'article', href: '/b' },
      ] },
      { role: 'section', name: 'Results', children: [
        { role: 'listitem', href: '/1' }, { role: 'listitem', href: '/2' }, { role: 'listitem', href: '/3' },
      ] },
    ],
  };
  const collections = detectCollections(pageModel);
  const listitem = collections.find((c) => c.signature === 'listitem');
  const article = collections.find((c) => c.signature === 'article');
  assert.ok(listitem && listitem.size === 3, 'expected a listitem collection of size 3');
  assert.ok(article && article.size === 2, 'expected an article collection of size 2');
});

test('detectCollections: returns nothing when siblings do not repeat', async () => {
  const { detectCollections } = await load(DETECT_MOD);
  const pageModel = { role: 'main', children: [{ role: 'header' }, { role: 'nav' }, { role: 'footer' }] };
  assert.deepEqual(detectCollections(pageModel), []);
});

test('detectListingBoundaries: returns the per-listing item nodes of a collection', async () => {
  const { detectListingBoundaries } = await load(DETECT_MOD);
  const items = [{ href: '/1' }, { href: '/2' }];
  assert.deepEqual(detectListingBoundaries({ signature: 'listitem', items, size: 2 }), items);
  assert.deepEqual(detectListingBoundaries(items), items);
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. The 42 prior tests pass; the 5 new detection tests print `✗` with `NotImplemented`. Summary `42 passed, 5 failed (47 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/detection.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — collection/listing detection (pure).
// Level 0 = JSON-LD (schema.org), Level 1 = structural repeated-sibling heuristics.
// Level 2 (LLM boundary reasoning) is the model's job (research-skill.js), not here.
// Feature plan: Detection/Extraction. Design refs: §4.5.

const LISTING_TYPES = new Set([
  'product', 'offer', 'realestatelisting', 'residence', 'apartment', 'house',
  'singlefamilyresidence', 'accommodation', 'rentaction',
]);

function typeMatches(type) {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => LISTING_TYPES.has(String(t == null ? '' : t).toLowerCase()));
}

function collectEntities(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectEntities(item, out);
    return;
  }
  if (Array.isArray(node['@graph'])) {
    for (const item of node['@graph']) collectEntities(item, out);
  }
  if (node['@type'] && typeMatches(node['@type'])) out.push(node);
}

/**
 * Level 0: extract listing-shaped schema.org entities from JSON-LD in page HTML.
 * @param {string} html
 * @returns {Array<Object>}
 */
export function extractJsonLdListings(html) {
  const src = String(html == null ? '' : html);
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // malformed JSON-LD is skipped, never throws
    }
    collectEntities(parsed, out);
  }
  return out;
}

function asChildren(node) {
  if (Array.isArray(node)) return node;
  if (node && Array.isArray(node.children)) return node.children;
  return [];
}

function signature(node) {
  if (!node || typeof node !== 'object') return 'leaf';
  return String(node.role || node.tag || 'node').toLowerCase();
}

/**
 * Level 1: find groups of repeated sibling structures (≥2 siblings sharing a signature).
 * The validated source shows multiple result collections, so all qualifying groups are
 * returned (never just the first), sorted largest-first.
 * @param {Object|Array} pageModel
 * @returns {Array<{ signature: string, items: Object[], size: number }>}
 */
export function detectCollections(pageModel) {
  const collections = [];
  const visit = (node) => {
    const children = asChildren(node);
    if (!children.length) return;
    const groups = new Map();
    for (const child of children) {
      const sig = signature(child);
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(child);
    }
    for (const [sig, items] of groups) {
      if (items.length >= 2 && sig !== 'leaf') {
        collections.push({ signature: sig, items, size: items.length });
      }
    }
    for (const child of children) visit(child);
  };
  visit(pageModel);
  return collections.sort((a, b) => b.size - a.size);
}

/**
 * Level 1: the per-listing boundaries within one collection are its repeated items.
 * @param {{ items?: Object[] }|Array} collection
 * @returns {Object[]}
 */
export function detectListingBoundaries(collection) {
  if (Array.isArray(collection)) return collection.slice();
  if (collection && Array.isArray(collection.items)) return collection.items.slice();
  return asChildren(collection);
}
```

- [ ] **Step 4: Run the unit runner to verify the detection tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `47 passed, 0 failed (47 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/agent/listing-agent/detection.js src/firefox/src/agent/listing-agent/detection.js
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
git add src/chrome/src/agent/listing-agent/detection.js src/firefox/src/agent/listing-agent/detection.js test/listing-agent/run.mjs
git commit -m "feat: implement JSON-LD + structural detection (pipeline)"
```

---

## Task 2: Deduplication — Level 1 URL + Level 2 source ID (`dedup.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Pipeline — dedup" block)
- Implement: `src/chrome/src/agent/listing-agent/dedup.js`
- Mirror: `src/firefox/src/agent/listing-agent/dedup.js`

- [ ] **Step 1: Append the failing dedup tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Pipeline: dedup -------------------------------------------------------
const DEDUP_MOD = 'src/chrome/src/agent/listing-agent/dedup.js';

test('sourceListingId: extracts the numeric id from a dubizzle URL; explicit id wins; none → null', async () => {
  const { sourceListingId } = await load(DEDUP_MOD);
  assert.equal(
    sourceListingId({ source_url: 'https://www.dubizzle.com.eg/en/ad/nice-flat-503863245.html' }),
    '503863245',
  );
  assert.equal(sourceListingId({ source_listing_id: 'X99', source_url: 'https://x/111111.html' }), 'X99');
  assert.equal(sourceListingId({ source_url: 'https://www.dubizzle.com.eg/en/ad/2-bed-flat' }), null);
});

test('isDuplicate: exact URL → 1 (L1); same id, different URL → 2 (L2); distinct → 0', async () => {
  const { isDuplicate } = await load(DEDUP_MOD);
  const a = { source_url: 'https://d.com/ad/a-111111.html' };
  const bSameUrl = { source_url: 'https://d.com/ad/a-111111.html' };
  const cSameId = { source_url: 'https://d.com/ad/different-slug-111111.html' };
  const distinct = { source_url: 'https://d.com/ad/z-222222.html' };
  assert.equal(isDuplicate(a, bSameUrl), 1);
  assert.equal(isDuplicate(a, cSameId), 2);
  assert.equal(isDuplicate(a, distinct), 0);
});

test('dedupeListings: partitions unique vs duplicates with duplicateOf + level', async () => {
  const { dedupeListings } = await load(DEDUP_MOD);
  const A = { source_url: 'https://d.com/ad/a-111111.html' };
  const B = { source_url: 'https://d.com/ad/a-111111.html' };            // L1 dup of A
  const C = { source_url: 'https://d.com/ad/c-222222.html' };
  const D = { source_url: 'https://d.com/ad/d-slug-222222.html' };       // L2 dup of C
  const { unique, duplicates } = dedupeListings([A, B, C, D]);
  assert.equal(unique.length, 2);
  assert.deepEqual(unique, [A, C]);
  assert.equal(duplicates.length, 2);
  assert.equal(duplicates[0].level, 1);
  assert.equal(duplicates[0].duplicateOf, '111111');
  assert.equal(duplicates[1].level, 2);
  assert.equal(duplicates[1].duplicateOf, '222222');
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. Summary `47 passed, 3 failed (50 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/dedup.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — duplicate detection (pure).
// Feature plan: Detection/Extraction. Design refs: §8.
// Level 1 = exact URL match; Level 2 = source listing ID (numeric suffix of the
// dubizzle URL slug). isDuplicate returns 1 for a Level-1 match, 2 for Level-2,
// 0 for distinct.

function normalizeUrl(url) {
  return String(url == null ? '' : url).trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
}

/**
 * Derive a stable source listing id (Level-2 key) from a listing.
 * @param {Object} listing
 * @returns {string|null}
 */
export function sourceListingId(listing) {
  if (!listing) return null;
  if (listing.source_listing_id != null && String(listing.source_listing_id).trim() !== '') {
    return String(listing.source_listing_id).trim();
  }
  const runs = String(listing.source_url || '').match(/\d{6,}/g);
  return runs && runs.length ? runs[runs.length - 1] : null;
}

/**
 * Duplicate level between two listings.
 * @param {Object} a
 * @param {Object} b
 * @returns {0|1|2}
 */
export function isDuplicate(a, b) {
  if (!a || !b) return 0;
  const ua = normalizeUrl(a.source_url);
  const ub = normalizeUrl(b.source_url);
  if (ua && ub && ua === ub) return 1; // Level 1: exact URL match
  const ia = sourceListingId(a);
  const ib = sourceListingId(b);
  if (ia && ib && ia === ib) return 2; // Level 2: same source listing ID
  return 0;
}

/**
 * Partition listings into unique and duplicate sets (first occurrence wins).
 * @param {Object[]} listings
 * @returns {{ unique: Object[], duplicates: Array<{ listing: Object, duplicateOf: string|null, level: 1|2 }> }}
 */
export function dedupeListings(listings) {
  const list = Array.isArray(listings) ? listings : [];
  const unique = [];
  const duplicates = [];
  const keyOf = (l) => sourceListingId(l) || normalizeUrl(l && l.source_url) || (l && l.id) || null;
  for (const listing of list) {
    let level = 0;
    let duplicateOf = null;
    for (const u of unique) {
      const lvl = isDuplicate(listing, u);
      if (lvl) {
        level = lvl;
        duplicateOf = keyOf(u);
        break;
      }
    }
    if (level) duplicates.push({ listing, duplicateOf, level });
    else unique.push(listing);
  }
  return { unique, duplicates };
}
```

- [ ] **Step 4: Run the unit runner to verify the dedup tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `50 passed, 0 failed (50 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/agent/listing-agent/dedup.js src/firefox/src/agent/listing-agent/dedup.js
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
git add src/chrome/src/agent/listing-agent/dedup.js src/firefox/src/agent/listing-agent/dedup.js test/listing-agent/run.mjs
git commit -m "feat: implement level 1-2 deduplication (pipeline)"
```

---

## Task 3: Two-pass extraction/normalization (`extraction.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Pipeline — extraction" block)
- Implement: `src/chrome/src/agent/listing-agent/extraction.js` (imports `./dedup.js` from Task 2)
- Mirror: `src/firefox/src/agent/listing-agent/extraction.js`

- [ ] **Step 1: Append the failing extraction tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Pipeline: extraction --------------------------------------------------
const EXTRACT_MOD = 'src/chrome/src/agent/listing-agent/extraction.js';

test('normalizeCandidate: JSON-LD entity → canonical Listing with source id', async () => {
  const { normalizeCandidate } = await load(EXTRACT_MOD);
  const entity = {
    '@type': 'Product',
    name: '3 Bedroom Apartment',
    description: 'Spacious flat',
    url: 'https://www.dubizzle.com.eg/en/ad/nice-flat-503863245.html',
    numberOfBedrooms: 3,
    address: { addressLocality: 'New Cairo' },
    offers: { '@type': 'Offer', price: '30000', priceCurrency: 'EGP' },
  };
  const l = normalizeCandidate(entity);
  assert.equal(l.title, '3 Bedroom Apartment');
  assert.equal(l.price, 30000);
  assert.equal(l.currency, 'EGP');
  assert.equal(l.attributes.bedrooms, 3);
  assert.equal(l.attributes.location, 'New Cairo');
  assert.equal(l.source_url, 'https://www.dubizzle.com.eg/en/ad/nice-flat-503863245.html');
  assert.equal(l.source_listing_id, '503863245');
});

test('normalizeCandidate: alternate key spellings; furnished:false → "unfurnished"', async () => {
  const { normalizeCandidate } = await load(EXTRACT_MOD);
  const card = {
    title: 'Apartment for rent',
    href: '/en/ad/x-111222333.html',
    price: 'EGP 25,000',
    frequency: 'Monthly',
    bedrooms: '2',
    furnished: false,
    location: 'Fifth Settlement, New Cairo',
    property_type: 'Apartment',
  };
  const l = normalizeCandidate(card, { sourceUrl: 'https://www.dubizzle.com.eg' });
  assert.equal(l.price, 25000);
  assert.equal(l.currency, 'EGP');
  assert.equal(l.attributes.bedrooms, 2);
  assert.equal(l.attributes.furnishing_state, 'unfurnished');
  assert.equal(l.attributes.property_type, 'Apartment');
  assert.equal(l.source_url, '/en/ad/x-111222333.html');
  assert.equal(l.source_listing_id, '111222333');
});

test('mergeDetail: pass-2 detail enriches pass-1 candidate without losing fields', async () => {
  const { mergeDetail } = await load(EXTRACT_MOD);
  const candidate = {
    title: 'Flat', price: 30000, currency: 'EGP',
    source_url: 'https://d.com/ad/x-503863245.html',
    attributes: { bedrooms: 3, location: 'New Cairo' },
  };
  const detail = {
    description: 'Roomy',
    attributes: { bathrooms: 2, area_m2: 150, furnishing_state: 'unfurnished' },
  };
  const m = mergeDetail(candidate, detail);
  assert.equal(m.title, 'Flat');
  assert.equal(m.price, 30000);
  assert.equal(m.description, 'Roomy');
  assert.equal(m.attributes.bedrooms, 3);
  assert.equal(m.attributes.bathrooms, 2);
  assert.equal(m.attributes.area_m2, 150);
  assert.equal(m.attributes.furnishing_state, 'unfurnished');
  assert.equal(m.attributes.location, 'New Cairo');
  assert.equal(m.source_listing_id, '503863245');
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. Summary `50 passed, 3 failed (53 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/extraction.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — two-pass extraction/normalization (pure).
// Pass 1 normalizes list-card / JSON-LD candidates; pass 2 merges detail-page data.
// Feature plan: Detection/Extraction. Design refs: §4.4, §3.
import { sourceListingId } from './dedup.js';

function firstDefined(...vals) {
  for (const v of vals) if (v != null && v !== '') return v;
  return undefined;
}

function toNumber(v) {
  if (v == null || v === '') return undefined;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? undefined : n;
}

function normFurnishing(v) {
  if (v == null || v === '') return undefined;
  if (v === true) return 'furnished';
  if (v === false) return 'unfurnished';
  const s = String(v).trim().toLowerCase();
  if (s === 'yes' || s === 'furnished') return 'furnished';
  if (s === 'no' || s === 'unfurnished') return 'unfurnished';
  return String(v).trim();
}

function offerPrice(raw) {
  const offers = raw.offers;
  if (!offers) return {};
  const o = Array.isArray(offers) ? offers[0] : offers;
  if (!o || typeof o !== 'object') return {};
  return { price: o.price, currency: o.priceCurrency };
}

function detectCurrencyFromText(text) {
  const s = String(text == null ? '' : text).toLowerCase();
  if (/egp|\ble\b|e£|£/.test(s)) return 'EGP';
  if (/usd|\$/.test(s)) return 'USD';
  if (/eur|€/.test(s)) return 'EUR';
  return undefined;
}

/**
 * Normalize a raw candidate (list card, JSON-LD entity, or model output) into a
 * partial canonical Listing. Only populated fields are included.
 * @param {Object} raw
 * @param {{ pass?: 1|2, sourceUrl?: string }} [ctx]
 * @returns {Object}
 */
export function normalizeCandidate(raw, ctx = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const op = offerPrice(r);
  const listing = {};

  const title = firstDefined(r.title, r.name);
  if (title != null) listing.title = String(title).trim();

  const description = firstDefined(r.description, r.summary);
  if (description != null) listing.description = String(description).trim();

  const source_url = firstDefined(r.source_url, r.url, r.href, r['@id'], ctx.sourceUrl);
  if (source_url != null) listing.source_url = String(source_url).trim();

  const price = toNumber(firstDefined(r.price, op.price));
  if (price !== undefined) listing.price = price;

  const currency = firstDefined(r.currency, r.priceCurrency, op.currency, detectCurrencyFromText(r.price));
  if (currency != null) listing.currency = String(currency).trim().toUpperCase();

  const frequency = firstDefined(r.frequency, r.rentalFrequency, r.priceFrequency);
  if (frequency != null) listing.frequency = String(frequency).trim();

  const attributes = {};
  const bedrooms = toNumber(firstDefined(r.bedrooms, r.numberOfBedrooms, r.numberOfRooms));
  if (bedrooms !== undefined) attributes.bedrooms = bedrooms;
  const bathrooms = toNumber(firstDefined(r.bathrooms, r.numberOfBathroomsTotal, r.numberOfBathrooms));
  if (bathrooms !== undefined) attributes.bathrooms = bathrooms;
  const area = toNumber(firstDefined(r.area_m2, r.size, r.floorSize && r.floorSize.value));
  if (area !== undefined) attributes.area_m2 = area;
  const furnishing = normFurnishing(firstDefined(r.furnishing_state, r.furnished, r.furnishing));
  if (furnishing !== undefined) attributes.furnishing_state = furnishing;
  const location = firstDefined(
    r.location, r.address && r.address.addressLocality, r.addressLocality, r.region, r.neighborhood,
  );
  if (location != null) attributes.location = String(location).trim();
  const propertyType = firstDefined(
    r.property_type, r.category,
    (typeof r['@type'] === 'string' && !['product', 'offer'].includes(r['@type'].toLowerCase())) ? r['@type'] : undefined,
  );
  if (propertyType != null) attributes.property_type = String(propertyType).trim();
  for (const k of ['level', 'view', 'parking', 'garden', 'compound', 'availability']) {
    const v = firstDefined(r[k], r.attributes && r.attributes[k]);
    if (v !== undefined) attributes[k] = v;
  }
  if (Object.keys(attributes).length) listing.attributes = attributes;

  const id = sourceListingId({ source_url: listing.source_url, source_listing_id: r.source_listing_id });
  if (id) listing.source_listing_id = id;

  return listing;
}

function pickDefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'attributes') continue;
    if (v != null && v !== '') out[k] = v;
  }
  return out;
}

/**
 * Merge pass-2 detail data into a pass-1 candidate; detail fields (when present)
 * override candidate fields, and attribute maps are merged key-by-key.
 * @param {Object} candidate
 * @param {Object} detail
 * @returns {Object}
 */
export function mergeDetail(candidate, detail) {
  const base = candidate && typeof candidate === 'object' ? candidate : {};
  const extra = detail && typeof detail === 'object' ? detail : {};
  const merged = { ...base, ...pickDefined(extra) };

  const attributes = { ...(base.attributes || {}) };
  for (const [k, v] of Object.entries(extra.attributes || {})) {
    if (v != null && v !== '') attributes[k] = v;
  }
  if (Object.keys(attributes).length) merged.attributes = attributes;

  const id = firstDefined(extra.source_listing_id, base.source_listing_id, sourceListingId(merged));
  if (id) merged.source_listing_id = id;
  return merged;
}
```

- [ ] **Step 4: Run the unit runner to verify the extraction tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `53 passed, 0 failed (53 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/agent/listing-agent/extraction.js src/firefox/src/agent/listing-agent/extraction.js
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
git add src/chrome/src/agent/listing-agent/extraction.js src/firefox/src/agent/listing-agent/extraction.js test/listing-agent/run.mjs
git commit -m "feat: implement two-pass extraction/normalization (pipeline)"
```

---

## Task 4: Evidence model + confidence aggregation (`evidence.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Pipeline — evidence" block)
- Implement: `src/chrome/src/agent/listing-agent/evidence.js`
- Mirror: `src/firefox/src/agent/listing-agent/evidence.js`

- [ ] **Step 1: Append the failing evidence tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Pipeline: evidence ----------------------------------------------------
const EVIDENCE_MOD = 'src/chrome/src/agent/listing-agent/evidence.js';

test('makeEvidence: fills defaults and clamps confidence into [0,1]', async () => {
  const { makeEvidence } = await load(EVIDENCE_MOD);
  const e = makeEvidence({ value: 3, attribute: 'bedrooms', confidence: 1.5, sourceText: '3 BR' });
  assert.equal(e.value, 3);
  assert.equal(e.attribute, 'bedrooms');
  assert.equal(e.confidence, 1); // clamped
  assert.equal(e.source_text, '3 BR');
  assert.equal(e.extraction_method, 'unknown');
  assert.equal(e.verification_status, 'unverified');
});

test('aggregateConfidence: mandatory-referenced attributes are weighted 2x (§5)', async () => {
  const { makeEvidence, aggregateConfidence } = await load(EVIDENCE_MOD);
  const listing = {
    evidence: [
      makeEvidence({ attribute: 'bedrooms', confidence: 1.0 }),
      makeEvidence({ attribute: 'price', confidence: 0.8 }),
      makeEvidence({ attribute: 'view', confidence: 0.4 }),
    ],
  };
  const mission = { mandatory: [{ attribute: 'bedrooms' }, { attribute: 'price' }], preferred: [], exclusions: [] };
  // (2*1.0 + 2*0.8 + 1*0.4) / (2+2+1) = 4.0 / 5 = 0.8
  assert.equal(aggregateConfidence(listing, mission), 0.8);
});

test('aggregateConfidence: no evidence → 0', async () => {
  const { aggregateConfidence } = await load(EVIDENCE_MOD);
  assert.equal(aggregateConfidence({ evidence: [] }, { mandatory: [] }), 0);
  assert.equal(aggregateConfidence({}, { mandatory: [] }), 0);
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. Summary `53 passed, 3 failed (56 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/evidence.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — evidence model (pure).
// Feature plan: Detection/Extraction. Design refs: §5.
// evidence_confidence = weighted average of per-attribute confidence, where an
// attribute referenced by a MANDATORY requirement is weighted 2x.

function clamp01(n) {
  const x = Number(n);
  return isNaN(x) ? 0 : Math.max(0, Math.min(1, x));
}

const VERIFICATION_STATES = new Set(['unverified', 'verified', 'conflicting', 'inferred']);

/**
 * Build an evidence record for one extracted attribute.
 * @param {{ value?: *, attribute?: string, sourceText?: string, extractionMethod?: string, confidence?: number, verificationStatus?: string }} fields
 * @returns {Object}
 */
export function makeEvidence(fields) {
  const f = fields && typeof fields === 'object' ? fields : {};
  const record = {
    value: f.value !== undefined ? f.value : null,
    source_text: f.sourceText != null ? String(f.sourceText) : '',
    extraction_method: f.extractionMethod != null ? String(f.extractionMethod) : 'unknown',
    confidence: f.confidence != null ? clamp01(f.confidence) : 0.5,
    verification_status: VERIFICATION_STATES.has(f.verificationStatus) ? f.verificationStatus : 'unverified',
  };
  if (f.attribute != null && f.attribute !== '') record.attribute = String(f.attribute);
  return record;
}

/**
 * Aggregate a listing's evidence into an overall confidence score (0..1).
 * @param {Object} listing
 * @param {import('./mission.js').ResearchMission} mission
 * @returns {number}
 */
export function aggregateConfidence(listing, mission) {
  const evidence = listing && Array.isArray(listing.evidence) ? listing.evidence : [];
  if (!evidence.length) return 0;
  const mandatorySet = new Set(
    (mission && Array.isArray(mission.mandatory) ? mission.mandatory : [])
      .map((r) => String(r.attribute || '').toLowerCase())
      .filter(Boolean),
  );
  let sum = 0;
  let wsum = 0;
  for (const ev of evidence) {
    const attr = String(ev && ev.attribute ? ev.attribute : '').toLowerCase();
    const weight = attr && mandatorySet.has(attr) ? 2 : 1;
    sum += weight * clamp01(ev && ev.confidence);
    wsum += weight;
  }
  return wsum ? Math.round((sum / wsum) * 1000) / 1000 : 0;
}
```

- [ ] **Step 4: Run the unit runner to verify the evidence tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `56 passed, 0 failed (56 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/agent/listing-agent/evidence.js src/firefox/src/agent/listing-agent/evidence.js
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
git add src/chrome/src/agent/listing-agent/evidence.js src/firefox/src/agent/listing-agent/evidence.js test/listing-agent/run.mjs
git commit -m "feat: implement evidence model + confidence aggregation (pipeline)"
```

---

## Task 5: IndexedDB persistence (`persistence.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Pipeline — persistence guard" block)
- Implement: `src/chrome/src/agent/listing-agent/persistence.js`
- Mirror: `src/firefox/src/agent/listing-agent/persistence.js`

> **Testing note:** `persistence.js` is browser-only; its behavioral round-trip is verified by the browser/fixtures suite in the acceptance-tests plan (design §13.4/§13.6 place it there, not in Node unit tests). The Node test here is a **guard** that (a) the module still imports in Node with no top-level browser globals and (b) the stub bodies were replaced with real IndexedDB-touching code — a real function reaches for the (absent-in-Node) `indexedDB` global and rejects with a reference error, whereas the stub rejects with `NotImplemented`. This gives a genuine RED→GREEN without adding a fake-IndexedDB dependency.

- [ ] **Step 1: Append the failing persistence guard test**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Pipeline: persistence guard (browser-only module) ---------------------
const PERSIST_MOD = 'src/chrome/src/agent/listing-agent/persistence.js';

test('persistence: imports in Node, exports the full surface, and calls real IndexedDB code', async () => {
  const mod = await load(PERSIST_MOD);
  assert.equal(mod.DB_NAME, 'webbrain_listings');
  assert.equal(mod.DB_VERSION, 1);
  for (const fn of ['saveMission', 'saveJob', 'saveListing', 'saveListings',
    'listListings', 'getJob', 'listJobs', 'deleteJob', 'clearAll']) {
    assert.equal(typeof mod[fn], 'function', `missing export: ${fn}`);
  }
  // Real implementation reaches for the (Node-absent) indexedDB global; the stub throws NotImplemented.
  let err;
  try { await mod.saveJob({ id: 'probe' }); } catch (e) { err = e; }
  assert.ok(err, 'saveJob should reject in Node (no IndexedDB available)');
  assert.ok(!/NotImplemented/.test(String(err)), 'saveJob must run real IndexedDB code, not the stub');
  assert.ok(/indexedDB/.test(String(err)), 'expected an indexedDB reference error, got: ' + String(err));
});
```

- [ ] **Step 2: Run the unit runner to verify the guard fails against the stub**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. The guard's `!/NotImplemented/` assertion fails because the stub `saveJob` throws `NotImplemented: saveJob`. Summary `56 passed, 1 failed (57 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/persistence.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — IndexedDB persistence (browser-only).
// Follows the existing ui/chat-history-store.js + trace/recorder.js open/versioning
// idiom exactly (design §3). No top-level browser globals, so the module stays
// importable in Node; behavioral coverage lives in the browser/fixtures suite.
// Feature plan: Detection/Extraction. Design refs: §3, §8.

export const DB_NAME = 'webbrain_listings';
export const DB_VERSION = 1;

const MISSIONS = 'missions';
const JOBS = 'jobs';
const LISTINGS = 'listings';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MISSIONS)) {
        db.createObjectStore(MISSIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(JOBS)) {
        const jobs = db.createObjectStore(JOBS, { keyPath: 'id' });
        jobs.createIndex('mission_id', 'mission_id');
        jobs.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains(LISTINGS)) {
        const listings = db.createObjectStore(LISTINGS, { keyPath: 'id' });
        listings.createIndex('job_id', 'job_id');
        listings.createIndex('source_listing_id', 'source_listing_id');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function promisifyReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function store(db, name, mode = 'readonly') {
  return db.transaction([name], mode).objectStore(name);
}

export async function saveMission(mission) {
  if (!mission || !mission.id) return null;
  const db = await openDB();
  await promisifyReq(store(db, MISSIONS, 'readwrite').put(mission));
  return mission;
}

export async function saveJob(job) {
  if (!job || !job.id) return null;
  const db = await openDB();
  await promisifyReq(store(db, JOBS, 'readwrite').put(job));
  return job;
}

export async function saveListing(listing) {
  if (!listing || !listing.id) return null;
  const db = await openDB();
  await promisifyReq(store(db, LISTINGS, 'readwrite').put(listing));
  return listing;
}

export async function saveListings(listings) {
  const list = Array.isArray(listings) ? listings : [];
  const db = await openDB();
  const os = store(db, LISTINGS, 'readwrite');
  await Promise.all(list.filter((l) => l && l.id).map((l) => promisifyReq(os.put(l))));
  return list.length;
}

export async function listListings(jobId) {
  const db = await openDB();
  const index = store(db, LISTINGS).index('job_id');
  const out = [];
  await new Promise((resolve) => {
    const req = index.openCursor(IDBKeyRange.only(jobId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve();
      out.push(cursor.value);
      cursor.continue();
    };
    req.onerror = () => resolve();
  });
  return out;
}

export async function getJob(jobId) {
  if (!jobId) return null;
  const db = await openDB();
  return promisifyReq(store(db, JOBS).get(jobId));
}

export async function listJobs() {
  const db = await openDB();
  return promisifyReq(store(db, JOBS).getAll());
}

export async function deleteJob(jobId) {
  if (!jobId) return;
  const db = await openDB();
  await promisifyReq(store(db, JOBS, 'readwrite').delete(jobId));
  const listings = await listListings(jobId);
  const os = store(db, LISTINGS, 'readwrite');
  await Promise.all(listings.map((l) => promisifyReq(os.delete(l.id))));
}

export async function clearAll() {
  const db = await openDB();
  await Promise.all([
    promisifyReq(store(db, MISSIONS, 'readwrite').clear()),
    promisifyReq(store(db, JOBS, 'readwrite').clear()),
    promisifyReq(store(db, LISTINGS, 'readwrite').clear()),
  ]);
}
```

- [ ] **Step 4: Run the unit runner to verify the guard passes**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `57 passed, 0 failed (57 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/agent/listing-agent/persistence.js src/firefox/src/agent/listing-agent/persistence.js
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
git add src/chrome/src/agent/listing-agent/persistence.js src/firefox/src/agent/listing-agent/persistence.js test/listing-agent/run.mjs
git commit -m "feat: implement listings IndexedDB persistence (pipeline)"
```

---

## Task 6: Full-suite & merge-safety verification

**Files:** none (verification only)

- [ ] **Step 1: Run the complete default suite**

Run:
```bash
npm test
```
Expected: all upstream tests pass, then `test:contract` prints `33 passed, 0 failed` and `test:listing-agent` prints `57 passed, 0 failed (57 total)`; overall exit 0.

- [ ] **Step 2: Confirm the extension still packages for both builds**

Run:
```bash
npm run build:zip
```
Expected: exit 0, zips written under `dist/`.

- [ ] **Step 3: Run the merge-safety gate**

Run:
```bash
npm run test:merge-safety
```
Expected: contract `33 passed`, unit runner `57 passed`, merge-rehearsal passes/skips; overall exit 0.

The pipeline is complete: detection → extraction → evidence → dedup are pure, deterministic, and unit-tested; persistence is real IndexedDB code guarded in Node and ready for the browser suite. Combined with the domain core, a raw page's listings can now be normalized, evidenced, evaluated, ranked, de-duplicated, and stored.

---

## Self-Review

**1. Spec coverage:**
- §3 canonical `Listing` shape (top-level `source_url`/`source_listing_id`/`title`/`price`/`currency`/`frequency`, `attributes{…}`) — produced by `normalizeCandidate`/`mergeDetail`; asserted in Task 3. ✓
- §3 IndexedDB "following recorder.js idiom exactly" — `persistence.js` mirrors `chat-history-store.js` (`openDB`/`onupgradeneeded`/`promisifyReq`/store helper), distinct `DB_NAME='webbrain_listings'`, stores for missions/jobs/listings with the same index style. ✓
- §4.4 two-pass extraction — `normalizeCandidate` (pass-1 card fields) + `mergeDetail` (pass-2 enrichment, detail overrides, attribute-map merge); Task 3. ✓
- §4.5 detection Levels 0–1 (multiple collections detectable; Level 2 left to the model) — `extractJsonLdListings` + `detectCollections` (returns all repeated-sibling groups, largest-first) + `detectListingBoundaries`; Task 1. ✓
- §4.6 numeric ad id `503863245` from the URL — `sourceListingId` (Task 2) and `normalizeCandidate` (Task 3) both extract it; `Furnished: No` → `unfurnished` handled without making furnishing mandatory. ✓
- §5 evidence record shape + weighted average (mandatory 2×) — `makeEvidence`/`aggregateConfidence`; the worked 0.8 example is asserted; Task 4. ✓
- §8 dedup Level 1 (exact URL) + Level 2 (source id) — `isDuplicate` returns 1/2/0, `dedupeListings` partitions with `duplicateOf`+`level`; Task 2. Refines the Foundation stub's loose inline comment to match §8 (documented in the module header). ✓
- §13.4 pure unit tests present for evidence aggregation and dedup levels 1–2. Persistence intentionally excluded from Node behavioral tests (guard only), matching §13.4/§13.6. ✓

**2. Placeholder scan:** No "TBD/implement later/handle edge cases." Every step shows full file content or an exact command with expected output and exact pass/fail counts. The Foundation `NotImplemented` bodies are all replaced.

**3. Type consistency:**
- `Listing` field names match across `extraction.js` (writer), `dedup.js` (`source_url`/`source_listing_id` readers), `evidence.js` (`evidence[]`/`attribute`/`confidence`), and `persistence.js` (`keyPath:'id'`, `job_id`/`source_listing_id` indexes).
- `sourceListingId` is defined once in `dedup.js` and imported by `extraction.js` (no duplication; dedup is implemented in Task 2 before extraction in Task 3, so the import resolves to real code — verified by the RED→GREEN counts).
- `EvidenceRecord.attribute` (added in `makeEvidence`) is exactly what `aggregateConfidence` reads to apply the mandatory 2× weight; the `mission.mandatory[].attribute` field matches the `Requirement` shape locked in the Foundation/Domain-core plans.
- `detectCollections` returns `{signature, items, size}` and `detectListingBoundaries` consumes `{items}` — consistent within Task 1.
- No new owned files and no touchpoint changes → `test/listing-agent-contract.json` and its `33 passed` result are unchanged; the unit runner grows 42 → 57. ✓
