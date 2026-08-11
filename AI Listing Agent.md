# AI Listing Agent
## Master Business Requirements, Product Requirements & Technical Build Specification

**Version:** 7.0  
**Status:** Master Build Specification — Ready for AI Coding-Agent Planning  
**Product:** AI Listing Research Agent  
**Initial Vertical:** Egyptian Apartment Rental Research  
**Primary Browser:** Chrome / Chromium  
**Secondary Browser:** Firefox  
**Foundation:** Fork of WebBrain  
**Development Model:** Extend existing open-source capabilities; do not rebuild them  
**Primary Objective:** Build the missing AI Listing Agent capabilities on top of WebBrain

---

# §1 — Executive Summary

The AI Listing Agent is an AI-powered research system that turns an ordinary browser page containing listings, posts, search results, feeds, or other potentially relevant content into a structured, searchable research workspace.

The initial use case is apartment rental research in Egypt.

The user defines a research mission such as:

> Find a furnished 2+ bedroom apartment in New Cairo under 35,000 EGP/month, preferably ground floor, with parking and an open view.

The user opens a relevant web page and starts the Listing Agent.

The agent then:

```text
Observe page
↓
Detect listings
↓
Extract structured information
↓
Capture evidence
↓
Evaluate mandatory requirements
↓
Rank qualified listings
↓
Deduplicate
↓
Persist results
↓
Continue scrolling/researching
↓
Display results
```

Later versions extend this into:

```text
Cross-source discovery
↓
Entity resolution
↓
Unit resolution
↓
Seller intelligence
↓
Conversation enrichment
↓
Contact orchestration
↓
Autopilot
```

The product is **not** a replacement for WebBrain.

WebBrain provides the browser-agent foundation.

The Listing Agent adds the **listing-research domain intelligence layer**.

---

# §2 — Product Vision

> **Tell the agent what you are looking for, give it a starting point, and let it perform the repetitive listing research while preserving evidence, uncertainty, provenance, and user control.**

The long-term product is a general-purpose research agent for listings and opportunities across the web.

The first vertical is real-estate rental research.

---

# §3 — Core Product Principle

The product must be evaluated as:

> **An AI Listing Research Agent built on top of WebBrain.**

Not:

> A new browser automation framework.

Existing WebBrain capabilities should be reused wherever possible.

The coding agent must not rebuild:

- browser automation
- basic scrolling
- basic navigation
- provider abstraction
- basic extraction
- accessibility-tree infrastructure
- existing agent loop
- existing side-panel infrastructure
- existing teaching-capture infrastructure
- existing storage primitives

unless reconnaissance proves that an existing capability cannot safely support the Listing Agent requirement.

---

# §4 — WebBrain Foundation vs Listing Agent Scope

## 4.1 Inherited Foundation

The fork already provides or is expected to provide:

```text
Browser interaction
Agent loop
Navigation
Scrolling
Waiting for stable page state
DOM interaction
Accessibility tree
Screenshots
Basic extraction
Provider abstraction
Tool execution
Side panel
Browser extension lifecycle
Storage primitives
Conversation/recovery primitives
Teaching capture
Source adapter extension points
```

These are **dependencies**, not the primary product scope.

## 4.2 New Listing Agent Capabilities

The Listing Agent adds:

```text
Research Mission
Listing Detection
Listing Boundary Detection
Listing Extraction Model
Requirement Evaluation
Ranking
Evidence Model
Research Controller
Listing Persistence
Listing Deduplication
Listing Lifecycle
Research Patterns
Seller Intelligence
Entity Resolution
Unit Resolution
Cross-Source Discovery
Price Intelligence
Conversation Enrichment
Contact Orchestration
Approval Workflow
Autopilot
Listing Workspace
Research Analytics
JSON/CSV Export
```

---

# §5 — Initial User Problem

Online apartment hunting is fragmented.

Useful information may exist across:

- social-media posts
- groups
- marketplaces
- classified websites
- property websites
- broker pages
- individual listings
- comments
- images
- videos
- seller conversations

The same apartment may appear multiple times with different:

- prices
- descriptions
- images
- sellers
- contact information
- availability
- amenities
- missing information

The user currently performs repetitive work manually:

1. Search.
2. Scroll.
3. Open listings.
4. Save URLs.
5. Save images.
6. Copy details.
7. Compare.
8. Ask questions.
9. Track answers.
10. Identify duplicates.

The Listing Agent automates this research workflow.

---

# §6 — Product Goals

The Listing Agent must:

1. Accept a natural-language research mission.
2. Convert requirements into structured criteria.
3. Detect listings on arbitrary supported pages.
4. Automatically continue through dynamically loaded results.
5. Extract structured listing information.
6. Preserve evidence for important attributes.
7. Determine mandatory eligibility.
8. Rank eligible listings.
9. Deduplicate listings.
10. Persist research results.
11. Provide a browsable listing workspace.
12. Export results to JSON and CSV.
13. Support cross-source discovery in later phases.
14. Support seller and entity intelligence in later phases.
15. Support seller conversations in later phases.
16. Support controlled outreach and Autopilot in later phases.

---

# §7 — Product Non-Goals

The initial Listing Agent is not:

- a generic scraping platform
- a CAPTCHA bypass system
- an anti-detection system
- a browser replacement
- a payment agent
- a negotiation agent
- a legal agent
- an enterprise SaaS platform
- a distributed crawler
- a billing platform
- an unrestricted autonomous internet agent

---

# §8 — Research Mission

A Research Mission describes what the user wants.

Canonical concept:

```text
ResearchMission
├── objective
├── mandatory_requirements
├── preferred_requirements
├── exclusions
├── special_context
├── research_boundaries
├── ranking_policy
├── evidence_policy
├── contact_policy
└── automation_policy
```

Example:

```text
Objective:
Find apartments for rent in New Cairo.

Mandatory:
- New Cairo
- Furnished
- 2+ bedrooms
- ≤ 35,000 EGP/month

Preferred:
- Ground floor
- Garden
- Compound
- Parking
- Open view

Exclusions:
- Basement
- Shared apartment
- Daily rental

Special context:
Prioritize listings that appear suitable for long-term living.
```

---

# §9 — Requirement Types

Requirements are:

```text
MANDATORY
PREFERRED
EXCLUSION
UNKNOWN
```

Mandatory requirements determine eligibility.

Preferred requirements influence ranking.

Exclusions reject listings when supported by evidence.

Unknown does not mean false.

Example:

```text
Parking = UNKNOWN
```

must not become:

```text
Parking = NO
```

---

# §10 — Eligibility, Ranking and Evidence Must Remain Separate

These concepts must never be collapsed into one score.

### Eligibility

Does the listing satisfy mandatory requirements?

### Ranking

How attractive is the listing relative to the mission?

### Evidence Confidence

How reliable is the extracted information?

Canonical field:

