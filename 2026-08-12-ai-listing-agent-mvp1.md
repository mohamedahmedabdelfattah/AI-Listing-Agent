# AI Listing Agent MVP-1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver a merge-safe, mission-driven Dubizzle Egypt apartment-rental research vertical for Chrome and Firefox.

**Architecture:** New mirrored Listing Agent modules own parsing, discovery, evaluation, persistence, and export. Existing side panels parse and confirm /research; new code orchestrates existing browser capabilities without editing agent tools, agent, adapters, or scheduler internals.

**Tech Stack:** Vanilla ES modules, Chrome MV3, Firefox MV2, IndexedDB, Node assertions, static HTML fixtures.

## Global Constraints

- Mirror Listing Agent files across Chrome and Firefox; keep pure modules byte-identical.
- Do not edit src/*/src/agent/tools.js, agent.js, adapters.js, or scheduler.js.
- Page-derived data remains untrusted wherever it enters an LLM prompt or tool result.
- Native filters only reduce candidates; eligibility derives from independently extracted evidence.
- Only user-requested attributes become requirements; furnishing is never globally mandatory.
- Preserve PASS, FAIL, and UNKNOWN_BLOCKED; strict unknown defaults false.
- Controller limits: 10 minutes, 20 pages, 300 listings, two no-new-content pages.
- Rehearse upstream merge in a temporary worktree only.

## Reconnaissance and Merge-Safety Contract

| Area | Actual touchpoint | Contract |
| --- | --- | --- |
| Slash command | src/*/src/ui/sidepanel.js: import at 48, SLASH_COMMANDS near 460/582, parseSlashCommands near 6980/7139 | /research remains discoverable and parser-reachable without a new agent tool. |
| Navigation | src/*/src/ui/settings.html: btn-open-traces at 1262/1334 | Add sibling btn-open-listings to listings.html. Settings, not a sidepanel nav link, is the precedent. |
| Packaging | src/*/manifest.json | Do not add listings.html to web_accessible_resources; Traces proves extension pages need not be exposed. |
| Storage/UI | trace/recorder.js, traces.html, traces.js, agent/trace-export.js | New Listing Agent DB, UI, and pure serializer modules. |

Create listing-agent-contract.json with owned paths, touchpoint paths, and identifier hooks. Contract checks must test semantic existence, not checksums, to tolerate normal upstream edits.

## File Structure

- Create listing-agent-contract.json, test/listing-agent-contract.test.mjs, and test/listing-agent-merge-rehearsal.test.mjs.
- Create test/fixtures/listings static sanitized result/detail fixtures.
- Create src/<browser>/src/agent/listing-agent/{mission,filter-planner,detection,extraction,evidence,requirements,ranking,dedup,progress,persistence,export,controller}.js.
- Create src/<browser>/src/ui/{research-command,listings}.js and listings.html.
- Modify only src/<browser>/src/ui/sidepanel.js, settings.html, package.json, test/run.js, and relevant CI workflows.

### Task 1: Add merge-safety contract tests before product code

**Files:** Create listing-agent-contract.json, test/listing-agent-contract.test.mjs, test/listing-agent-merge-rehearsal.test.mjs. Modify package.json and test/run.js.

**Interfaces:** Provide npm run test:listing-contract and npm run test:listing-merge; both consume contract JSON.

- [ ] **Step 1: Write failing ownership and hook tests.**

```js
assert.match(sidepanel, /parseResearchSlashCommand/);
assert.match(sidepanel, /value: '\/research'/);
assert.match(settings, /id="btn-open-listings" href="listings.html"/);
assert.equal(contract.ownedPaths.includes('src/chrome/src/agent/listing-agent'), true);
```

- [ ] **Step 2: Run node test/listing-agent-contract.test.mjs.** Expect FAIL because the contract, paths, link, and parser hook do not yet exist.

- [ ] **Step 3: Implement a declarative harness.** Read JSON, assert each owned path exists, and evaluate explicit contains/regex hooks. Add product hook records in Task 3.

- [ ] **Step 4: Implement temporary merge rehearsal.** Add detached worktree at an exact temporary path from HEAD, merge UPSTREAM_REF (default upstream/main) with no commit, abort in finally, and remove that exact temporary worktree.

