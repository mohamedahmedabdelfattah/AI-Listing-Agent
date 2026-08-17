# AI Listing Agent — Domain Core Plan (Mission · Filter Planning · Requirement Evaluation · Ranking)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill four of the Foundation stubs with the deterministic, pure "brain" of the Listing Agent — parse a free-text mission into a structured `ResearchMission`, plan native site filters from it, evaluate a listing's eligibility leniently (PASS/FAIL/UNKNOWN_BLOCKED), and compute a transparent ranking score — all unit-tested in Node, with no DOM or browser globals.

**Architecture:** These four modules are pure functions that post-process the model-driven research loop's output. The research loop itself is model-driven (a later plan), but everything it produces flows through this deterministic pipeline so eligibility and ranking are testable and explainable rather than a black box. `parseMission` deterministically parses the *confirmed, sectioned* mission format (`Objective:` / `Mandatory:` / `Preferred:` / `Exclude:`); genuine free-text→structure elicitation for ambiguous prose is the model's job upstream, consistent with the model-driven controller decision. The classification of a requirement as mandatory vs. preferred comes **only** from which section it appears in — never from the attribute name — so furnishing (or any attribute) is never mandatory unless the user puts it there (design §1.2, §4.1).

**Tech Stack:** JavaScript (native browser ESM), Node.js (`node:assert` + the repo's hand-rolled harness), the existing `test/listing-agent/run.mjs` unit runner from the Foundation plan.

---

## Design references

- **§1.2 — Acceptance mission** (the canonical sectioned input and the "furnishing is not mandatory by default" rule).
- **§3 — Data model** (`ResearchMission`, `Listing.attributes` field set, top-level `price`/`currency`/`frequency`/`title`).
- **§4.1–§4.2 — Mission-driven filter planning** (only mission requirements drive filters; capabilities are discovered; never invent a filter the source doesn't expose).
- **§6 — Requirement evaluation & eligibility** (lenient PASS/FAIL/UNKNOWN_BLOCKED; `strict_mandatory_unknown` default false).
- **§7 — Ranking** (the explicit 50/25/15/10 formula + transparent breakdown).
- **§10 — Mission creation UX** (attribute-agnostic; must support finishing values without hard-coding them as mandatory).
- **§13.2–§13.4 — Mission-driven requirement tests, native-filter planning tests, unit tests.**

**Scope guardrails for this plan:**
- Fills only these Foundation stubs: `mission.js` (`parseMission`, `validateMission`), `filter-planner.js` (`planFilters`), `requirements.js` (`evaluateRequirement`, `evaluateListing`), `ranking.js` (`computeRanking`).
- Creates **no new owned files** and adds **no new upstream touchpoints** → `test/listing-agent-contract.json` is unchanged and `node test/listing-agent-contract.test.mjs` stays at `33 passed`.
- Extends `test/listing-agent/run.mjs` only (never the monolithic `test/run.js`).
- Every implemented chrome module is mirrored **byte-identically** into `src/firefox/…` in the same task, keeping the contract's parity checks green.
- `evidence.js`, `detection.js`, `extraction.js`, `dedup.js`, `progress.js`, `controller.js`, `research-skill.js`, `export.js`, `persistence.js`, and the UI files remain untouched stubs (later plans).

---

## Canonical shapes used across this plan

The executor must use these exact shapes (defined in the Foundation stubs' JSDoc and reused verbatim here).

**Requirement** (emitted by `parseMission`, consumed by `planFilters`/`requirements`/`ranking`):

```js
// { id, attribute, operator, value, raw, currency? }
// operator ∈ 'eq' | 'contains' | 'gte' | 'lte' | 'gt' | 'lt' | 'in' | 'exists' | 'not'
// canonical attribute names: bedrooms, bathrooms, price, area_m2, location,
//   furnishing_state, property_type, level, view, parking, garden, compound, availability
```

**ResearchMission** (return of `parseMission`):

```js
// { objective, mandatory: Requirement[], preferred: Requirement[], exclusions: Requirement[],
//   sourceDomain: string, options: { strict_mandatory_unknown: boolean, ... } }
```

**Listing** (input to `requirements`/`ranking`; per design §3 — `title`/`price`/`currency`/`frequency` are top-level, the rest live under `attributes`):

```js
// { title, price, currency, frequency, evidence_confidence?,
//   attributes: { property_type, bedrooms, bathrooms, area_m2, furnishing_state,
//                 location, level, view, parking, garden, compound, availability } }
```

---

## Task 1: Mission parsing (`mission.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Domain core — mission" block)
- Implement: `src/chrome/src/agent/listing-agent/mission.js`
- Mirror: `src/firefox/src/agent/listing-agent/mission.js`

- [ ] **Step 1: Append the failing mission tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider comment:

```js
// --- Domain core: mission parsing ------------------------------------------
const MISSION_MOD = 'src/chrome/src/agent/listing-agent/mission.js';

// The canonical MVP-1 acceptance mission (design §1.2).
const ACCEPTANCE_MISSION = [
  'Objective: Find apartments for rent in New Cairo.',
  '',
  'Mandatory:',
  '2+ bedrooms',
  '≤ 35,000 EGP',
  'New Cairo',
].join('\n');

test('parseMission: acceptance mission yields exactly 3 mandatory requirements', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const m = parseMission(ACCEPTANCE_MISSION, { sourceDomain: 'dubizzle.com.eg' });
  assert.equal(m.mandatory.length, 3, 'expected 3 mandatory requirements');
  assert.equal(m.preferred.length, 0);
  assert.equal(m.exclusions.length, 0);
  assert.equal(m.sourceDomain, 'dubizzle.com.eg');
  assert.match(m.objective, /Find apartments for rent in New Cairo/);
});

test('parseMission: "2+ bedrooms" → bedrooms gte 2', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const m = parseMission(ACCEPTANCE_MISSION);
  const beds = m.mandatory.find((r) => r.attribute === 'bedrooms');
  assert.ok(beds, 'no bedrooms requirement');
  assert.equal(beds.operator, 'gte');
  assert.equal(beds.value, 2);
});

test('parseMission: "≤ 35,000 EGP" → price lte 35000 with currency EGP', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const m = parseMission(ACCEPTANCE_MISSION);
  const price = m.mandatory.find((r) => r.attribute === 'price');
  assert.ok(price, 'no price requirement');
  assert.equal(price.operator, 'lte');
  assert.equal(price.value, 35000);
  assert.equal(price.currency, 'EGP');
});

test('parseMission: bare phrase "New Cairo" → location contains', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const m = parseMission(ACCEPTANCE_MISSION);
  const loc = m.mandatory.find((r) => r.attribute === 'location');
  assert.ok(loc, 'no location requirement');
  assert.equal(loc.operator, 'contains');
  assert.equal(String(loc.value).toLowerCase(), 'new cairo');
});

test('parseMission: furnishing is NOT mandatory unless requested', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const m = parseMission(ACCEPTANCE_MISSION);
  const all = [...m.mandatory, ...m.preferred, ...m.exclusions];
  assert.ok(!all.some((r) => r.attribute === 'furnishing_state'),
    'furnishing must not appear when the user never asked for it');
});

test('parseMission: "furnished or unfurnished" → furnishing_state in [furnished, unfurnished]', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const text = ['Objective: Find a flat.', 'Mandatory:', '2+ bedrooms', 'furnished or unfurnished'].join('\n');
  const m = parseMission(text);
  const furn = m.mandatory.find((r) => r.attribute === 'furnishing_state');
  assert.ok(furn, 'no furnishing requirement');
  assert.equal(furn.operator, 'in');
  assert.deepEqual([...furn.value].sort(), ['furnished', 'unfurnished']);
});

test('parseMission: Preferred section classified as preferred, not mandatory', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const text = [
    'Objective: Find apartments in New Cairo.',
    'Mandatory:', '2+ bedrooms',
    'Preferred:', 'garden', 'compound',
  ].join('\n');
  const m = parseMission(text);
  assert.deepEqual(m.mandatory.map((r) => r.attribute), ['bedrooms']);
  assert.deepEqual(m.preferred.map((r) => r.attribute).sort(), ['compound', 'garden']);
});

test('parseMission: requirement ids are unique across all sections', async () => {
  const { parseMission } = await load(MISSION_MOD);
  const m = parseMission(ACCEPTANCE_MISSION);
  const ids = [...m.mandatory, ...m.preferred, ...m.exclusions].map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate requirement ids');
  assert.ok(ids.every(Boolean), 'every requirement has an id');
});

test('validateMission: parsed acceptance mission is valid; garbage is not', async () => {
  const { parseMission, validateMission } = await load(MISSION_MOD);
  const good = validateMission(parseMission(ACCEPTANCE_MISSION));
  assert.equal(good.ok, true, 'acceptance mission should validate: ' + good.errors.join('; '));

  const bad = validateMission({ objective: '', mandatory: [{ attribute: 'x', operator: 'bogus' }], preferred: [], exclusions: [] });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /objective/.test(e)));
  assert.ok(bad.errors.some((e) => /operator/.test(e)));
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. The 14 Foundation tests still print `✓`; the 9 new `parseMission`/`validateMission` tests print `✗` with `NotImplemented: parseMission` / `NotImplemented: validateMission`. Summary reads `14 passed, 9 failed (23 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/mission.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — mission parsing (pure; no DOM/browser globals).
// Parses a free-text research objective into a structured ResearchMission.
// Feature plan: Domain core. Design refs: §1.2, §3, §6, §10.
//
// Classification (mandatory vs preferred vs exclusion) comes ONLY from the
// section a line appears under — never from the attribute name. This is the
// invariant behind §1.2's "furnishing is not mandatory by default" rule.

/**
 * @typedef {Object} Requirement
 * @property {string} id         stable slug, e.g. "bedrooms"
 * @property {string} attribute  canonical attribute name
 * @property {string} operator   "eq"|"contains"|"gte"|"lte"|"gt"|"lt"|"in"|"exists"|"not"
 * @property {*}      value
 * @property {string} raw        original phrase from the objective
 * @property {string} [currency] optional ISO-ish currency code for price requirements
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

const OPERATORS = new Set(['eq', 'contains', 'gte', 'lte', 'gt', 'lt', 'in', 'exists', 'not']);

// Section header aliases (matched case-insensitively, trailing colon stripped).
const SECTION_ALIASES = {
  objective: 'objective',
  mission: 'objective',
  mandatory: 'mandatory',
  required: 'mandatory',
  must: 'mandatory',
  'must have': 'mandatory',
  'must-have': 'mandatory',
  preferred: 'preferred',
  'nice to have': 'preferred',
  'nice-to-have': 'preferred',
  optional: 'preferred',
  exclude: 'exclusions',
  excluded: 'exclusions',
  exclusions: 'exclusions',
  'not allowed': 'exclusions',
};

// Recognised finishing/furnishing values → canonical form (design §1.2/§10).
const FINISHING = new Map([
  ['furnished', 'furnished'],
  ['semi-furnished', 'semi-furnished'],
  ['semi furnished', 'semi-furnished'],
  ['unfurnished', 'unfurnished'],
  ['fully finished', 'fully finished'],
  ['finished', 'finished'],
  ['semi-finished', 'semi-finished'],
  ['semi finished', 'semi-finished'],
  ['core and shell', 'core and shell'],
  ['core & shell', 'core and shell'],
  ['move-in ready', 'move-in ready'],
  ['move in ready', 'move-in ready'],
]);

const PROPERTY_TYPES = ['apartment', 'duplex', 'penthouse', 'studio', 'villa', 'chalet', 'townhouse'];

// Known feature/amenity terms → canonical attribute (design §1.2 preferred signals).
const FEATURE_TERMS = [
  { re: /\bgarden\b/, attribute: 'garden', operator: 'exists', value: true },
  { re: /\bparking\b|\bgarage\b/, attribute: 'parking', operator: 'exists', value: true },
  { re: /\bcompound\b/, attribute: 'compound', operator: 'exists', value: true },
  { re: /\bground\s*floor\b/, attribute: 'level', operator: 'eq', value: 'ground' },
  { re: /\b(?:open\s+view|view)\b/, attribute: 'view', operator: 'exists', value: true },
];

function slug(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'req';
}

function detectComparator(lower) {
  if (/(≤|<=|<|under|below|max(?:imum)?|up to|no more than|at most|less than)/.test(lower)) return 'lte';
  if (/(≥|>=|>|over|above|min(?:imum)?|at least|no less than|more than|starting)/.test(lower)) return 'gte';
  return null;
}

function detectCurrency(lower) {
  if (/egp|\ble\b|e£|£/.test(lower)) return 'EGP';
  if (/usd|\$/.test(lower)) return 'USD';
  if (/eur|€/.test(lower)) return 'EUR';
  return null;
}

function parseAmount(str) {
  const m = String(str).match(/(\d[\d,]*\.?\d*)\s*(k|thousand|m|million)?/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ''));
  if (isNaN(n)) return null;
  const suf = (m[2] || '').toLowerCase();
  if (suf === 'k' || suf === 'thousand') n *= 1000;
  else if (suf === 'm' || suf === 'million') n *= 1000000;
  return n;
}

function req(attribute, operator, value, raw, extra) {
  const base = { id: slug(attribute), attribute, operator, value, raw };
  return extra ? Object.assign(base, extra) : base;
}

function normalizeRequirement(rawToken) {
  const text = String(rawToken == null ? '' : rawToken).trim();
  if (!text) return null;
  const lower = text.toLowerCase().replace(/\s+(?:is\s+)?(?:fine|ok|okay|acceptable)\.?$/, '').trim();

  // bedrooms
  let m = lower.match(/(\d+)\s*(\+)?\s*(?:bed(?:room)?s?|br|bhk)\b/);
  if (m) return req('bedrooms', m[2] ? 'gte' : 'eq', Number(m[1]), text);

  // bathrooms
  m = lower.match(/(\d+)\s*(\+)?\s*(?:bath(?:room)?s?|ba)\b/);
  if (m) return req('bathrooms', m[2] ? 'gte' : 'eq', Number(m[1]), text);

  // area
  m = lower.match(/(\d+(?:\.\d+)?)\s*(\+)?\s*(?:m²|m2|sqm|sq\s?m|square\s*met(?:er|re)s?)\b/);
  if (m) return req('area_m2', m[2] ? 'gte' : 'eq', Number(m[1]), text);

  // price / budget — requires a monetary cue so bare place names never match
  const hasMoneyCue =
    /(egp|usd|eur|\ble\b|budget|price|rent|fee|\$|£|€)/.test(lower) ||
    /\d\s*k\b/.test(lower) ||
    (detectComparator(lower) && /\d/.test(lower));
  if (hasMoneyCue && /\d/.test(lower)) {
    const amount = parseAmount(lower);
    if (amount != null) {
      const cmp = detectComparator(lower) || 'lte'; // a bare budget number is treated as a ceiling
      const cur = detectCurrency(lower);
      return req('price', cmp, amount, text, cur ? { currency: cur } : undefined);
    }
  }

  // finishing / furnishing (supports OR / slash → operator 'in')
  const parts = lower.split(/\s+or\s+|\s*\/\s*/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const finVals = [];
  for (const p of parts) if (FINISHING.has(p)) finVals.push(FINISHING.get(p));
  if (finVals.length) {
    const uniq = [...new Set(finVals)];
    return uniq.length > 1 ? req('furnishing_state', 'in', uniq, text) : req('furnishing_state', 'eq', uniq[0], text);
  }

  // known features / amenities
  for (const f of FEATURE_TERMS) {
    if (f.re.test(lower)) return req(f.attribute, f.operator, f.value, text);
  }

  // property type
  for (const pt of PROPERTY_TYPES) {
    if (new RegExp('\\b' + pt + 's?\\b').test(lower)) return req('property_type', 'eq', pt, text);
  }

  // fallback → location / free text (lenient contains match)
  return req('location', 'contains', text, text);
}

function detectSection(line) {
  const m = line.match(/^([a-z][a-z \-]*?)\s*:\s*(.*)$/i);
  if (!m) return null;
  const section = SECTION_ALIASES[m[1].toLowerCase().trim()];
  if (!section) return null;
  return { section, inline: m[2].trim() };
}

function addTokens(mission, section, line) {
  // Split on commas that are NOT thousands separators (comma followed by a non-digit), plus ';'.
  for (const tk of line.split(/,(?=\s*\D)|;/)) {
    const r = normalizeRequirement(tk);
    if (r) mission[section].push(r);
  }
}

function dedupeIds(mission) {
  const seen = new Set();
  for (const key of ['mandatory', 'preferred', 'exclusions']) {
    for (const r of mission[key]) {
      let id = r.id;
      let n = 2;
      while (seen.has(id)) id = `${r.id}-${n++}`;
      r.id = id;
      seen.add(id);
    }
  }
}

/**
 * Parse a free-text objective into a structured mission.
 * @param {string} objective
 * @param {{ sourceDomain?: string, options?: Object }} [ctx]
 * @returns {ResearchMission}
 */
export function parseMission(objective, ctx = {}) {
  const text = String(objective == null ? '' : objective);
  const mission = {
    objective: '',
    mandatory: [],
    preferred: [],
    exclusions: [],
    sourceDomain: ctx.sourceDomain || '',
    options: Object.assign({ strict_mandatory_unknown: false }, ctx.options || {}),
  };
  let section = 'objective';
  const objectiveParts = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const header = detectSection(line);
    if (header) {
      section = header.section;
      if (header.inline) {
        if (section === 'objective') objectiveParts.push(header.inline);
        else addTokens(mission, section, header.inline);
      }
      continue;
    }
    if (section === 'objective') objectiveParts.push(line);
    else addTokens(mission, section, line);
  }
  mission.objective = objectiveParts.join(' ').trim();
  dedupeIds(mission);
  return mission;
}

/**
 * Validate a mission object.
 * @param {ResearchMission} mission
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateMission(mission) {
  const errors = [];
  if (!mission || typeof mission !== 'object') return { ok: false, errors: ['mission must be an object'] };
  if (typeof mission.objective !== 'string' || !mission.objective.trim()) {
    errors.push('objective must be a non-empty string');
  }
  for (const key of ['mandatory', 'preferred', 'exclusions']) {
    if (!Array.isArray(mission[key])) {
      errors.push(`${key} must be an array`);
      continue;
    }
    mission[key].forEach((r, i) => {
      if (!r || typeof r !== 'object') {
        errors.push(`${key}[${i}] must be an object`);
        return;
      }
      if (!r.id) errors.push(`${key}[${i}] missing id`);
      if (!r.attribute) errors.push(`${key}[${i}] missing attribute`);
      if (!OPERATORS.has(r.operator)) errors.push(`${key}[${i}] invalid operator: ${r.operator}`);
    });
  }
  const ids = ['mandatory', 'preferred', 'exclusions']
    .flatMap((k) => (Array.isArray(mission[k]) ? mission[k] : []))
    .map((r) => r && r.id)
    .filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push('requirement ids must be unique');
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run the unit runner to verify the mission tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `23 passed, 0 failed (23 total)`, exit 0.

- [ ] **Step 5: Mirror the implemented module into the firefox build (byte-identical)**

Run:
```bash
cp src/chrome/src/agent/listing-agent/mission.js src/firefox/src/agent/listing-agent/mission.js
```
Expected: no output, exit 0.

- [ ] **Step 6: Run the contract test to confirm parity still holds**

Run:
```bash
node test/listing-agent-contract.test.mjs
```
Expected: PASS. `33 passed, 0 failed` (16 owned-path + 16 parity + 1 package.json touchpoint), exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/chrome/src/agent/listing-agent/mission.js src/firefox/src/agent/listing-agent/mission.js test/listing-agent/run.mjs
git commit -m "feat: implement mission parsing/validation (domain core)"
```

---

## Task 2: Filter planning (`filter-planner.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Domain core — filter planning" block)
- Implement: `src/chrome/src/agent/listing-agent/filter-planner.js`
- Mirror: `src/firefox/src/agent/listing-agent/filter-planner.js`

- [ ] **Step 1: Append the failing filter-planner tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Domain core: filter planning ------------------------------------------
const FILTER_MOD = 'src/chrome/src/agent/listing-agent/filter-planner.js';

// A mission whose mandatory reqs cover bedrooms (range), price (range), location (select).
function filterMission() {
  return {
    objective: 'Find apartments in New Cairo under 35k.',
    mandatory: [
      { id: 'bedrooms', attribute: 'bedrooms', operator: 'gte', value: 2, raw: '2+ bedrooms' },
      { id: 'price', attribute: 'price', operator: 'lte', value: 35000, raw: '<=35000', currency: 'EGP' },
      { id: 'location', attribute: 'location', operator: 'contains', value: 'New Cairo', raw: 'New Cairo' },
    ],
    preferred: [{ id: 'garden', attribute: 'garden', operator: 'exists', value: true, raw: 'garden' }],
    exclusions: [],
    sourceDomain: 'dubizzle.com.eg',
    options: { strict_mandatory_unknown: false },
  };
}

const CAPABILITIES = [
  { attribute: 'location', type: 'select', values: ['New Cairo', 'Maadi', 'Zamalek'] },
  { attribute: 'bedrooms', type: 'range' },
  { attribute: 'price', type: 'range' },
  { attribute: 'amenities', type: 'multiselect', values: ['pool', 'gym'] },
];

test('planFilters: maps mandatory bedrooms/price/location to a filter plan', async () => {
  const { planFilters } = await load(FILTER_MOD);
  const { filters, unmapped } = planFilters(filterMission(), CAPABILITIES);
  assert.equal(unmapped.length, 0, 'expected all mandatory reqs mapped');
  const byAttr = Object.fromEntries(filters.map((f) => [f.attribute, f.value]));
  assert.deepEqual(byAttr.bedrooms, { min: 2 });
  assert.deepEqual(byAttr.price, { max: 35000 });
  assert.equal(byAttr.location, 'New Cairo');
});

test('planFilters: ignores source filters with no matching requirement', async () => {
  const { planFilters } = await load(FILTER_MOD);
  const { filters } = planFilters(filterMission(), CAPABILITIES);
  assert.ok(!filters.some((f) => f.attribute === 'amenities'), 'must not emit an unrequested filter');
});

test('planFilters: never invents a filter the source does not expose', async () => {
  const { planFilters } = await load(FILTER_MOD);
  const mission = filterMission();
  mission.mandatory.push({ id: 'furnishing_state', attribute: 'furnishing_state', operator: 'eq', value: 'furnished', raw: 'furnished' });
  const { filters, unmapped } = planFilters(mission, CAPABILITIES); // no furnishing capability
  assert.ok(!filters.some((f) => f.attribute === 'furnishing_state'));
  assert.ok(unmapped.some((r) => r.attribute === 'furnishing_state'), 'unmapped must report the furnishing req');
});

test('planFilters: select value not among options → unmapped, not invented', async () => {
  const { planFilters } = await load(FILTER_MOD);
  const mission = filterMission();
  mission.mandatory = [{ id: 'location', attribute: 'location', operator: 'contains', value: 'Sheikh Zayed', raw: 'Sheikh Zayed' }];
  const { filters, unmapped } = planFilters(mission, CAPABILITIES);
  assert.equal(filters.length, 0);
  assert.ok(unmapped.some((r) => r.attribute === 'location'));
});

test('planFilters: preferred requirements never become filters', async () => {
  const { planFilters } = await load(FILTER_MOD);
  const caps = CAPABILITIES.concat([{ attribute: 'garden', type: 'select', values: ['yes', 'no'] }]);
  const { filters } = planFilters(filterMission(), caps);
  assert.ok(!filters.some((f) => f.attribute === 'garden'), 'a preferred (nice-to-have) must not filter out candidates');
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. The 23 prior tests pass; the 5 new `planFilters` tests print `✗` with `NotImplemented: planFilters`. Summary `23 passed, 5 failed (28 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/filter-planner.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — filter planning (pure).
// Maps ONLY mandatory mission requirements onto a site's advertised filter
// capabilities. Preferred (nice-to-have) requirements never drive filters — a
// filter for a nice-to-have would wrongly exclude otherwise-eligible candidates.
// Filters are an accelerator, never evidence (design §4.1-§4.3, §13.3).

// Synonyms that map a requirement/capability attribute to a canonical name.
const ATTR_SYNONYMS = {
  bedroom: 'bedrooms',
  beds: 'bedrooms',
  bed: 'bedrooms',
  bathroom: 'bathrooms',
  baths: 'bathrooms',
  bath: 'bathrooms',
  rent: 'price',
  fee: 'price',
  'rental fee': 'price',
  budget: 'price',
  furnished: 'furnishing_state',
  furnishing: 'furnishing_state',
  area: 'area_m2',
  size: 'area_m2',
};

function canonAttr(a) {
  const k = String(a == null ? '' : a).toLowerCase().trim();
  return ATTR_SYNONYMS[k] || k;
}

function mapValue(r, cap) {
  const type = String(cap.type || '').toLowerCase();
  if (type === 'range' || type === 'number') {
    if (r.operator === 'lte' || r.operator === 'lt') return { max: r.value };
    if (r.operator === 'gte' || r.operator === 'gt') return { min: r.value };
    if (r.operator === 'eq') return { min: r.value, max: r.value };
    return undefined;
  }
  if (type === 'select' || type === 'multiselect' || type === 'enum') {
    const opts = Array.isArray(cap.values) ? cap.values.map((v) => String(v).toLowerCase()) : null;
    if (r.operator === 'in' && Array.isArray(r.value)) {
      const kept = r.value.filter((v) => !opts || opts.includes(String(v).toLowerCase()));
      return kept.length ? kept : undefined;
    }
    if (r.operator === 'eq' || r.operator === 'contains') {
      if (!opts || opts.includes(String(r.value).toLowerCase())) return r.value;
      return undefined; // never invent an option the source doesn't expose
    }
    return undefined;
  }
  return undefined; // unknown control type → cannot safely map
}

/**
 * Produce a filter plan from a mission and the site's filter capabilities.
 * @param {import('./mission.js').ResearchMission} mission
 * @param {Array<{ attribute: string, type: string, values?: any[] }>} capabilities
 * @returns {{ filters: Array<{ attribute: string, value: any }>, unmapped: import('./mission.js').Requirement[] }}
 */
export function planFilters(mission, capabilities) {
  const caps = Array.isArray(capabilities) ? capabilities : [];
  const capByAttr = new Map();
  for (const c of caps) if (c && c.attribute) capByAttr.set(canonAttr(c.attribute), c);

  const filters = [];
  const unmapped = [];
  const mandatory = mission && Array.isArray(mission.mandatory) ? mission.mandatory : [];

  for (const r of mandatory) {
    const cap = capByAttr.get(canonAttr(r.attribute));
    if (!cap) {
      unmapped.push(r);
      continue;
    }
    const value = mapValue(r, cap);
    if (value === undefined) {
      unmapped.push(r);
      continue;
    }
    filters.push({ attribute: cap.attribute, value });
  }
  return { filters, unmapped };
}
```

- [ ] **Step 4: Run the unit runner to verify the filter tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `28 passed, 0 failed (28 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/agent/listing-agent/filter-planner.js src/firefox/src/agent/listing-agent/filter-planner.js
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
git add src/chrome/src/agent/listing-agent/filter-planner.js src/firefox/src/agent/listing-agent/filter-planner.js test/listing-agent/run.mjs
git commit -m "feat: implement mission-driven filter planning (domain core)"
```

---

## Task 3: Requirement evaluation & eligibility (`requirements.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Domain core — requirements" block)
- Implement: `src/chrome/src/agent/listing-agent/requirements.js`
- Mirror: `src/firefox/src/agent/listing-agent/requirements.js`

- [ ] **Step 1: Append the failing requirements tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Domain core: requirement evaluation & eligibility ---------------------
const REQ_MOD = 'src/chrome/src/agent/listing-agent/requirements.js';

// A listing that satisfies the acceptance mission (3-bed, 30k EGP, New Cairo).
function passingListing() {
  return {
    title: '3 BR apartment', price: 30000, currency: 'EGP', frequency: 'Monthly',
    attributes: { bedrooms: 3, location: 'First Settlement, New Cairo', furnishing_state: 'Furnished' },
  };
}

function acceptanceMission() {
  return {
    objective: 'Find apartments for rent in New Cairo.',
    mandatory: [
      { id: 'bedrooms', attribute: 'bedrooms', operator: 'gte', value: 2, raw: '2+ bedrooms' },
      { id: 'price', attribute: 'price', operator: 'lte', value: 35000, raw: '<=35000' },
      { id: 'location', attribute: 'location', operator: 'contains', value: 'New Cairo', raw: 'New Cairo' },
    ],
    preferred: [], exclusions: [], sourceDomain: 'dubizzle.com.eg',
    options: { strict_mandatory_unknown: false },
  };
}

test('evaluateRequirement: gte → PASS/FAIL', async () => {
  const { evaluateRequirement } = await load(REQ_MOD);
  const r = { id: 'bedrooms', attribute: 'bedrooms', operator: 'gte', value: 2 };
  assert.equal(evaluateRequirement(r, { attributes: { bedrooms: 3 } }), 'PASS');
  assert.equal(evaluateRequirement(r, { attributes: { bedrooms: 1 } }), 'FAIL');
});

test('evaluateRequirement: lte handles a numeric string with currency/commas', async () => {
  const { evaluateRequirement } = await load(REQ_MOD);
  const r = { id: 'price', attribute: 'price', operator: 'lte', value: 35000 };
  assert.equal(evaluateRequirement(r, { price: '30,000 EGP' }), 'PASS');
  assert.equal(evaluateRequirement(r, { price: '40,000 EGP' }), 'FAIL');
});

test('evaluateRequirement: contains matches location substring case-insensitively', async () => {
  const { evaluateRequirement } = await load(REQ_MOD);
  const r = { id: 'location', attribute: 'location', operator: 'contains', value: 'New Cairo' };
  assert.equal(evaluateRequirement(r, { attributes: { location: 'First Settlement, New Cairo' } }), 'PASS');
  assert.equal(evaluateRequirement(r, { attributes: { location: 'Maadi' } }), 'FAIL');
});

test('evaluateRequirement: absent attribute → UNKNOWN (never fabricated FAIL)', async () => {
  const { evaluateRequirement } = await load(REQ_MOD);
  const r = { id: 'furnishing_state', attribute: 'furnishing_state', operator: 'eq', value: 'furnished' };
  assert.equal(evaluateRequirement(r, { attributes: {} }), 'UNKNOWN');
  assert.equal(evaluateRequirement(r, { attributes: { furnishing_state: '' } }), 'UNKNOWN');
});

test('evaluateRequirement: in → PASS when any member matches', async () => {
  const { evaluateRequirement } = await load(REQ_MOD);
  const r = { id: 'furnishing_state', attribute: 'furnishing_state', operator: 'in', value: ['furnished', 'unfurnished'] };
  assert.equal(evaluateRequirement(r, { attributes: { furnishing_state: 'Unfurnished' } }), 'PASS');
  assert.equal(evaluateRequirement(r, { attributes: { furnishing_state: 'Semi-furnished' } }), 'FAIL');
});

test('evaluateListing: all mandatory PASS → PASS', async () => {
  const { evaluateListing } = await load(REQ_MOD);
  const res = evaluateListing(passingListing(), acceptanceMission());
  assert.equal(res.eligibility, 'PASS');
  assert.equal(res.perRequirement.length, 3);
  assert.ok(res.perRequirement.every((p) => p.status === 'PASS'));
});

test('evaluateListing: any mandatory FAIL → FAIL', async () => {
  const { evaluateListing } = await load(REQ_MOD);
  const listing = passingListing();
  listing.price = 40000; // over ceiling
  assert.equal(evaluateListing(listing, acceptanceMission()).eligibility, 'FAIL');
});

test('evaluateListing: lenient default → UNKNOWN mandatory yields UNKNOWN_BLOCKED', async () => {
  const { evaluateListing } = await load(REQ_MOD);
  const mission = acceptanceMission();
  mission.mandatory.push({ id: 'furnishing_state', attribute: 'furnishing_state', operator: 'eq', value: 'furnished' });
  const listing = passingListing();
  delete listing.attributes.furnishing_state; // now UNKNOWN, not FAIL
  const res = evaluateListing(listing, mission);
  assert.equal(res.eligibility, 'UNKNOWN_BLOCKED');
});

test('evaluateListing: strictMandatoryUnknown flips UNKNOWN to FAIL', async () => {
  const { evaluateListing } = await load(REQ_MOD);
  const mission = acceptanceMission();
  mission.mandatory.push({ id: 'furnishing_state', attribute: 'furnishing_state', operator: 'eq', value: 'furnished' });
  const listing = passingListing();
  delete listing.attributes.furnishing_state;
  assert.equal(evaluateListing(listing, mission, { strictMandatoryUnknown: true }).eligibility, 'FAIL');
  // mission.options can carry the same flag
  mission.options.strict_mandatory_unknown = true;
  assert.equal(evaluateListing(listing, mission).eligibility, 'FAIL');
});

test('evaluateListing: a matching exclusion disqualifies (FAIL)', async () => {
  const { evaluateListing } = await load(REQ_MOD);
  const mission = acceptanceMission();
  mission.exclusions.push({ id: 'ground', attribute: 'level', operator: 'eq', value: 'ground' });
  const listing = passingListing();
  listing.attributes.level = 'Ground';
  assert.equal(evaluateListing(listing, mission).eligibility, 'FAIL');
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. The 28 prior tests pass; the 10 new `evaluateRequirement`/`evaluateListing` tests print `✗` with `NotImplemented`. Summary `28 passed, 10 failed (38 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/requirements.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — lenient eligibility evaluation (pure).
// Feature plan: Domain core. Design refs: §6.
//
// Policy (design §6): eligibility = PASS only when every mandatory requirement
// is PASS; FAIL when any mandatory is FAIL (or a mission exclusion matches);
// UNKNOWN_BLOCKED when nothing FAILs but at least one mandatory is UNKNOWN. A
// per-mission `strict_mandatory_unknown` flag (default false) treats UNKNOWN as
// FAIL. Missing source data is UNKNOWN, never a fabricated FAIL.

function resolveValue(listing, attribute) {
  if (!listing) return undefined;
  const attrs = listing.attributes || {};
  if (attrs[attribute] != null && attrs[attribute] !== '') return attrs[attribute];
  if (listing[attribute] != null && listing[attribute] !== '') return listing[attribute];
  return undefined;
}

function isNumeric(v) {
  if (typeof v === 'number') return !isNaN(v);
  return typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v.replace(/,/g, '')));
}

function num(v) {
  return typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
}

function eqText(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/**
 * Evaluate a single requirement against a listing.
 * @param {import('./mission.js').Requirement} requirement
 * @param {Object} listing
 * @returns {'PASS'|'FAIL'|'UNKNOWN'}
 */
export function evaluateRequirement(requirement, listing) {
  if (!requirement) return 'UNKNOWN';
  const actual = resolveValue(listing, requirement.attribute);
  if (actual === undefined || actual === null || actual === '') return 'UNKNOWN';
  const expected = requirement.value;
  switch (requirement.operator) {
    case 'gte': return num(actual) >= num(expected) ? 'PASS' : 'FAIL';
    case 'lte': return num(actual) <= num(expected) ? 'PASS' : 'FAIL';
    case 'gt': return num(actual) > num(expected) ? 'PASS' : 'FAIL';
    case 'lt': return num(actual) < num(expected) ? 'PASS' : 'FAIL';
    case 'eq':
      if (isNumeric(expected) && isNumeric(actual)) return num(actual) === num(expected) ? 'PASS' : 'FAIL';
      return eqText(actual, expected) ? 'PASS' : 'FAIL';
    case 'contains':
      return String(actual).toLowerCase().includes(String(expected).toLowerCase()) ? 'PASS' : 'FAIL';
    case 'in': {
      const arr = Array.isArray(expected) ? expected : [expected];
      const a = String(actual).toLowerCase();
      return arr.some((v) => eqText(actual, v) || a.includes(String(v).toLowerCase())) ? 'PASS' : 'FAIL';
    }
    case 'exists':
      return 'PASS'; // presence already established above
    case 'not':
      return eqText(actual, expected) ? 'FAIL' : 'PASS';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Evaluate a listing against a mission (lenient by default).
 * @param {Object} listing
 * @param {import('./mission.js').ResearchMission} mission
 * @param {{ strictMandatoryUnknown?: boolean }} [opts]
 * @returns {{ eligibility: 'PASS'|'FAIL'|'UNKNOWN_BLOCKED', perRequirement: Array<{ requirementId: string, status: 'PASS'|'FAIL'|'UNKNOWN' }> }}
 */
export function evaluateListing(listing, mission, opts = {}) {
  const mandatory = mission && Array.isArray(mission.mandatory) ? mission.mandatory : [];
  const exclusions = mission && Array.isArray(mission.exclusions) ? mission.exclusions : [];
  const strict = opts.strictMandatoryUnknown != null
    ? !!opts.strictMandatoryUnknown
    : !!(mission && mission.options && mission.options.strict_mandatory_unknown);

  const perRequirement = mandatory.map((r) => ({ requirementId: r.id, status: evaluateRequirement(r, listing) }));
  const excluded = exclusions.some((r) => evaluateRequirement(r, listing) === 'PASS');
  const anyFail = perRequirement.some((p) => p.status === 'FAIL');
  const anyUnknown = perRequirement.some((p) => p.status === 'UNKNOWN');

  let eligibility;
  if (excluded || anyFail || (strict && anyUnknown)) eligibility = 'FAIL';
  else if (anyUnknown) eligibility = 'UNKNOWN_BLOCKED';
  else eligibility = 'PASS';

  return { eligibility, perRequirement };
}
```

- [ ] **Step 4: Run the unit runner to verify the requirements tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `38 passed, 0 failed (38 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/agent/listing-agent/requirements.js src/firefox/src/agent/listing-agent/requirements.js
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
git add src/chrome/src/agent/listing-agent/requirements.js src/firefox/src/agent/listing-agent/requirements.js test/listing-agent/run.mjs
git commit -m "feat: implement lenient requirement evaluation & eligibility (domain core)"
```

---

## Task 4: Transparent ranking (`ranking.js`)

**Files:**
- Test: `test/listing-agent/run.mjs` (append a "Domain core — ranking" block)
- Implement: `src/chrome/src/agent/listing-agent/ranking.js`
- Mirror: `src/firefox/src/agent/listing-agent/ranking.js`

- [ ] **Step 1: Append the failing ranking tests**

In `test/listing-agent/run.mjs`, insert this block immediately **above** the `// --- run ---` divider:

```js
// --- Domain core: ranking --------------------------------------------------
const RANK_MOD = 'src/chrome/src/agent/listing-agent/ranking.js';

// Fully-populated listing (all 16 canonical fields present) at 30k under a 35k ceiling.
function richListing() {
  return {
    title: 'Nice apartment', price: 30000, currency: 'EGP', frequency: 'Monthly',
    evidence_confidence: 0.8,
    attributes: {
      property_type: 'Apartment', bedrooms: 3, bathrooms: 2, area_m2: 150,
      furnishing_state: 'Furnished', location: 'New Cairo', level: 3, view: 'Garden',
      parking: true, garden: true, compound: 'Fifth Square', availability: 'Immediate',
    },
  };
}

function rankMission(preferred) {
  return {
    objective: 'Find apartments in New Cairo under 35k.',
    mandatory: [{ id: 'price', attribute: 'price', operator: 'lte', value: 35000, raw: '<=35000' }],
    preferred: preferred || [],
    exclusions: [], sourceDomain: 'dubizzle.com.eg', options: { strict_mandatory_unknown: false },
  };
}

test('computeRanking: breakdown weights are 50/25/15/10 and contributions sum to score', async () => {
  const { computeRanking } = await load(RANK_MOD);
  const { score, breakdown } = computeRanking(richListing(), rankMission());
  assert.deepEqual(breakdown.map((b) => b.factor), ['preferred', 'price', 'evidence', 'completeness']);
  assert.deepEqual(breakdown.map((b) => b.weight), [50, 25, 15, 10]);
  const sum = breakdown.reduce((s, b) => s + b.contribution, 0);
  assert.ok(Math.abs(sum - score) < 1e-9, `contributions ${sum} != score ${score}`);
});

test('computeRanking: fully-populated 30k/35k listing scores 75.57', async () => {
  const { computeRanking } = await load(RANK_MOD);
  const preferred = [
    { id: 'garden', attribute: 'garden', operator: 'exists', value: true },
    { id: 'parking', attribute: 'parking', operator: 'exists', value: true },
  ];
  const { score } = computeRanking(richListing(), rankMission(preferred));
  // preferred 2/2 -> 50 ; price (35000-30000)/35000*25 -> 3.57 ; evidence 0.8*15 -> 12 ; completeness 16/16*10 -> 10
  assert.equal(score, 75.57);
});

test('computeRanking: no preferred requirements → preferred term contributes the full 50', async () => {
  const { computeRanking } = await load(RANK_MOD);
  const { breakdown } = computeRanking(richListing(), rankMission([]));
  const pref = breakdown.find((b) => b.factor === 'preferred');
  assert.equal(pref.contribution, 50);
});

test('computeRanking: price above the ceiling → price term is 0', async () => {
  const { computeRanking } = await load(RANK_MOD);
  const listing = richListing();
  listing.price = 40000; // above 35000 ceiling
  const { breakdown } = computeRanking(listing, rankMission([]));
  const price = breakdown.find((b) => b.factor === 'price');
  assert.equal(price.contribution, 0);
});
```

- [ ] **Step 2: Run the unit runner to verify the new tests fail**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: FAIL. The 38 prior tests pass; the 4 new `computeRanking` tests print `✗` with `NotImplemented: computeRanking`. Summary `38 passed, 4 failed (42 total)`, exit 1.

- [ ] **Step 3: Implement `src/chrome/src/agent/listing-agent/ranking.js`**

Replace the entire file contents with:

```js
// AI Listing Agent — transparent ranking (pure).
// Feature plan: Domain core. Design refs: §7 (explicit 50/25/15/10 formula).
//
// ranking_score =
//     50 * (supported_preferred / total_preferred)   // vacuously 1 when a mission has no preferred reqs
//   + 25 * price_attractiveness                       // (ceiling - price) / ceiling, clamped to [0,1]
//   + 15 * evidence_confidence                        // 0..1, supplied by the extraction phase (0 if absent)
//   + 10 * field_completeness                         // fraction of canonical fields populated
import { evaluateRequirement } from './requirements.js';

export const RANKING_WEIGHTS = Object.freeze({ preferred: 50, price: 25, evidence: 15, completeness: 10 });

// Canonical Listing fields (design §3): top-level scalars + attributes.
export const CANONICAL_FIELDS = Object.freeze([
  'title', 'price', 'currency', 'frequency',
  'property_type', 'bedrooms', 'bathrooms', 'area_m2', 'furnishing_state',
  'location', 'level', 'view', 'parking', 'garden', 'compound', 'availability',
]);

function round2(n) { return Math.round(n * 100) / 100; }
function clamp01(n) { return isNaN(n) ? 0 : Math.max(0, Math.min(1, n)); }
function term(factor, weight, ratio) { return { factor, weight, contribution: round2(weight * ratio) }; }

function fieldValue(listing, f) {
  if (!listing) return undefined;
  const attrs = listing.attributes || {};
  return f in attrs ? attrs[f] : listing[f];
}

function isPopulated(v) {
  return v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
}

/**
 * Compute a listing's ranking score and a human-readable breakdown.
 * @param {Object} listing
 * @param {import('./mission.js').ResearchMission} mission
 * @returns {{ score: number, breakdown: Array<{ factor: string, weight: number, contribution: number }> }}
 */
export function computeRanking(listing, mission) {
  const preferred = mission && Array.isArray(mission.preferred) ? mission.preferred : [];
  const mandatory = mission && Array.isArray(mission.mandatory) ? mission.mandatory : [];

  // 1. Preferred coverage (vacuously full when a mission has no preferred requirements).
  const supported = preferred.filter((r) => evaluateRequirement(r, listing) === 'PASS').length;
  const preferredRatio = preferred.length === 0 ? 1 : supported / preferred.length;

  // 2. Price attractiveness vs the mandatory budget ceiling.
  const ceilingReq = mandatory.find((r) => r.attribute === 'price' && (r.operator === 'lte' || r.operator === 'lt'));
  const ceiling = ceilingReq ? Number(ceilingReq.value) : null;
  const price = listing && listing.price != null ? Number(String(listing.price).replace(/[^0-9.\-]/g, '')) : null;
  let priceAttractiveness = 0;
  if (ceiling && ceiling > 0 && price != null && !isNaN(price)) {
    priceAttractiveness = clamp01((ceiling - price) / ceiling);
  }

  // 3. Evidence confidence (0..1); 0 when the extraction phase hasn't supplied it.
  const evidenceConf = clamp01(Number(listing && listing.evidence_confidence));

  // 4. Field completeness across canonical fields.
  const populated = CANONICAL_FIELDS.filter((f) => isPopulated(fieldValue(listing, f))).length;
  const completeness = CANONICAL_FIELDS.length ? populated / CANONICAL_FIELDS.length : 0;

  const breakdown = [
    term('preferred', RANKING_WEIGHTS.preferred, preferredRatio),
    term('price', RANKING_WEIGHTS.price, priceAttractiveness),
    term('evidence', RANKING_WEIGHTS.evidence, evidenceConf),
    term('completeness', RANKING_WEIGHTS.completeness, completeness),
  ];
  const score = round2(breakdown.reduce((s, b) => s + b.contribution, 0));
  return { score, breakdown };
}
```

- [ ] **Step 4: Run the unit runner to verify the ranking tests pass**

Run:
```bash
node test/listing-agent/run.mjs
```
Expected: PASS. Summary `42 passed, 0 failed (42 total)`, exit 0.

- [ ] **Step 5: Mirror into firefox**

Run:
```bash
cp src/chrome/src/agent/listing-agent/ranking.js src/firefox/src/agent/listing-agent/ranking.js
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
git add src/chrome/src/agent/listing-agent/ranking.js src/firefox/src/agent/listing-agent/ranking.js test/listing-agent/run.mjs
git commit -m "feat: implement transparent ranking formula (domain core)"
```

---

## Task 5: Full-suite & merge-safety verification

**Files:** none (verification only)

- [ ] **Step 1: Run the complete default suite**

Run:
```bash
npm test
```
Expected: all upstream tests pass, then `test:contract` prints `33 passed, 0 failed` and `test:listing-agent` prints `42 passed, 0 failed (42 total)`; overall exit 0.

- [ ] **Step 2: Confirm the extension still packages for both builds**

Run:
```bash
npm run build:zip
```
Expected: exit 0, zips written under `dist/`. Because the chrome and firefox copies are byte-identical and pure, packaging is unaffected.

- [ ] **Step 3: Run the merge-safety gate**

Run:
```bash
npm run test:merge-safety
```
Expected: contract `33 passed`, unit runner `42 passed`, merge-rehearsal passes (`✓ merges cleanly with upstream/main`) or skips (offline); overall exit 0.

The domain core is complete: mission → filter plan → eligibility → ranking are all pure, deterministic, and unit-tested, ready to be fed by the detection/extraction phase and orchestrated by the model-driven controller in later plans.

---

## Self-Review

**1. Spec coverage:**
- §1.2 acceptance mission (3 mandatory reqs; furnishing not mandatory) — Task 1 tests `acceptance mission yields exactly 3 mandatory` and `furnishing is NOT mandatory unless requested`. ✓
- §3 data model shapes (top-level `price` etc., `attributes.*`) — honored in `resolveValue`/`fieldValue` and in every test fixture. ✓
- §4.1–§4.2 filter planning (only mission reqs drive filters; discovered capabilities; never invent) — Task 2 covers map/ignore/not-invent/value-not-in-options; plus the deliberate "mandatory-only" rule (preferred never filters). ✓
- §6 eligibility (lenient PASS/FAIL/UNKNOWN_BLOCKED; `strict_mandatory_unknown` default false) — Task 3 covers all four outcomes + strict flip + exclusion disqualification. ✓
- §7 ranking (50/25/15/10, transparent breakdown, price floored at 0) — Task 4 covers weights, sum-equals-score, the worked 75.57 case, empty-preferred, and over-ceiling floor. ✓
- §10 attribute-agnostic finishing values — Task 1 `"furnished or unfurnished" → in` and the finishing map (semi-furnished / fully finished / core and shell / move-in ready) implemented. ✓
- §13.2 "same listing must not change eligibility merely because a field exists" — guaranteed structurally: `evaluateListing` only iterates `mission.mandatory`, so an unrequested attribute can never affect eligibility. ✓
- §13.3 native-filter planning test list (1 discover, 2 map, 3 ignore unrelated, 4 don't invent, 5 not sole evidence, 6 graceful fallback) — items 1–4 are unit-tested here; item 5 holds because `planFilters` only plans (eligibility is a separate module); item 6 (fallback on application failure) is a controller-runtime behavior, deferred to the Controller plan and noted. ✓
- §13.4 unit-test list (mission parsing, requirement normalization, filter-plan generation, requirement evaluation, ranking formula) — all present; evidence aggregation, dedup, and progress belong to later plans. ✓

**2. Placeholder scan:** No "TBD/implement later/handle edge cases." Every step shows full file content or an exact command with expected output and exact pass/fail counts.

**3. Type consistency:**
- `Requirement` fields (`id`, `attribute`, `operator`, `value`, `raw`, optional `currency`) are produced by `parseMission` and consumed unchanged by `planFilters`, `evaluateRequirement`, and `computeRanking`.
- Operator set is identical in `mission.js` (`OPERATORS`), `requirements.js` (switch cases), and `filter-planner.js` (`mapValue`).
- Canonical attribute names match across modules (`bedrooms`, `price`, `location`, `furnishing_state`, `area_m2`, `level`, `view`, `parking`, `garden`, `compound`, …).
- `evaluateListing` returns `{ eligibility, perRequirement:[{requirementId,status}] }` exactly as declared in the Foundation stub JSDoc; `computeRanking` returns `{ score, breakdown:[{factor,weight,contribution}] }` as declared.
- `ranking.js` imports `evaluateRequirement` from `./requirements.js` (implemented in Task 3, so Task 4 depends on Task 3 — tasks are ordered accordingly).
- No new owned files and no touchpoint changes → `test/listing-agent-contract.json` and its `33 passed` result are unchanged; the unit runner grows 14 → 42. ✓