```text
ranking_score
```

There is no canonical `match_score`.

---

# §11 — Listing Detection

This is one of the primary new capabilities.

WebBrain can already interact with and extract information from pages.

The Listing Agent must determine:

> What represents one listing on this page?

The system must detect:

```text
Collection
↓
Repeated listing structure
↓
Listing boundaries
↓
Listing fields
↓
Listing relationships
```

A listing may be represented by:

- a card
- a post
- a row
- a search-result block
- a nested content block
- a dynamically generated item
- another repeated structure

The detector must not assume a fixed HTML layout.

---

# §12 — Generic Listing Detection Pipeline

```text
Page
↓
Page understanding
↓
Collection detection
↓
Candidate listing detection
↓
Listing boundary detection
↓
Field identification
↓
Confidence
↓
Listing extraction
```

Detection should escalate progressively.

```text
Level 0
DOM / structured data
↓
Level 1
Structural heuristics
↓
Level 2
LLM reasoning
↓
Level 3
Vision / advanced reasoning
↓
Level 4
Teach This Page
```

The system should not invoke expensive reasoning on every scroll cycle unnecessarily.

---

# §13 — Listing Detection Failure Recovery

Detection failure must never silently terminate research.

Recovery:

```text
Generic Detection
↓
Low confidence / failure
↓
Ask user to identify one listing
↓
Teach This Page
↓
Create Research Pattern
↓
Validate against additional listings
↓
Continue research
```

If the user does not teach the page:

```text
ResearchJob
→ WAITING_FOR_USER
```

with:

```text
waiting_for_user_reason = TEACH_THIS_PAGE
```

---

# §14 — Research Pattern

A Research Pattern represents reusable learned structure.

A pattern may contain:

```text
id
source_scope
page_signature
listing_selector
listing_boundary
field_mappings
pagination_strategy
scroll_strategy
confidence
created_by
created_at
last_validated
validation_count
status
```

A Research Pattern is configuration.

It is **not arbitrary executable code generated by an LLM**.

---

# §15 — Listing Extraction

The Listing Agent converts each detected listing into a canonical object.

Typical attributes:

```text
title
description
property_type
price
currency
location
area
bedrooms
bathrooms
floor
furnishing
view
parking
garden
compound
amenities
availability
seller
contacts
media
source
source_url
```

The schema must remain extensible.

---

# §16 — Evidence Model

Important attributes should retain evidence.

Example:

```text
Bedrooms:
3

Value:
3

Evidence:
"3 bedrooms"

Source:
Listing description

Confidence:
98

Verification:
LISTING_CLAIMED
```

Evidence fields:

```text
attribute
value
source
evidence
extraction_method
confidence
verification_status
timestamp
```

---

# §17 — Evidence Confidence

Listing-level:

```text
evidence_confidence
```

must remain independent from:

```text
identity_confidence
unit_identity_confidence
contact_confidence
```

Possible verification states:

```text
UNKNOWN
AI_INFERRED
LISTING_CLAIMED
SELLER_CONFIRMED
EXTERNALLY_VERIFIED
USER_VERIFIED
CONTRADICTED
```

---

# §18 — Evidence Confidence Aggregation

The coding agent must determine how attribute-level evidence becomes:

```text
listing.evidence_confidence
```

Potential strategies:

- weighted confidence
- weakest-link
- requirement-weighted confidence
- evidence-type weighting

The implementation must document the selected strategy.

No silent aggregation rule may be invented during implementation.

---

# §19 — Research Controller

The Listing Agent adds a domain-level research controller around WebBrain's browser capabilities.

The controller performs:

```text
Detect
↓
Extract
↓
Evaluate
↓
Persist
↓
Progress Check
↓
Scroll / Navigate
↓
Repeat
```

WebBrain owns the browser action.

The Listing Agent owns the research state and decision logic.

---

# §20 — Continuous Listing Discovery

When the user selects:

> Find Listings

the agent can automatically:

```text
Analyze current content
↓
Extract listings
↓
Deduplicate
↓
Evaluate
↓
Persist
↓
Scroll
↓
Wait
↓
Detect new listings
↓
Repeat
```

The user should not have to manually scroll.

---

# §21 — Research Progress

Canonical research progress:

```text
listings_seen
listings_found
new_unique_listings
new_unique_content
duplicate_ratio
content_fingerprint
consecutive_no_progress_cycles
scrolls
pages
runtime
```

---

# §22 — Research Termination

Every research loop must have explicit exit conditions.

Terminate when:

```text
maximum_runtime
maximum_scrolls
maximum_pages
maximum_listings
no_new_content_threshold
source_failure
user_cancelled
browser_interruption
```

No research loop may rely solely on "the page probably has no more results."

---

# §23 — Research Job

A ResearchJob represents one execution of a mission.

States:

```text
CREATED
QUEUED
RUNNING
PAUSED
WAITING_FOR_USER
FAILED
COMPLETED
```

The Listing Agent must persist enough state to resume a job safely.

---

# §24 — Durable Research State

The research controller must not depend on in-memory agent state as the sole source of truth.

Persist:

```text
job state
current URL
source
progress counters
research depth
visited URLs
listing IDs
errors
retry state
current phase
last checkpoint
```

The coding agent must determine how this maps onto WebBrain's existing storage.

---

# §25 — Research Session

The architecture should distinguish:

```text
ResearchMission
↓
ResearchSession
↓
ResearchJob
```

### Mission

What the user wants.

### Session

The ongoing investigation.

### Job

One execution.

Example:

```text
Mission:
Find 2BR apartments under 30k.

Session:
Apartment Hunt — August 2026.

Job:
Research source A — 23:30.
```

A full ResearchSession object is not mandatory for MVP-1 if reconnaissance determines that Mission + Job is sufficient, but the coding agent must evaluate the model before locking persistence architecture.

---

# §26 — Listing Deduplication

Deduplicate at multiple levels.

### Level 1 — Exact URL

Same canonical URL.

### Level 2 — Source identifier

Same platform listing identifier.

### Level 3 — Content similarity

Strongly matching normalized content.

### Level 4 — Entity resolution

Potentially the same underlying property.

These must remain separate concepts.

```text
Duplicate Listing
≠
Same Property
≠
Same Unit
≠
Same Seller
```

---

# §27 — Listing Lifecycle

Canonical states:

```text
ACTIVE_CONFIRMED
ACTIVE_LAST_SEEN
POSSIBLY_INACTIVE
INACTIVE_CONFIRMED
REAPPEARED
UNKNOWN
```

A single failed scan does not prove removal.

Track:

```text
last_seen_at
last_verified_seen_at
last_scan_at
last_scan_result
last_seen_confidence
absence_count
consecutive_missed_scans
```

---

# §28 — Requirement Evaluation

For every listing:

