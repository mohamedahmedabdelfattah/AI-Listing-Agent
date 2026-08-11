# AI Listing Agent — MVP-1 Design

**Status:** Draft v2 — updated after validated Dubizzle listing/source review
**Scope:** MVP-1 slice of the AI Listing Agent (v7.0 master spec), scoped down to a single
implementable vertical: Egyptian apartment-rental research on dubizzle Egypt (formerly "OLX
Egypt" — the two merged; the live domain is `dubizzle.com.eg`).
**Relationship to master spec:** This document narrows the ~90-section v7.0 master
specification (`AI Listing Agent — Master Business Requirements, Product Requirements &
Technical Build Specification`) down to the concrete decisions needed to start MVP-1
implementation against the actual [AI-Listing-Agent](https://github.com/mohamedahmedabdelfattah/AI-Listing-Agent)
fork of WebBrain. Where this document is silent, the master spec governs; where the two
conflict, this document wins for MVP-1.

---

## 1. Scope

### 1.1 Validated source

**Target:** `https://www.dubizzle.com.eg/en/properties/apartments-duplex-for-rent/new-cairo/`

Confirmed by direct inspection:

- OLX Egypt now redirects to dubizzle — one platform, one adapter, one domain
  (`dubizzle.com.eg`) to scope `allowed_domains` to.
- Results pages use **numbered pagination** (`1 2 3 … 199`), not infinite scroll. This is the
  simpler of the two archetypes called out in §70 of the master spec — MVP-1's "Continuous
  Listing Discovery" loop advances by opening the next page URL, not by scrolling and waiting
  for lazy-loaded content.
- Each results page renders **three stacked listing collections** with visually distinct card
  variants: "Elite Ads", "Featured Ads", and the regular "Ads" list. This is a concrete,
  real case for Collection Detection (§12) — the detector cannot assume one collection per
  page.
- Cards expose clean, consistent fields: price + currency (EGP) + frequency (Monthly/Daily/
  Yearly), property type, bedroom/bathroom count, area (m²), title, furnished (Yes/No),
  neighborhood/compound, relative post time ("2 hours ago"), and Call/WhatsApp contact-action
  buttons (presence only — no MVP-1 use of these; contact features are out of scope).
- The page also exposes a left-hand facet panel (bedrooms, bathrooms, furnished, amenities,
  level, area, deposit) — useful as a reference for canonical attribute names, but the agent
  must still do its own mission-driven detection/evaluation independent of site filters, since
  facet shape differs per source.

### 1.2 Acceptance mission

The acceptance mission is intentionally generic and must not encode source-specific
attributes as mandatory unless the user explicitly requests them.

```text
Objective: Find apartments for rent in New Cairo.

Mandatory:
2+ bedrooms
≤ 35,000 EGP
New Cairo
```

For acceptance, the following remain **preferred signals only**:

```text
Ground floor
Garden
Compound
Parking
Open view
```

Furnishing/finishing state is **not mandatory by default**. If the user says:

```text
furnished
semi-furnished
unfurnished
core and shell
fully finished
move-in ready
```

the mission parser must turn that into a user requirement only when the user actually
requests it. The implementation must not contain a fixed `furnished = required` rule.

### 1.3 Explicit non-goals (unchanged from master spec §66)

Cross-source discovery, entity/unit/seller resolution, price intelligence, conversation
enrichment, contacting sellers, approval queues, Autopilot, multi-user, cloud sync, billing,
MCP product integration, enterprise infrastructure, and a dedicated `ResearchSession` object
(Mission → Job is sufficient without it for a single source).

---

## 2. Fork Integration Strategy

**Constraint:** the fork must remain cleanly mergeable with upstream WebBrain. All new
capability is additive; edits to existing upstream files are minimized and kept to the same
*shape* of diff upstream itself has used for comparable additions (e.g. how the Traces page
or the `/watch` command were added), so a future `git merge upstream/main` has the smallest
possible chance of touching a line this project also touched.

### 2.1 New files only (zero merge risk)

Duplicated into both `src/chrome/` and `src/firefox/`, following the repo's existing
convention of duplicating rather than sharing code between builds:

```
src/<chrome|firefox>/src/agent/listing-agent/
  mission.js         — mission parsing/validation (mandatory/preferred/exclusions)
  detection.js        — collection + listing-boundary detection
  extraction.js        — normalizes tool output into a canonical Listing object
  evidence.js
  requirements.js      — eligibility evaluation (PASS/FAIL/UNKNOWN)
  ranking.js
  dedup.js
  controller.js         — detect → extract → evaluate → rank → dedupe → persist → progress
  persistence.js         — new IndexedDB store, sibling to trace/recorder.js (not an edit to it)
  export.js               — pure JSON/CSV serializer, mirrors trace-export.js's pattern
  research-command.js      — pure parser for the /research slash command, mirrors watch-command.js

src/<chrome|firefox>/src/ui/
  listings.html, listings.js   — new full-page Listing Workspace, mirrors traces.html/traces.js
```

### 2.2 Minimal, precedented touchpoints in existing files

| File | Change | Precedent |
|---|---|---|
| `manifest.json` (Chrome + Firefox) | Register `listings.html` as a web-accessible resource | Same as existing `traces.html` entry |
| `sidepanel.js` (or `settings.html`) | One new nav link to open the Listings page | Same as existing Traces link |
| `sidepanel.js` slash-command registry | One new registry entry pointing at `research-command.js` | Same pattern as `/watch` → `watch-command.js` |

### 2.3 Explicitly not touched

`tools.js`, `agent.js`, `adapters.js`, `scheduler.js`. Detection/extraction reuse *existing*
tools (`get_accessibility_tree`, `extract_data`, `read_page`, `scroll`, `wait_for_stable`)
purely through orchestration logic in the new module tree — no new browser-interaction tool
schemas are required for MVP-1, so the two files every new tool normally touches
(`tools.js`, `agent.js`) stay untouched.

The continuous "auto-advance through pages" loop runs as a bounded task inside the existing,
unmodified Agent loop (`agent.js`) while a tab is open — the same mechanism any other
multi-step autonomous task already uses (loop detection, context compaction, etc. all apply
for free). It does **not** add a new job kind to `scheduler.js`. If a future MVP needs a
research job to survive being paused across a full browser restart, it should drive that
through the already-public `schedule_task` tool as a black box (persisting its own
checkpoint via `persistence.js`), rather than adding internals to `scheduler.js`.

---

## 3. Data Model (MVP-1 subset of master spec Appendix A)

```
ResearchMission
  id, objective, mandatory_requirements[], preferred_requirements[], exclusions[]
  source_domain, created_at, status

ResearchJob
  id, mission_id, status (CREATED|RUNNING|PAUSED|WAITING_FOR_USER|FAILED|COMPLETED)
  waiting_for_user_reason
  current_url, current_page_number
  listings_seen, listings_found, new_unique_listings, duplicate_count
  consecutive_no_progress_cycles
  started_at, completed_at, errors[]

Listing
  id, job_id, source_url, source_listing_id
  title, description, price, currency, frequency
  attributes { property_type, bedrooms, bathrooms, area_m2, furnishing_state, location, level, view, parking, garden, compound, availability }
  evidence[]            — see §5
  eligibility            — PASS | FAIL | UNKNOWN_BLOCKED (see §6)
  ranking_score           — see §7
  evidence_confidence
  discovered_at, last_seen_at
```

`ResearchSession`, `Entity`, `Unit`, `Seller`, `Conversation`, `AutomationPolicy` are
deliberately **not** stubbed — YAGNI. They're added in MVP-2/3 when entity resolution and
outreach actually need them, per the master spec's own MVP-2/3 phasing.

Storage: new IndexedDB database, following `trace/recorder.js`'s existing open/versioning
idiom exactly (familiar shape, not a new persistence philosophy).

---

## 4. Filter-Assisted Discovery, Detection & Extraction Pipeline (MVP-1)

The validated Dubizzle results page exposes native filters for location, furnished state,
rental fee, rental frequency, bedrooms, bathrooms, type, area, level, deposit, and
amenities. It also exposes a sort control and multiple result collections. citeturn1view0

MVP-1 should use those filters as an **optional discovery accelerator**, not as a source of
truth.

### 4.1 Mission-driven filter planning

The research controller first asks:

> Can the current source express any of the user's mission requirements through native
> filters?

The answer is discovered dynamically from the current page. The agent must not contain
hard-coded rules such as:

```text
furnished = mandatory
bedrooms = mandatory
```

Instead:

```text
User mission
↓
Structured requirements
↓
Discover available source filters
↓
Semantically map compatible requirements to filters
↓
Build filter plan
↓
Apply supported filters
↓
Verify resulting page state
↓
Continue with independent listing detection/evaluation
```

Only requirements explicitly present in the mission may drive filtering.

Example:

```text
User:
"Find a 2+ bedroom apartment in New Cairo under 35k."

Possible filter plan:
- Location → New Cairo
- Bedrooms → 2+
- Rental Fee → max 35,000
```

If the user instead says:

```text
"Find a furnished apartment..."
```

then furnishing may be added to the filter plan.

If the user says:

```text
"Furnished or unfurnished is fine."
```

the system should not apply a furnishing restriction.

### 4.2 Filter capability abstraction

The source-facing filter layer should expose discovered capabilities approximately as:

```text
FilterCapability
  attribute
  operator
  value_options
  control_reference
  confidence
  application_method
  verification_method
```

The exact browser interaction remains owned by WebBrain's existing browser tools.

The Listing Agent decides **what** filter is useful; WebBrain decides **how** to interact
with the page.

No Dubizzle-specific selector or fixed attribute list belongs in the core requirement
evaluator.

### 4.3 Filters are an accelerator, never evidence

A native filter result means:

> The source currently claims this result belongs in the filtered set.

It does **not** mean:

> The Listing Agent independently verified the listing.

Therefore every retained listing still goes through:

```text
Filtered candidate
↓
Listing detection
↓
Extraction
↓
Evidence capture
↓
Independent requirement evaluation
```

A source filter may reduce work, but it may never replace evidence or eligibility
evaluation.

### 4.4 Two-pass extraction

MVP-1 uses:

**Pass 1 — Result-page candidate extraction**

Extract enough information from listing cards to determine obvious mission eligibility:

```text
source_url
source_listing_id
title
price
currency
frequency
property_type
bedrooms
location
visible furnishing/finishing state when present
```

**Pass 2 — Detail-page enrichment**

Open only candidates that remain relevant after Pass 1 and extract richer evidence:

```text
description
bathrooms
area
floor/level
furnishing/finishing state
amenities
garden
parking
view
compound
availability
```

The exact Pass 2 trigger is mission-driven. It must not assume that furnishing is always
relevant.

### 4.5 Detection escalation

MVP-1 implements Levels 0–2 only:

- **Level 0 (DOM/structured data):** opportunistically check JSON-LD/schema.org.
- **Level 1 (structural heuristics):** pre-filter accessibility/extracted output for repeated
  listing-like structures.
- **Level 2 (LLM reasoning):** identify collection boundaries, listing boundaries, and field
  mappings.

Level 3 (vision) and Level 4 (Teach This Page) remain MVP-2.

The validated source currently demonstrates at least three result collections (`Elite Ads`,
and the main result area includes additional listing groups), so collection detection must
remain explicit rather than assuming one repeated collection. citeturn1view0

### 4.6 Detail-page validation facts

The supplied live listing is a useful regression fixture. It exposes:

- price and monthly frequency;
- property type, area, bedrooms and bathrooms;
- a structured Details panel;
- furnishing state;
- description and amenities;
- seller information;
- a stable numeric ad id.

The page identifies the listing as `Ad id 503863245`, and its URL contains the same numeric
identifier. citeturn0view0

The listing also demonstrates why furnishing cannot be globally mandatory: the example is
explicitly `Furnished: No` while still being a valid rental listing. citeturn0view0

Related ads are also present on the detail page. They must be treated as a secondary
collection and never as additional primary listings for the current detail page unless
the research controller explicitly enters that collection. citeturn0view0

## 5. Evidence Model & Aggregation (answers master spec §18/Q6)

Per-attribute evidence carries `{ value, source_text, extraction_method, confidence,
verification_status }` as defined in the master spec §16.

**Chosen aggregation strategy for `listing.evidence_confidence`:** a weighted average across
extracted attributes, where attributes referenced by a **mandatory** requirement are weighted
2x relative to attributes referenced by a **preferred** requirement or left as general
metadata. This is documented here per §18's requirement that no aggregation rule be invented
silently during implementation — if it needs to change, update this section first.

---

## 6. Requirement Evaluation & Eligibility Policy (answers master spec §28)

- Mandatory requirements evaluate to `PASS` / `FAIL` / `UNKNOWN`.
- **Default MVP-1 policy: lenient.** A mandatory requirement that evaluates to `UNKNOWN` does
  **not** by itself flip eligibility to FAIL — real inventory (e.g. a listing that simply
  doesn't mention "furnished" in its text) would otherwise be silently dropped. Instead:
  - `eligibility = PASS` only when every mandatory requirement is `PASS`.
  - `eligibility = FAIL` when any mandatory requirement is `FAIL`.
  - `eligibility = UNKNOWN_BLOCKED` when no requirement is `FAIL` but at least one is
    `UNKNOWN` — shown in the workspace as "needs verification," included in results, but kept
    visually distinct from a clean `PASS`.
- A per-mission `strict_mandatory_unknown` flag (default `false`) lets a user opt into
  treating `UNKNOWN` as `FAIL` if they'd rather see fewer, more certain results.
- This satisfies §28's "must not manufacture certainty" while staying useful for a real
  apartment search, where source text is inconsistently detailed.

---

## 7. Ranking (answers master spec §29)

`ranking_score` (0–100) is a documented, transparent formula — not a black box:

```
ranking_score =
    50 * (supported_preferred_count / total_preferred_count)
  + 25 * price_attractiveness        # (mandatory budget ceiling − price) / ceiling, floored at 0
  + 15 * evidence_confidence_normalized
  + 10 * field_completeness           # fraction of canonical fields populated
```

Eligibility, ranking, and evidence stay separate fields on `Listing`, per §10 — no composite
`match_score` is introduced.

---

## 8. Deduplication (MVP-1 subset of master spec §26)

MVP-1 implements:

- **Level 1 — exact URL match.**
- **Level 2 — source listing ID** (extracted from the dubizzle URL slug's numeric ID suffix).

**Level 3 (content similarity)** — normalized title + price + location fuzzy match — is a
stretch goal if time allows, not required for acceptance.

**Level 4 (entity resolution)** is explicitly out of scope for MVP-1, per master spec §66.

---

## 9. Research Controller & Loop Limits (answers master spec §22/Appendix H)

The loop (`controller.js`) runs: detect → extract → evaluate → rank → dedupe → persist →
progress-check → advance page → repeat, inside the existing Agent loop.

**Initial MVP-1 limits** (per Appendix H's own caveat, these are starting values to validate
empirically, not fixed forever):

| Limit | Initial value |
|---|---|
| `maximum_continuous_runtime` | 10 minutes |
| `maximum_pages` | 20 (≈ 950 raw cards at ~48/page — far more than any mission needs) |
| `maximum_listings_persisted` | 300 |
| `no_new_content_threshold` | 2 consecutive pages with zero new unique listings |

Every termination reason is recorded on `ResearchJob.errors`/status, never inferred silently.

---

## 10. Mission Creation UX

`/research <objective and requirements in free text>` — a new slash command
(`research-command.js`, pure parser, mirrors `watch-command.js`) that:

1. Parses free text into the structured `ResearchMission` schema.
2. Classifies only explicitly requested constraints as mandatory, preferred, or exclusions.
3. Preserves ambiguous attributes as user-confirmable requirements rather than inventing
   constraints.
4. Shows the parsed mission back to the user as a confirmation card before starting.
5. On confirm, starts the Research Controller against the current tab.

The parser must be attribute-agnostic. It must support values such as:

```text
furnished
semi-furnished
unfurnished
fully finished
core and shell
move-in ready
```

without treating any of them as mandatory by default.

---

## 11. Listing Workspace UI

New full page (`listings.html`/`listings.js`), mirroring `traces.js`'s structure (a
data-heavy, filterable/sortable table/grid is the right shape, same as Traces). Shows:
mission + job status, listing count, filters (eligibility, ranking, price, bedrooms), sort,
listing cards (ranking score, eligibility badge, evidence badge, ✓/✗/? per requirement,
Open/Save/Reject actions), and Export buttons.

---

## 12. Export

`export.js` is a pure, DOM-free JSON/CSV serializer, mirroring `trace-export.js`'s existing
pure-serializer pattern (unit-testable without a DOM or IndexedDB). Scopes: current results,
selected listings, shortlist — per master spec §51 minus the scopes that don't exist yet
(`MISSION`/`ARCHIVE` history across multiple jobs is a later-phase concept once
`ResearchSession` exists).

---

## 13. Testing Strategy

### 13.1 Listing fixtures

Static HTML snapshots of the Dubizzle New Cairo results page are captured into:

```text
test/fixtures/listings/
```

The supplied detail-page source should also become a fixture because it provides a stable
example of the structured Details panel, amenities, related ads, seller area, and numeric
ad id. citeturn0view0

Fixtures must cover at minimum:

```text
multi-collection results page
detail page
listing with Furnished = Yes
listing with Furnished = No
missing optional attribute
related-ads collection
```

### 13.2 Mission-driven requirement tests

The requirement evaluator must be tested with different missions against the same listing
fixtures.

Examples:

```text
Mission A:
2+ bedrooms, ≤35k, New Cairo

Mission B:
2+ bedrooms, ≤35k, New Cairo, furnished

Mission C:
2+ bedrooms, ≤35k, New Cairo, furnished OR unfurnished

Mission D:
2+ bedrooms, ≤35k, New Cairo, fully finished / move-in ready
```

The same listing must not change eligibility merely because a field exists on the source.
Eligibility changes only when the mission requests that field.

### 13.3 Native-filter planning tests

Test that the filter planner:

1. discovers available source filter capabilities;
2. maps compatible mission requirements to filters;
3. ignores unrelated source filters;
4. does not invent filters that the source does not expose;
5. does not make filter state the sole eligibility evidence;
6. gracefully falls back to unfiltered research when filter application fails.

### 13.4 Unit tests

Pure functions:

```text
mission parsing
requirement normalization
filter-plan generation
requirement evaluation
ranking formula
evidence aggregation
dedup levels 1–2
progress/termination logic
```

### 13.5 Integration tests

Test:

```text
mission → filter planning → filter application request
→ detection → extraction → evaluation → ranking
→ deduplication → persistence → progress
```

### 13.6 Browser test

One real Chrome run against the validated Dubizzle source remains the MVP-1 acceptance
gate.

The browser test must verify both:

```text
with native filters applied
```

and:

```text
without native filters applied
```

for at least one mission, proving that filtering is an optimization rather than a hidden
dependency.

### 13.7 Upstream merge regression gate

Every upstream merge must prove that the Listing Agent touchpoints and capabilities remain
intact.

Add a merge-safety test suite that checks:

```text
1. all Listing Agent-owned files still exist;
2. the three intended upstream integration touchpoints still exist;
3. their required integration hooks remain callable;
4. Listing Agent unit/integration tests still pass;
5. the extension builds for Chrome;
6. the extension builds for Firefox;
7. a clean temporary merge of upstream/main into the Listing Agent branch succeeds.
```

The merge test must run against a temporary worktree/branch so it never mutates the developer's
working tree.

A failing upstream merge must be treated as a build/review blocker, not repaired by silently
overwriting either side.

### 13.8 Ownership boundary

The regression suite should maintain a small machine-readable manifest of:

```text
Listing Agent-owned paths
upstream touchpoint paths
required hook identifiers
```

This is a contract test, not a checksum test. Upstream may legitimately modify its own code;
the gate is checking that the integration contract still exists.

## 14. MVP-1 Acceptance Criteria (adapted from master spec Appendix J)

A user can:

1. Type `/research` with the Appendix J mission text and confirm the parsed mission.
2. Start research from the dubizzle New Cairo rentals page.
3. Watch the agent auto-advance through result pages (no manual scrolling/clicking).
4. See listings appear with structured attributes, eligibility, ranking, and evidence.
5. See no duplicate listing records across pages.
6. Open a listing's original URL.
7. Export results as JSON and as CSV.
8. Stop/cancel the run.
9. See the run terminate on its own within the configured limits even without cancelling.

---

## 15A. Implementation Readiness Gate

The design is now sufficiently specified to begin implementation planning.

Before writing product code, the coding agent should execute this bounded sequence:

```text
1. Create isolated MVP-1 branch/workspace.
2. Establish clean repository test/build baseline.
3. Reconcile the existing repository against §2 touchpoints.
4. Build the Listing Agent Capability Gap & Implementation Plan.
5. Add the merge-safety regression harness before feature implementation.
6. Implement mission-driven filter planning.
7. Implement the MVP-1 listing pipeline.
```

Do **not** wait for perfect answers to future-phase architecture questions. The remaining
unknowns are repository/source reconnaissance items, not blockers to starting the MVP-1 plan.

The first implementation checkpoint should therefore be:

```text
Clean baseline
+
Touchpoint contract tests
+
Upstream merge rehearsal
+
Implementation plan
```

Only after that checkpoint should feature implementation begin.

## 15. Open Questions / Risks

- Whether Dubizzle exposes JSON-LD/schema.org consistently remains unconfirmed; Level 0 must
  remain opportunistic.
- The numeric listing ID is confirmed for the supplied example (`503863245`) because the URL
  and page both expose the same identifier. More examples should still be used for regression
  coverage before treating the pattern as universal. citeturn0view0
- Exact filter-control interaction must be discovered during repository/source reconnaissance;
  no source-specific selectors should be embedded in the core requirement model.
- The nav-link touchpoint in `sidepanel.js`/`settings.html` must be re-verified against the
  actual repository before implementation.
- Native filters may change independently of extraction. Filter planning therefore needs a
  graceful fallback and must never become the only validation path.


---

## Appendix — v2 Change Log

### v2.1 Mission Requirements Corrected

The MVP-1 acceptance mission no longer makes furnishing mandatory.

Canonical mandatory requirements:

```text
2+ bedrooms
≤ 35,000 EGP
New Cairo
```

Furnishing is only a requirement when explicitly requested by the user.

### v2.2 Dynamic Requirement Model

The design now explicitly supports user-requested property/finishing states such as:

```text
furnished
semi-furnished
unfurnished
fully finished
core and shell
move-in ready
```

These are values in the mission/attribute model, not hard-coded mandatory segments.

### v2.3 Filter-Assisted Discovery

Native source filters are now a first-class optimization:

```text
Mission
↓
Discover source filter capabilities
↓
Semantically map compatible requirements
↓
Apply filters
↓
Independently verify listings
```

Filters reduce the candidate set but never replace extraction, evidence, or eligibility.

### v2.4 Two-Pass Extraction

MVP-1 now separates:

```text
Result-page candidate extraction
```

from:

```text
Detail-page enrichment
```

to reduce unnecessary detail-page navigation.

### v2.5 Upstream Merge Safety

A dedicated regression gate is now part of MVP-1 design:

```text
owned-path existence
+
touchpoint contract checks
+
unit/integration tests
+
Chrome build
+
Firefox build
+
temporary upstream merge rehearsal
```

This protects Listing Agent additions from being silently deleted or disconnected by upstream
merges.

### v2.6 Validated Detail-Page Fixture

The supplied Dubizzle listing is now an explicit regression fixture candidate. It demonstrates
structured Details data, a `Furnished: No` case, related ads, seller information, and a numeric
listing ID. citeturn0view0

### v2.7 Readiness

The design is considered ready for the next phase:

```text
activate project workspace
→ create isolated branch
→ establish clean baseline
→ create merge-safety harness
→ write Capability Gap & Implementation Plan
→ begin MVP-1 implementation
```