- [ ] **Step 5: Run npm.cmd run test:listing-contract and npm.cmd run test:listing-merge; commit as test: add listing agent merge contract harness.** The merge check may report a real conflict but must never mutate the working worktree.

### Task 2: Define pure mission and eligibility contracts

**Files:** Create src/<browser>/src/agent/listing-agent/{mission,evidence,requirements,ranking,dedup,progress}.js and test/listing-agent-domain.test.mjs.

**Interfaces:** parseMission(text), evaluateRequirements(listing, mission), calculateRanking(listing, mission), dedupeKey(listing), shouldTerminate(job, limits).

- [ ] **Step 1: Write failing domain tests.**

```js
assert.equal(parseMission('Find a 2+ bedroom apartment in New Cairo under 35k.').mandatory.length, 3);
assert.equal(evaluateRequirements(unfurnished, furnishedMission).eligibility, 'FAIL');
assert.equal(evaluateRequirements(unfurnished, baseMission).eligibility, 'PASS');
assert.equal(evaluateRequirements(missingFurnishing, furnishedMission).eligibility, 'UNKNOWN_BLOCKED');
assert.equal(dedupeKey({ source_url: 'https://dubizzle.com.eg/ad-503863245' }), 'id:503863245');
```

- [ ] **Step 2: Run node test/listing-agent-domain.test.mjs.** Expect FAIL with missing exports.

- [ ] **Step 3: Implement minimum pure modules.** Mandatory outcomes reduce to FAIL if any fail, UNKNOWN_BLOCKED if none fail and one is unknown, else PASS. Add strict unknown as a mission flag, mandatory evidence weighting two, the specified 0–100 ranking, URL then numeric-ID dedupe, and every termination limit.

- [ ] **Step 4: Mirror, run node test/listing-agent-domain.test.mjs, and commit as feat: add listing agent domain contracts.** Expect PASS for both browser imports and mission permutations.

### Task 3: Add /research and workspace entry points

**Files:** Create src/<browser>/src/ui/research-command.js, listings.html, listings.js; modify sidepanel.js, settings.html, listing-agent-contract.json; create test/research-command.test.mjs.

**Interfaces:** parseResearchSlashCommand(value) returns { ok, objective, usage } without browser APIs. Confirmation starts the Listing Agent controller; no agent tool is introduced.

- [ ] **Step 1: Write failing parser/hook tests.**

```js
assert.deepEqual(parseResearchSlashCommand('/research Find apartments in New Cairo.'), { ok: true, objective: 'Find apartments in New Cairo.', usage: RESEARCH_COMMAND_USAGE });
assert.equal(parseResearchSlashCommand('/research').ok, false);
```

- [ ] **Step 2: Run node test/research-command.test.mjs and npm.cmd run test:listing-contract.** Expect FAIL.

- [ ] **Step 3: Implement parity UI hooks.** Add an extension-local listings.html Settings link, structured /research metadata, an early branch analogous to /watch, and a parsed-mission confirmation card. Do not change manifest web-accessible resources.

- [ ] **Step 4: Re-run both tests and commit as feat: add listing research entry points.** Expect PASS.

### Task 4: Add fixtures, two-pass discovery/extraction, and filter planning

**Files:** Create static fixtures for multi-collection results, furnished yes/no detail, and related ads; create detection.js, extraction.js, filter-planner.js for both browsers; create extraction and filter-plan tests.

**Interfaces:** detectCollections(page), extractResultCandidates(collection), extractDetailEvidence(page), planFilters(mission, capabilities).

- [ ] **Step 1: Write failing fixture tests.**

```js
assert.equal(detectCollections(results).primary.length, 3);
assert.equal(extractResultCandidates(results).every(x => x.source_url && x.price), true);
assert.equal(extractDetailEvidence(detail).source_listing_id, '503863245');
assert.deepEqual(planFilters(baseMission, capabilities).filters.map(x => x.attribute), ['location', 'bedrooms', 'price']);
assert.equal(planFilters(baseMission, capabilities).filters.some(x => x.attribute === 'furnishing_state'), false);
```