```text
Mandatory requirement
↓
PASS / FAIL / UNKNOWN

Preferred requirement
↓
SUPPORTED / UNSUPPORTED / UNKNOWN

Exclusion
↓
TRIGGERED / NOT_TRIGGERED / UNKNOWN
```

Mandatory unknowns must be handled according to mission policy.

The agent must not manufacture certainty.

---

# §29 — Ranking

Canonical:

```text
ranking_score
```

Example:

```text
Eligibility:
PASS

Ranking:
91/100

Evidence:
94/100
```

Ranking may consider:

- preferred requirements
- price attractiveness
- completeness
- evidence quality
- user priorities
- source quality
- other mission-defined signals

Ranking must not silently become eligibility.

---

# §30 — Listing Workspace

The primary user experience is a listing workspace.

The user can:

- browse results
- filter
- sort
- view images
- inspect evidence
- open original URL
- save
- reject
- compare
- export
- ask the agent for more research

Example card:

```text
RANKING 91

3BR Furnished Apartment
New Cairo · Compound

28,000 EGP/month

Eligibility:
PASS

Evidence:
94/100

✓ 3 bedrooms
✓ Furnished
✓ New Cairo
✓ Under budget
? Parking

[OPEN]
[SAVE]
[RESEARCH]
[REJECT]
```

---

# §31 — Ask the Agent About Results

The user should be able to query the collected dataset.

Examples:

> Show me the cheapest apartments with parking.

> Which listings have a garden?

> Find apartments where maintenance is included.

> Research the top five further.

> Find this listing elsewhere.

> Which listings have missing information?

The agent should operate against structured research results rather than requiring the user to manually restate the research mission.

---

# §32 — Cross-Source Discovery

Later phase.

For a listing:

```text
Listing A
↓
Extract identifying information
↓
Search other sources
↓
Potential matches
↓
Compare
```

Comparison signals:

```text
price
location
images
description
bedrooms
area
seller
phone
WhatsApp
distinctive phrases
```

Results:

```text
SAME_LISTING
POSSIBLE_SAME
RELATED
DIFFERENT
UNKNOWN
```

---

# §33 — Entity Resolution

Entity resolution asks:

> Are these listings advertisements for the same underlying property/entity?

States:

```text
CONFIRMED_SAME
CONFIRMED_DIFFERENT
POSSIBLE_SAME
UNKNOWN
```

Do not silently merge uncertain entities.

---

# §34 — Seller Identity

Seller identity is independent from property identity.

A seller may advertise many unrelated properties.

Signals such as:

```text
phone
WhatsApp
profile
account
name
```

are primarily seller signals.

Same seller does not imply same property.

---

# §35 — Unit Identity

Unit identity asks:

> Are these listings advertisements for the same specific physical unit?

Canonical fields:

```text
unit_identity_confidence
unit_status
```

States:

```text
CONFIRMED_SAME
CONFIRMED_DIFFERENT
POSSIBLE_SAME
UNKNOWN
NOT_APPLICABLE
```

---

# §36 — Near-Identical Unit Rule

Hard rule:

```text
same building
+
same floor
+
same specifications
+
no unit-level discriminator
=
NO AUTO-CONFIRMED-SAME
```

Examples of unit-level discriminators:

```text
unit number
exact location
orientation
distinctive view
unique floor-plan position
distinctive images
seller-confirmed identity
```

Multiple medium signals must not automatically establish same-unit identity.

---

# §37 — Price Intelligence

Later phase.

Track:

```text
advertised_price
currency
known_monthly_cost
effective_monthly_cost
```

Possible components:

```text
rent
maintenance
deposit
commission
utilities
payment_schedule
other_fees
```

Unknown components remain unknown.

The system must not present incomplete effective cost as exact.

---

# §38 — Seller Intelligence

Later phase.

Seller object:

```text
seller_id
name
phone
whatsapp
profiles
seller_type
listing_count
response_history
```

The seller graph must remain separate from the property/entity graph.

---

# §39 — Missing Information Engine

Identify information that materially affects the decision.

Prioritize questions by:

```text
eligibility impact
ranking impact
price impact
ease of obtaining
```

Example:

```text
Parking:
UNKNOWN

Question:
"Does the apartment include a dedicated parking spot?"
```

---

# §40 — Conversation Enrichment

Later phase.

The agent identifies missing information:

```text
Listing
↓
Missing fields
↓
Generate concise questions
↓
Contact seller
↓
Receive response
↓
Extract answer
↓
Create evidence
↓
Update listing
```

The conversation becomes part of the listing's evidence history.

---

# §41 — Conversation Model

Canonical:

```text
Conversation
├── listing_id
├── entity_id
├── seller_id
├── channel
├── messages
├── questions
├── answers
├── verified_information
├── question_count
├── followup_round_count
├── contact_action_count
└── status
```

---

# §42 — Conversation Limits

Policy:

```text
maximum_questions_per_conversation
maximum_followup_rounds
maximum_contact_actions
```

Runtime counters:

```text
question_count
followup_round_count
contact_action_count
```

The agent must stop when limits are reached.

---

# §43 — Contact Confidence

Every extracted contact channel has:

```text
channel
value
contact_evidence
contact_confidence
contact_source
contact_verification_status
```

Autopilot cannot act on a contact that fails the configured confidence threshold.

---

# §44 — Contact Permission

Research permission and contact permission are separate.

```text
RESEARCH
CONTACT
AUTOPILOT
```

Example:

```text
Research:
ENABLED

Contact:
WhatsApp ENABLED
Platform messaging DISABLED

Autopilot:
DISABLED
```

Research permission must never implicitly grant contact permission.

---

# §45 — Communication Modes

### Manual

User performs the action.

### Assisted

Agent prepares action; user approves.

### Batch Approval

Agent prepares multiple actions; user approves/rejects.

### Autopilot

Agent executes actions that satisfy policy.

Autopilot must never silently enable itself.

---

# §46 — Entity-Level Outreach Deduplication

Default rule:

> Contact the single best qualifying listing per `CONFIRMED_SAME` entity.

Only:

```text
entity_status = CONFIRMED_SAME
```

may be grouped for default outreach deduplication.

`POSSIBLE_SAME` and `UNKNOWN` remain separate.

---

# §47 — Redundant Outreach

Default:

```text
allow_redundant_entity_outreach = false
```

If enabled, the reason must be recorded:

```text
COMPARE_SELLER_RESPONSIVENESS
COMPARE_OWNER_VS_BROKER
VERIFY_AVAILABILITY
COMPARE_PRICING
USER_REQUESTED_REDUNDANCY
OTHER
```

---

# §48 — Autopilot Decision Matrix

A consequential action qualifies only when all applicable gates pass.

```text
Eligibility:
PASS

Ranking:
ranking_score >= minimum_ranking_score

Listing evidence:
evidence_confidence >= minimum_listing_evidence_confidence

Contact:
contact_confidence >= minimum_contact_confidence

Entity:
identity_confidence >= minimum_entity_identity_confidence
when required

Unit:
unit_status = NOT_APPLICABLE
OR
unit_status = CONFIRMED_SAME
AND
unit_identity_confidence >= minimum_unit_identity_confidence

Entity contact count:
within policy

Seller contact count:
within policy

Conversation:
within limits

Channel:
enabled and supported

Automation mode:
AUTOPILOT

Final validation:
PASS
```

---

# §49 — Final Pre-Action Validation

Immediately before any consequential action:

```text
Refresh listing state
↓
Confirm listing exists
↓
Confirm seller
↓
Confirm entity
↓
Confirm unit where required
↓
Confirm contact
↓
Confirm eligibility
↓
Confirm ranking
↓
Confirm evidence
↓
Confirm contact confidence
↓
Confirm entity contact limits
↓
Confirm seller contact limits
↓
Confirm conversation limits
↓
Confirm source capability
↓
Confirm permission
↓
Execute
```

---

# §50 — Audit Log

Consequential actions record:

```text
timestamp
event_type

entity_id
listing_id
seller_id
channel

message
reason

eligibility
ranking_score
evidence_confidence
identity_confidence
unit_identity_confidence
contact_confidence

entity_status
unit_status

automation_policy

entity_contact_count
seller_contact_count

redundant_outreach_reason

result
```

---

# §51 — Export

Supported formats:

```text
JSON
CSV
```

Supported scopes:

```text
CURRENT_RESULTS
SELECTED_LISTINGS
SHORTLIST
MISSION
ARCHIVE
```

Exports should include relevant:

```text
listing data
source URL
source identifier
evidence
timestamps
seller/contact information where permitted
ranking
eligibility
status
```

Exports are generated locally by default.

---

# §52 — Security and Prompt Injection

Web content is untrusted.

Untrusted content includes:

```text
listing descriptions
comments
seller messages
images
documents
external pages
```

They cannot modify:

```text
system instructions
automation policy
permissions
provider configuration
research limits
Autopilot state
security settings
```

The LLM must produce structured agent actions rather than arbitrary extension code.

---

# §53 — Data Routing

The product may support local and cloud providers.

Potential sensitive information includes:

```text
phone numbers
WhatsApp
private messages
authenticated-page content
personal data
screenshots
seller information
```

The product should support a data-routing policy capable of distinguishing:

```text
PUBLIC_CONTENT
USER_AUTHENTICATED_CONTENT
PERSONAL_DATA
CONTACT_DATA
PRIVATE_CONVERSATION
CREDENTIAL_DATA
```

Potential routing policies:

```text
LOCAL_ONLY
CLOUD_ALLOWED
USER_CONFIRMATION_REQUIRED
```

The coding agent must reuse the existing provider architecture rather than creating a second provider framework.

---

# §54 — LLM Provider

The Listing Agent uses WebBrain's existing provider abstraction.

Supported target configurations:

```text
OpenAI-compatible
Anthropic-compatible
Local
Cloud
Company-hosted
```

Local examples:

```text
LM Studio
llama.cpp
Ollama
vLLM
```

Conceptual path:

```text
Chrome Extension
↓
Listing Agent
↓
Provider Layer
↓
localhost / cloud
```

No provider-specific Listing Agent logic should be embedded into the core.

---

# §55 — Browser Scope

### Primary

```text
Chrome / Chromium
```

### Secondary

```text
Firefox
```

The Listing Agent must remain browser-capability-oriented.

The product domain layer must not contain browser-specific logic.

WebBrain remains responsible for browser implementation.

---

# §56 — Source Architecture

The Listing Agent is source-agnostic.

Do not implement:

```text
if Facebook
if OLX
if Dubizzle
if Marketplace
```

inside core Listing Agent logic.

Use:

```text
browser capabilities
source configuration
Research Patterns
optional source hints
```

Existing WebBrain source adapters should be treated as extension points rather than the primary listing-extraction mechanism.

---

# §57 — Source Compatibility

A source may expose:

```text
research
scroll
pagination
listing_opening
media
contact_discovery
messaging
comments
follow_up
```

Each capability may be:

```text
SUPPORTED
PARTIAL
NOT_SUPPORTED
UNKNOWN
NOT_TESTED
```

The product must not assume a capability merely because a page can be displayed.

---

# §58 — Research Boundary

The user can start research from:

```text
current page
configured source
configured URL
```

Later:

```text
cross-source research
```

Research boundaries:

```text
allowed_domains
allowed_urls
maximum_research_depth
visited_urls
visited_sources
```

---

# §59 — Research Depth

Cross-source research must preserve:

```text
research_depth
parent_listing
parent_entity
discovery_reason
source
source_url
timestamp
```

No uncontrolled recursive research.

---

# §60 — Waiting for User

`WAITING_FOR_USER` includes a reason.

Reasons:

```text
TEACH_THIS_PAGE
AMBIGUOUS_ENTITY_REVIEW
ACTION_APPROVAL
BATCH_APPROVAL
PERMISSION_REQUIRED
AUTHENTICATION_REQUIRED
SOURCE_INTERVENTION_REQUIRED
USER_DECISION_REQUIRED
```

---

# §61 — Retry Policy

Canonical fields:

```text
retry_count
retry_reason
retry_delay
```

Only explicitly retryable failures may be retried.

Retry must:

- preserve policy
- preserve permissions
- remain bounded
- avoid duplicate consequential actions

---

# §62 — Failure Classification

```text
SOURCE_UNAVAILABLE
AUTHENTICATION_REQUIRED
PERMISSION_REQUIRED
PAGE_CHANGED
DETECTION_FAILED
EXTRACTION_FAILED
NAVIGATION_FAILED
PROVIDER_FAILED
STORAGE_FAILED
TIMEOUT
USER_CANCELLED
POLICY_BLOCKED
```

Each failure type must have an explicit retry classification.

---

# §63 — Existing WebBrain Capabilities to Reuse

The coding agent must inspect and reuse existing implementations for:

```text
agent loop
browser navigation
scroll
wait_for_stable
DOM interaction
accessibility tree
screenshots
structured extraction
provider layer
tool execution
side panel
conversation state
storage
teacher capture
source adapters
```

The agent must not rebuild these capabilities without a documented reason.

---

# §64 — Listing Agent Domain Layer

The new implementation should be conceptually organized around:

```text
mission
research
detection
extraction
intelligence
listings
sellers
conversations
outreach
patterns
dashboard
exports
```

The exact repository structure must follow existing WebBrain conventions after reconnaissance.

---

# §65 — MVP-1 Definition

The MVP-1 product slice is:

```text
Chrome
+
Current Page
+
Research Mission
+
User-Started Research
+
Automatic Listing Discovery
+
Generic Listing Detection
+
Structured Extraction
+
Mandatory Requirement Evaluation
+
Preferred Ranking
+
Evidence
+
Listing Deduplication
+
Persistent Research Results
+
Listing Workspace
+
JSON Export
+
CSV Export
+
One Validated Source
```

---

# §66 — MVP-1 Explicit Non-Goals

MVP-1 does not require:

```text
cross-source discovery
entity resolution
unit resolution
seller intelligence
price intelligence
conversation enrichment
contacting sellers
approval queue
Autopilot
multi-user
cloud sync
billing
MCP product integration
enterprise infrastructure
```

These may be designed for future phases but must not block MVP-1.

---

# §67 — MVP-1 User Flow

```text
Create Mission
↓
Open Search / Listing Page
↓
Click "Find Listings"
↓
Detect Listings
↓
Extract
↓
Evaluate Mandatory Requirements
↓
Rank
↓
Capture Evidence
↓
Persist
↓
Scroll
↓
Wait
↓
Detect New Listings
↓
Repeat
↓
Display Workspace
↓
Export
```

---

# §68 — MVP-1 Success Criteria

A user can:

1. Define an apartment-search mission.
2. Open a supported search/listing page in Chrome.
3. Start Listing Agent research.
4. Let the agent automatically scroll/research.
5. See newly discovered listings appear.
6. See structured attributes.
7. See mandatory eligibility.
8. See ranking.
9. See evidence/confidence.
10. Avoid duplicate listing records.
11. Open the original listing.
12. Export JSON.
13. Export CSV.
14. Stop/cancel the research job.

---

# §69 — MVP-1 Source Validation Gate

MVP-1 is not complete until:

```text
at least one source
```

moves from:

```text
NOT_TESTED
```

to a validated status through the Source Testing Protocol.

The source-validation sequence is:

```text
Source Register
↓
Source Testing Protocol
↓
Validated Source
↓
MVP-1 Acceptance
```

---

# §70 — MVP-1 Research Test

The first real-world validation should exercise:

```text
search results
dynamic loading
multiple listings
listing opening
structured extraction
automatic scrolling
duplicate detection
mandatory filtering
ranking
evidence
dashboard persistence
export
```

Where possible, test both:

```text
traditional search-result page
dynamic/infinite-scroll page
```

The second archetype improves technical confidence but does not necessarily need to be a second formal source for MVP acceptance.

---

# §71 — MVP-2

MVP-2 introduces:

```text
Cross-Source Discovery
Research Patterns
Entity Resolution
Unit Resolution
Seller Intelligence
Price Intelligence
Research History
Re-scanning
Listing Lifecycle Analytics
```

---

# §72 — MVP-3

MVP-3 introduces:

```text
Conversation Enrichment
Missing Information Engine
Contact Discovery
Contact Confidence
Assisted Contact
Batch Approval
Outreach Deduplication
Conversation Tracking
```

---

# §73 — MVP-4

MVP-4 introduces:

```text
Autopilot
Automated Follow-Up
Advanced Seller Intelligence
Response Analysis
Automated Listing Verification
Advanced Cross-Source Research
```

Autopilot remains explicitly disabled unless enabled by the user.

---

# §74 — Commercial Direction

Future premium versions may provide:

```text
Personal Pro
Power User
Team
Enterprise
```

Potential future capabilities:

- larger research limits
- cloud sync
- multiple missions
- advanced cross-source research
- shared workspaces
- collaboration
- SSO
- APIs
- private deployment
- organization policies
- managed providers

These are explicitly outside MVP scope.

---

# §75 — Long-Term Product Moat

Potential proprietary value accumulates through:

```text
Research Missions
Research Patterns
Listing History
Evidence
Entity Graph
Unit Graph
Seller Graph
Price History
Conversation History
Source Knowledge
User Preferences
```

The product becomes increasingly valuable as it learns:

- how listings are represented
- which sources are useful
- how listings duplicate
- how sellers behave
- how prices change
- which information matters
- which questions resolve uncertainty

---

# §76 — Coding-Agent Scope Rule

The coding agent must interpret this specification as:

> **Build the Listing Agent domain layer on top of WebBrain.**

It must not interpret the document as:

> Rebuild WebBrain.

Before modifying an existing capability:

```text
Search repository
↓
Find existing implementation
↓
Understand API
↓
Reuse
↓
Extend only where necessary
```

---

# §77 — Coding-Agent Rules

The coding agent must:

1. Inspect before coding.
2. Reuse existing WebBrain functionality.
3. Keep Listing Agent logic source-agnostic.
4. Keep browser-specific logic inside browser capability layers.
5. Never silently enable Autopilot.
6. Never silently merge uncertain entities.
7. Never treat seller identity as property identity.
8. Never treat unit identity as proven without sufficient evidence.
9. Never bypass evidence or confidence gates.
10. Never bypass permissions.
11. Never retry non-retryable failures.
12. Bound every loop.
13. Persist long-running research state.
14. Treat web content as untrusted.
15. Never execute arbitrary LLM-generated extension code.
16. Use Context7 for current dependency documentation.
17. Use the Universal Toolbelt.
18. Keep MVP scope narrow.
19. Test every meaningful change.
20. Maintain a clean baseline before implementation.
21. Do not introduce future commercial infrastructure into MVP.
22. Document assumptions.

---

# §78 — Mandatory Architecture Questions

## Q1 — Generic Listing Detection

How will the system determine that a page contains listings?

## Q2 — Listing Boundaries

How will it determine where one listing starts and ends?

## Q3 — Teach This Page

How does user correction become a reusable Research Pattern?

## Q4 — Entity Resolution

How are duplicate properties distinguished from merely similar properties?

## Q5 — Near-Identical Units

How are multiple structurally identical units handled?

## Q6 — Evidence Aggregation

How are attribute-level confidence values aggregated?

## Q7 — Research Loop

How are progress and termination determined?

## Q8 — Research Session

Does Mission → Session → Job materially improve the data model?

## Q9 — Seller Identity

How is seller identity kept independent from property identity?

## Q10 — Conversation Limits

How are question/follow-up/contact counters persisted?

## Q11 — Contact Confidence

How is extracted contact information verified?

## Q12 — Outreach Deduplication

How are entity/seller/channel contacts deduplicated?

## Q13 — Durable Research Jobs

How does a long-running ResearchJob survive service-worker suspension, extension restart, browser restart, or crash?

## Q14 — Permission Model

What is the least-privileged permission model for current-page research and future cross-source research?

## Q15 — Detection Regression

How will generic listing detection be replay-tested against previously solved page structures without relying on live websites?

---

# §79 — Architecture Review Gates

Before implementing a subsystem:

```text
Existing WebBrain capability understood?
Data model understood?
Security boundary understood?
Loop bounded?
Persistence defined?
Failure behavior defined?
Testing strategy defined?
```

If a critical answer is unknown:

> Do not implement the affected subsystem.

---

# §80 — Research Loop Invariants

Every Listing Agent research loop must:

1. Have a maximum runtime.
2. Have maximum work limits.
3. Detect progress.
4. Have explicit termination.
5. Support cancellation.
6. Persist state.
7. Avoid duplicate work.
8. Prevent recursion.
9. Respect research boundaries.
10. Handle source failure.

---

# §81 — Listing Detection Invariants

Every detection cycle must:

1. Identify whether listings exist.
2. Identify listing boundaries.
3. Produce confidence.
4. Avoid duplicate listing creation.
5. Preserve evidence.
6. Fail visibly when uncertain.
7. Support Teach This Page.
8. Avoid unbounded LLM calls.
9. Cache reusable page understanding.
10. Remain source-agnostic.

---

# §82 — Intelligence Invariants

The Listing Agent must preserve:

```text
Eligibility
Ranking
Evidence
Entity Identity
Unit Identity
Seller Identity
Contact Confidence
```

as separate dimensions.

No generic composite score may silently replace them.

---

# §83 — Security Invariants

The Listing Agent must:

```text
treat page content as untrusted
protect provider credentials
protect contact information
respect permissions
prevent prompt injection
prevent arbitrary code execution
prevent Autopilot self-enablement
enforce contact limits
protect exports
```

---

# §84 — Testing Strategy

## Unit Tests

Test:

```text
mission parsing
requirement evaluation
ranking
evidence
listing normalization
deduplication
lifecycle
progress detection
termination
retry
policy
```

## Integration Tests

Test:

```text
mission
research job
listing detection
extraction
persistence
dashboard
exports
```

## Browser Tests

Test:

```text
Chrome
current page
dynamic content
infinite scroll
listing extraction
Side Panel
research cancellation
research recovery
```

## Security Tests

Test:

```text
prompt injection
policy bypass
Autopilot bypass
permission bypass
arbitrary code execution
contact-confidence bypass
counter bypass
retry bypass
```

---

# §85 — Test Fixture Library

Generic Listing Detection must have replayable fixtures.

Example:

```text
fixtures/listings/
├── static-grid/
├── search-results/
├── infinite-scroll/
├── nested-cards/
├── lazy-loaded/
├── mixed-content/
└── detection-failure/
```

Each fixture should define expected:

```text
listing boundaries
listing count
key fields
evidence
confidence
```

The fixture system should become the primary regression mechanism for the generic detector.

---

# §86 — Source Testing Protocol

For the selected MVP source:

```text
Open source
↓
Authenticate manually if required
↓
Perform search
↓
Start Listing Agent
↓
Detect listings
↓
Extract
↓
Scroll
↓
Wait
↓
Detect additional listings
↓
Persist
↓
Filter
↓
Rank
↓
Display
↓
Export
```

The source moves from:

```text
NOT_TESTED
```

to a validated state only when sufficient evidence exists.

---

# Appendix A — Canonical Data Model

## A.1 ResearchMission

```text
id
name
description
objective
category

mandatory_requirements
preferred_requirements
exclusions
special_context

research_boundaries
source_configuration
ranking_policy
evidence_policy
contact_policy
automation_policy
provider_profile

created_at
updated_at
status
```

## A.2 ResearchJob

```text
id
mission_id
session_id

status
waiting_for_user_reason

source
current_url

research_depth
max_research_depth

visited_urls
visited_sources
visited_entities
visited_search_queries

started_at
paused_at
completed_at

runtime
pages
scrolls

items_seen
listings_found
qualified_count
duplicate_count

new_unique_listings
new_unique_content
content_fingerprint
duplicate_ratio
consecutive_no_progress_cycles

retry_count
retry_reason
retry_delay

current_phase
last_checkpoint

errors
```

## A.3 ResearchSession

```text
id
mission_id
name
status

jobs
active_job_id

created_at
updated_at
last_activity
```

## A.4 Listing

```text
id
entity_id
source_id
source_url
source_listing_id

title
description

price
currency
attributes

seller_id
media
evidence

eligibility
ranking_score
evidence_confidence

lifecycle_status

discovered_at
last_seen_at
updated_at
```

## A.5 Entity

```text
id
entity_type
canonical_title
attributes

identity_confidence
entity_status

unit_identity_confidence
unit_status

created_at
updated_at
```

## A.6 Unit

A dedicated Unit object is a future architectural option and should be evaluated during reconnaissance.

Potential model:

```text
id
entity_id
unit_identifier
attributes
unit_identity_confidence
unit_status
evidence
```

Do not implement this merely for completeness during MVP-1.

## A.7 Seller

```text
id
name
phone
whatsapp
profiles
seller_type
listing_count
response_history
```

## A.8 ContactChannel

```text
id
seller_id
channel
value

contact_evidence
contact_confidence
contact_source
contact_verification_status
```

## A.9 AutomationPolicy

```text
id
mode

minimum_ranking_score
minimum_listing_evidence_confidence
minimum_contact_confidence

minimum_entity_identity_confidence
minimum_unit_identity_confidence

maximum_initial_contacts
maximum_contacts_per_entity
maximum_contacts_per_seller
maximum_followups

maximum_questions_per_conversation
maximum_followup_rounds
maximum_contact_actions

followup_interval

allowed_channels
allowed_seller_types

allow_redundant_entity_outreach

negotiation_enabled
```

## A.10 Conversation

```text
id
entity_id
listing_id
seller_id
channel

messages
questions
answers
verified_information

question_count
followup_round_count
contact_action_count

status
last_activity
```

## A.11 ResearchPattern

```text
id
source_scope
page_signature

listing_selector
listing_boundary

field_mappings
pagination_strategy
scroll_strategy

confidence

created_by
created_at
last_validated
validation_count

status
```

## A.12 AutopilotAction

```text
id
research_job_id
entity_id
listing_id
seller_id

action_type
channel
message

policy_snapshot

ranking_score
evidence_confidence
identity_confidence
unit_identity_confidence
contact_confidence

entity_status
unit_status

entity_contact_count
seller_contact_count

redundant_outreach_reason

created_at
executed_at
result
```

## A.13 AuditEvent

```text
id
timestamp
event_type

entity_id
listing_id
seller_id
channel

message
reason

eligibility
ranking_score
evidence_confidence
identity_confidence
unit_identity_confidence
contact_confidence

entity_status
unit_status

automation_policy

entity_contact_count
seller_contact_count

redundant_outreach_reason

result
```

## A.14 ExportJob

```text
id
research_job_id
mission_id

scope
format

created_at
completed_at

status
file_reference
record_count
error
```

## A.15 DataRoutingPolicy

```text
id

public_content_policy
authenticated_content_policy
personal_data_policy
contact_data_policy
private_conversation_policy
screenshot_policy

default_provider_mode
user_confirmation_required
```

---

# Appendix B — Listing Detection Architecture