- [ ] **Step 2: Run focused tests.** Expect FAIL before module creation.

- [ ] **Step 3: Implement Levels 0–2.** Use opportunistic structured data, structural repeated-card heuristics, and an LLM-request representation when needed. Related ads are secondary. Filter failure returns an unfiltered plan; filter state is never evidence.

- [ ] **Step 4: Re-run tests and commit as feat: add listing discovery and extraction.** Expect PASS for collections, furnishing variants, and unsupported filters.

### Task 5: Persist jobs and orchestrate the bounded loop

**Files:** Create persistence.js, controller.js in both browser trees; create test/listing-agent-controller.test.mjs.

**Interfaces:** createJob(mission), saveListing(listing), listJobListings(jobId), runResearch({ mission, job, browserTools, persistence }).

- [ ] **Step 1: Write a failing fake-browser integration test.**

```js
const job = await runResearch({ mission, browserTools: fakeTools, persistence: memoryStore });
assert.equal(job.status, 'COMPLETED');
assert.equal(job.new_unique_listings, 2);
assert.equal(job.duplicate_count, 1);
assert.equal(job.errors.at(-1).code, 'NO_NEW_CONTENT_LIMIT');
```

- [ ] **Step 2: Run node test/listing-agent-controller.test.mjs.** Expect FAIL with absent exports.

- [ ] **Step 3: Implement dedicated stores for missions, jobs, listings, checkpoints.** Sequence: filter plan, detect, Pass 1, independently evaluate, rank, dedupe, persist, progress, numbered-page advance. Check cancel, cap, time, and no-progress every cycle.

- [ ] **Step 4: Re-run controller test and commit as feat: add bounded listing research controller.** Expect PASS for completion, cancellation, recovery, duplicates, filter fallback, and each limit.

### Task 6: Complete workspace and pure JSON/CSV export

**Files:** Create export.js; modify listings.html/listings.js; create listing-agent-export and listing-workspace tests.

**Interfaces:** listingsToJson(listings), listingsToCsv(listings), visibleListings(state, filters).

- [ ] **Step 1: Write failing tests.**

```js
assert.match(listingsToCsv([listing]), /eligibility,ranking_score/);
assert.equal(JSON.parse(listingsToJson([listing]))[0].eligibility, 'UNKNOWN_BLOCKED');
assert.equal(visibleListings(state, { eligibility: 'PASS' }).length, 1);
```

- [ ] **Step 2: Run focused tests.** Expect FAIL before exports exist.

- [ ] **Step 3: Implement pure serialization and workspace filtering.** Keep eligibility badges distinct and retain per-attribute evidence in JSON/CSV.

- [ ] **Step 4: Re-run tests and commit as feat: add listing workspace export.** Expect PASS.

### Task 7: Wire the complete gate and record acceptance evidence

**Files:** Modify package.json, test/run.js, relevant CI workflows. Create test/manual-listing-agent.md.

- [ ] **Step 1: Add test:listing-agent chaining contract, parser, domain, extraction, filter, controller, export, and workspace tests.**

- [ ] **Step 2: Run npm.cmd run test:listing-agent, npm.cmd test, npm.cmd run build:zip, and npm.cmd run test:listing-merge.** Expect passing tests, Chrome/Firefox archives, and a clean rehearsal or a genuine blocker.

- [ ] **Step 3: Record manual acceptance.** On the New Cairo URL, test both with and without native filters; verify pagination, evidence, duplicate prevention, JSON/CSV export, Stop, and autonomous termination. Smoke-test Firefox UI flow.

- [ ] **Step 4: Commit as test: gate listing agent integration.**

## Plan Self-Review

- Tasks 1 and 7 cover ownership, hooks, both browser builds, and temporary upstream merge rehearsal.
- Tasks 2–6 cover mission model, filters, extraction, evidence, eligibility, ranking, dedupe, persistence, UI, and export.
- The actual manifests disprove the draft web-accessible-resource assumption; this plan deliberately does not widen that surface.
- Vision, cross-source research, entity resolution, outreach, scheduler changes, and new agent tools remain out of scope.