```text
Page
↓
Page Understanding
↓
Collection Detection
↓
Candidate Detection
↓
Boundary Detection
↓
Field Mapping
↓
Extraction
↓
Evidence
↓
Confidence
↓
Listing Object
```

Escalation:

```text
DOM / JSON-LD
↓
Structural Analysis
↓
LLM
↓
Vision
↓
Teach This Page
```

---

# Appendix C — Research Controller

```text
START
↓
LOAD JOB
↓
CAPTURE PAGE
↓
DETECT LISTINGS
↓
EXTRACT
↓
NORMALIZE
↓
DEDUPLICATE
↓
EVALUATE
↓
RANK
↓
PERSIST
↓
PROGRESS CHECK
├── Complete → END
├── No Progress → END / WAIT
├── Limit → END
└── New Content → SCROLL
                    ↓
                  WAIT
                    ↓
                 REPEAT
```

---

# Appendix D — Autopilot Decision Matrix

```text
Eligibility:
PASS

Ranking:
>= minimum_ranking_score

Evidence:
>= minimum_listing_evidence_confidence

Contact:
>= minimum_contact_confidence

Entity:
required threshold passed

Unit:
NOT_APPLICABLE
OR
CONFIRMED_SAME + threshold passed

Entity contact:
within limit

Seller contact:
within limit

Conversation:
within limits

Channel:
enabled

Permission:
granted

Automation:
AUTOPILOT

Final validation:
PASS
```

---

# Appendix E — Outreach Deduplication

```text
Research Results
↓
Resolve Entity
↓
Group ONLY CONFIRMED_SAME
↓
Keep POSSIBLE_SAME / UNKNOWN separate
↓
Filter
↓
Rank
↓
Select best listing per entity
↓
Check seller
↓
Check contact
↓
Check policy
↓
Final validation
↓
Contact
```

---

# Appendix F — Teach This Page

```text
Detection Failure
↓
User selects representative listing
↓
Capture structure
↓
Infer boundaries
↓
Infer field mappings
↓
Validate on another listing
↓
Create ResearchPattern
↓
Persist
↓
Reuse
```

Research Patterns must remain configuration rather than arbitrary executable code.

---

# Appendix G — Source Compatibility Register

Each source contains:

```text
source
URL
authentication

research
scroll
pagination
listing_opening
media

contact_discovery
messaging
comments
follow_up
autopilot

permissions
policy
account_risk
technical_reliability

research_status
outreach_status

evidence
last_validated
```

---

# Appendix H — Canonical Research Limits

```text
maximum_continuous_runtime
maximum_scrolls
maximum_pages
maximum_listing_opens
maximum_actions_per_minute
minimum_action_delay
no_new_content_threshold
failure_cooldown
stop_on_unusual_source_behavior
maximum_research_depth
```

These are engineering controls, not anti-detection controls.

Initial values must be validated empirically.

---

# Appendix I — Security Checklist

```text
[ ] Existing WebBrain security mechanisms reused
[ ] No hardcoded secrets
[ ] Provider credentials protected
[ ] Page content treated as untrusted
[ ] Prompt injection tested
[ ] No arbitrary LLM-generated extension code
[ ] Permission boundaries tested
[ ] Research permission separated from contact permission
[ ] Autopilot cannot self-enable
[ ] Contact limits enforced
[ ] Conversation limits enforced
[ ] Entity deduplication enforced
[ ] Only CONFIRMED_SAME grouped for outreach
[ ] Unit gates enforced
[ ] Contact confidence enforced
[ ] Redundant outreach reason recorded
[ ] Export security reviewed
[ ] Sensitive logging minimized
[ ] Retry limits enforced
[ ] Retry cannot bypass policy
```

---

# Appendix J — MVP-1 Acceptance Test

## Mission

```text
Find apartments for rent in New Cairo.
```

## Mandatory

```text
2+ bedrooms
≤ 35,000 EGP
New Cairo
```

## Preferred

```text
Ground floor
Garden
Compound
Parking
Open view
```

## Test Flow

```text
Open supported source in Chrome
↓
Create mission
↓
Start Find Listings
↓
Detect listings
↓
Extract
↓
Evaluate
↓
Rank
↓
Persist
↓
Scroll
↓
Detect additional listings
↓
Display workspace
↓
Export JSON
↓
Export CSV
```

Acceptance requires:

```text
at least one source validated through Appendix F / §86
```

---

# Appendix K — Listing Workspace Requirements

The workspace must provide:

```text
Mission
Research status
Listing count
Filters
Sort
Search
Listing cards
Images
Evidence
Ranking
Eligibility
Source URL
Shortlist
Reject
Open
Research Further
Export
```

Later:

```text
Conversation
Entity
Unit
Seller
Price History
Cross-Source Matches
```

---

# Appendix L — Coding-Agent Reconnaissance Deliverables

The coding agent must produce:

```text
[ ] Repository capability map
[ ] Listing Agent capability gap map
[ ] Existing capability reuse map
[ ] Domain data-model proposal
[ ] Generic listing detection proposal
[ ] Listing-boundary proposal
[ ] Teach This Page proposal
[ ] Research Pattern proposal
[ ] Research Controller proposal
[ ] Durable ResearchJob proposal
[ ] Research Session evaluation
[ ] Evidence aggregation proposal
[ ] Deduplication proposal
[ ] Entity resolution proposal
[ ] Unit resolution proposal
[ ] Seller model proposal
[ ] Conversation model proposal
[ ] Permission/data-routing proposal
[ ] Risk Register
[ ] Source Compatibility Register
[ ] Source Testing result
[ ] Test fixture strategy
[ ] MVP-1 implementation proposal
```

---

# Appendix M — Definition of Done

A Listing Agent feature is complete only when:

```text
Implementation
+
Tests
+
Persistence where required
+
Error handling
+
Security validation
+
Documentation
+
Regression coverage
+
Git checkpoint
```

---

# Appendix N — Explicit Future Scope

Do not implement during MVP-1:

```text
Entity graph
Unit graph
Seller graph
Cross-source search
Automated seller conversations
Autopilot
Cloud sync
Billing
Teams
Enterprise
Distributed workers
```

They remain in the architecture for future evolution.

---

# Appendix O — Listing Agent North Star

```text
Research Mission
↓
Listing Discovery
↓
Structured Listing
↓
Evidence
↓
Eligibility
↓
Ranking
↓
Research History
↓
Cross-Source Discovery
↓
Entity
↓
Unit
↓
Seller
↓
Verification
↓
Conversation
↓
Decision
```

---

# Appendix P — Version 7 Change Log

## P.1 Scope Reframing

v7 explicitly separates:

```text
WebBrain Foundation
```

from:

```text
AI Listing Agent Product Capabilities
```

The Listing Agent extends WebBrain instead of rebuilding its browser-agent infrastructure.

## P.2 Chrome Primary

Primary browser changed to:

```text
Chrome / Chromium
```

Firefox becomes secondary.

## P.3 MVP Scope Refocused

MVP-1 is now centered on:

```text
Mission
+
Listing Detection
+
Extraction
+
Evidence
+
Eligibility
+
Ranking
+
Research Loop
+
Persistence
+
Workspace
+
Export
```

rather than browser infrastructure.

## P.4 Generic Listing Detection Elevated

Listing detection and listing-boundary detection are now explicit first-class capabilities.

## P.5 Teach This Page Formalized

Teach This Page creates reusable Research Patterns rather than executable LLM-generated code.

## P.6 Research Controller Added

The Listing Agent owns listing-aware research orchestration while WebBrain owns browser actions.

## P.7 Research Session Added

Mission → Session → Job is now the preferred conceptual hierarchy, subject to reconnaissance validation.

## P.8 Detection Fixtures Added

Generic detection requires replayable fixtures and regression tests.

## P.9 Research Domain Data Model Expanded

Added explicit:

```text
ResearchSession
ResearchPattern
DataRoutingPolicy
```

and future evaluation of a dedicated:

```text
Unit
```

object.

## P.10 Cloud/Local Data Routing Added

The Listing Agent explicitly considers what research data may be sent to cloud providers.

## P.11 Research vs Contact Permission Separation

Research permission does not grant communication permission.

## P.12 MVP-1 Source Gate Preserved

MVP-1 remains incomplete until at least one source passes the Source Testing Protocol.

---

# Appendix Q — Final Coding-Agent Handoff

## Q.1 What the Coding Agent Is Building

The coding agent is building:

> **An AI Listing Research Agent domain layer on top of WebBrain.**

It is not building:

> A new browser automation framework.

---

## Q.2 What the Coding Agent Should Reuse

Reuse WebBrain's:

```text
agent loop
browser tools
scroll
navigation
waiting
DOM interaction
accessibility tree
screenshots
basic extraction
provider abstraction
side panel
storage primitives
teaching capture
source adapters
```

---

## Q.3 What the Coding Agent Must Build

The new Listing Agent capabilities are:

```text
1. Research Mission
2. Requirement Model
3. Listing Detector
4. Listing Boundary Detector
5. Research Controller
6. Listing Normalizer
7. Evidence Builder
8. Requirement Evaluator
9. Ranking Engine
10. Listing Deduplication
11. Listing Persistence
12. Research Progress
13. Research Termination
14. Listing Workspace
15. JSON/CSV Export
16. Research Pattern system
17. Later: Entity/Unit/Seller/Conversation/Outreach/Autopilot
```

---

## Q.4 MVP-1 Implementation Boundary

The first implementation must stop at:

```text
Chrome
↓
Current Page
↓
Mission
↓
Listing Detection
↓
Extraction
↓
Evidence
↓
Eligibility
↓
Ranking
↓
Deduplication
↓
Persistence
↓
Automatic Research Loop
↓
Workspace
↓
JSON/CSV
```

Do not implement:

```text
Cross-source
Entity graph
Unit graph
Seller messaging
Autopilot
```

unless the implementation plan identifies a genuinely unavoidable dependency.

---

## Q.5 First Coding-Agent Task

The coding agent must first produce a **Listing Agent Capability Gap & Implementation Plan**.

It must map:

```text
Existing WebBrain capability
        ↓
Required Listing Agent capability
        ↓
Reuse / Extend / New
        ↓
Files/modules affected
        ↓
Tests required
        ↓
Risks
```

Example:

```text
Existing:
scroll tool

Listing Agent need:
continuous listing research

Decision:
REUSE + EXTEND

New:
ResearchController
ProgressDetector
TerminationPolicy
```

---

## Q.6 Required Implementation Sequence

```text
1. Establish clean repository test baseline
2. Map existing WebBrain capabilities
3. Define Listing Agent domain interfaces
4. Implement Research Mission
5. Implement Listing Detection
6. Implement Listing Extraction normalization
7. Implement Evidence
8. Implement Requirement Evaluation
9. Implement Ranking
10. Implement Deduplication
11. Implement Research Controller
12. Implement Persistence
13. Implement Listing Workspace
14. Implement JSON/CSV Export
15. Run real Chrome source test
16. Run MVP-1 acceptance test
```

No later-phase subsystem should block the first vertical slice unless it is proven to be a dependency.

---

## Q.7 Final Architecture

```text
                         USER
                           │
                           ▼
                  ┌─────────────────┐
                  │ Research Mission│
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Research Session│
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Research Job   │
                  │  Durable State  │
                  └────────┬────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │    LISTING AGENT CORE    │
              └────────────┬─────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
      Detection        Research        Intelligence
          │             Controller           │
          │                │                 │
          ▼                ▼                 ▼
      Extraction      Progress          Eligibility
          │            / Limits            Ranking
          ▼                               Evidence
       Listing                              Dedup
          │
          ▼
     Persistence
          │
          ▼
   Listing Workspace
          │
          ├───────────────┐
          ▼               ▼
       Export       Research Further
                          │
                          ▼
                  ┌─────────────────┐
                  │ Future Layers   │
                  │ Entity / Unit   │
                  │ Seller          │
                  │ Cross-Source    │
                  │ Conversation    │
                  │ Outreach        │
                  │ Autopilot       │
                  └─────────────────┘

              ┌───────────────────────┐
              │      WEBBRAIN         │
              │                       │
              │ Browser interaction   │
              │ Agent infrastructure  │
              │ Providers             │
              │ Extraction primitives │
              │ Storage primitives    │
              │ Side panel            │
              │ Teaching capture      │
              └───────────────────────┘
```

---

# Appendix R — Final North Star

> **Open a page, tell the agent what you're looking for, and let it do the repetitive listing research for you.**

The user should eventually be able to say:

> "Find me a 2-bedroom apartment in New Cairo under 30,000 EGP with parking and an open view."

and receive:

```text
47 listings discovered
31 eligible
12 high-confidence
7 shortlisted
3 found on multiple sources
2 with price changes
4 missing critical information
```

The user can then say:

> "Research the top five further."

and later:

> "Find this apartment elsewhere."

and eventually:

> "Ask the seller whether maintenance and parking are included."

and, if explicitly enabled:

> "Contact the best seller automatically."

The system should progressively move from:

```text
Discovery
```

to:

```text
Understanding
```

to:

```text
Verification
```

to:

```text
Decision Support
```

to:

```text
Controlled Action
```

without sacrificing:

```text
Evidence
Uncertainty
Provenance
Permissions
User Control
Loop Safety
```

**v7.0 is the master handoff specification for the AI Listing Agent.**

**The coding agent should extend WebBrain—not rebuild it—and should begin with the Listing Agent Capability Gap & Implementation Plan before writing implementation code.**