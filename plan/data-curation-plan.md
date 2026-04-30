# AlphaLens Data Curation Plan

## What This System Is Trying To Do

AlphaLens should stay narrow in taxonomy and broad in coverage.

That means:

- keep the number of event types limited
- absorb more real-world headline wording through reviewed keyword and polarity updates
- learn the market response parameters only from a smaller, higher-trust gold set

The core idea is:

- `silver` improves coverage, routing, polarity handling, and taxonomy discipline
- `gold` improves the actual response model

This keeps the system extensible after the deadline without forcing us to create a large amount of low-quality training data too early.

## Current Implemented Dataset Organization

The prototype now uses one master curated table and derives smaller task-specific datasets from it.

### Source of Truth

- [events_master.csv](/Users/janicechen/MIT%20Dropbox/Yu-Chen%20Chen/TradingProject/prototype/data/events_master.csv)

This master table stores:

- provenance: headline, date, source, URL
- review state: raw, reviewed, gold-candidate, gold-approved, rejected
- tier: gold or silver
- coverage diagnosis: missing words, polarity bug, out of scope, or possible future taxonomy gap
- routing fields: final event type, theme, channels hint, polarity expectation
- response fields: per-asset amplitude / lag / decay
- future extension fields: measured `d0-d3` horizons, timestamp quality, contamination, benchmark notes, human notes

### Derived Datasets

- [events_gold.csv](/Users/janicechen/MIT%20Dropbox/Yu-Chen%20Chen/TradingProject/prototype/data/events_gold.csv)
  - rows where `tier=gold` and `review_status=gold_approved`
- [events_silver.csv](/Users/janicechen/MIT%20Dropbox/Yu-Chen%20Chen/TradingProject/prototype/data/events_silver.csv)
  - all non-rejected rows
- [coverage_eval.csv](/Users/janicechen/MIT%20Dropbox/Yu-Chen%20Chen/TradingProject/prototype/data/coverage_eval.csv)
  - recent-news checks used to test routing, coverage, and polarity behavior

### Validation / Export Script

- [prepare_curation_data.mjs](/Users/janicechen/MIT%20Dropbox/Yu-Chen%20Chen/TradingProject/prototype/scripts/prepare_curation_data.mjs)

This script:

- validates the master table
- regenerates gold and silver exports
- seeds starter silver and coverage-eval examples if needed
- enforces that gold-approved rows have complete amplitude / lag / decay labels

## How Human-In-The-Loop Labeling Should Work

The intended human workflow is:

1. Collect candidate headlines into `events_master.csv` as `tier=silver`, usually `review_status=raw`.
2. Review each headline and decide:
   - does it map to an existing event type?
   - is it just a wording gap?
   - is it a polarity bug?
   - is it out of scope?
   - is it a repeated cluster that might later justify a new taxonomy branch?
3. Fill the routing fields:
   - `coverage_bucket`
   - `final_event_type` if applicable
   - `polarity_expected`
   - `routing_notes`
   - optional `keyword_additions_suggested`
4. Promote only strong, explainable examples to gold.
5. For gold rows, a human fills the response labels:
   - `observed_*_amplitude_z`
   - `observed_*_lag_days`
   - `observed_*_decay`
6. If a human cannot explain the cross-ETF reaction path in one short paragraph, the row should stay silver.
7. If the event is contaminated by unrelated overlapping shocks, keep it silver or mark contamination and exclude it from training.

### Gold Promotion Standard

A row should become gold only if:

- it clearly maps to one current event type
- it has a human-defensible cross-ETF transmission story
- the per-asset response labels are reviewable by hand
- it is not mainly a company-specific product or execution headline unless it clearly implies the current infrastructure / policy / power / energy transmission path

## How The Model Uses Gold vs Silver

### Silver

Silver does **not** train the response parameters directly.

Silver is used for:

- keyword and phrase expansion for existing event types
- polarity bug fixes
- coverage evaluation
- identifying repeated clusters that might become future taxonomy candidates

Important design rule:

- silver hints should usually be phrase-based, not just company-name based

That avoids accidental routing drift, such as one company name triggering an event type in contexts where it should not.

### Gold

Gold is the only dataset used to learn response parameters.

The app currently trains only on rows where:

- `tier=gold`
- `review_status=gold_approved`
- `contamination_flag` is not truthy

## Response Learning Logic

### Empirical Mode

For each `final_event_type` and each asset:

- `amplitude_z = mean(observed_amplitude_z)`
- `lag_days = mean(observed_lag_days)`
- `decay = mean(observed_decay)`
- `uncertainty_z = std(observed_amplitude_z)`, clipped to the current bounds

If a class is too small, the system falls back to the catalog template rather than pretending the estimate is stable.

### Lead-Lag Mode (Current v1)

For each gold-approved event:

- convert each asset’s `(amplitude_z, lag_days, decay)` into a response path over the current time grid
- bucket those responses by event type and asset
- learn:
  - `responses[h] = mean(path[h])`
  - `uncertainty[h] = std(path[h])`, clipped to bounds

### Lead-Lag Mode (v2-Ready Path)

If a gold row later has measured horizon fields such as:

- `observed_soxx_d0 ... observed_soxx_d3`
- and same for `QQQ`, `XLU`, `XLE`

then the system should prefer those measured horizons instead of reconstructing a path from amplitude / lag / decay.

That is already how the code is organized conceptually now: measured horizons can override the synthetic path if present.

## Short-Term Plan Before Deadline

The best pre-deadline target is not “1000 events.” It is a smaller, cleaner data push.

Recommended focus:

1. Build out the recent-news coverage eval set to roughly `50-100` headlines.
2. Expand reviewed silver misses from real recent news.
3. Improve the thinnest gold classes first:
   - `geopolitical_energy`
   - `policy_ai_infra`
4. Grow gold from the current `50` rows to roughly `80-120` if time allows.
5. Do one manual audit pass on `10-20` gold rows.

Near-term philosophy:

- fix coverage and polarity first
- grow gold carefully
- do not explode taxonomy before the deadline

## Long-Term Plan After Deadline

After the deadline, the system can scale in two different ways:

### Coverage Scale

- expand silver toward `500-1000` reviewed or weakly reviewed headlines
- use it for:
  - coverage measurement
  - alias mining
  - polarity edge cases
  - taxonomy clustering

### Response-Quality Scale

- expand gold toward `150-250` high-trust events
- move from approximate amplitude / lag / decay labels toward measured event-window horizons
- improve timestamp quality, contamination tracking, and benchmark adjustment

This is the path that supports a future stronger lead-lag model without rewriting the system again.

## Current State Check

Yes, the response-parameter pipeline **was updated** to use the new curated structure.

Specifically:

- the app now loads [events_master.csv](/Users/janicechen/MIT%20Dropbox/Yu-Chen%20Chen/TradingProject/prototype/data/events_master.csv)
- empirical and lead-lag parameters are trained only from gold-approved rows
- reviewed silver rows influence classifier coverage and polarity logic, not the response parameter fitting

### Important Nuance

The current **numeric** response parameters are effectively still close to the old ones right now because:

- the current gold set is the legacy `50` seeded rows migrated into the new master table
- the new silver starter rows are reviewed coverage examples, but they are **not** yet gold-approved training rows

So:

- **the training path changed**
- **the architecture changed**
- **the data workflow changed**
- but the underlying gold training population is still mostly the same today

That is expected and correct. As more gold-approved rows are added, the learned templates and lead-lag profiles will update automatically.

## Current Gold Balance

At the moment the gold set is still imbalanced:

- `policy_semiconductor`: `13`
- `ai_demand`: `11`
- `power_bottleneck`: `14`
- `geopolitical_energy`: `5`
- `policy_ai_infra`: `7`

So the best immediate gold-labeling targets are:

1. `geopolitical_energy`
2. `policy_ai_infra`

## Bottom Line

The system is now organized so that:

- humans can audit the master curation record directly
- silver can broaden coverage without polluting the response model
- gold can stay small but high-trust
- measured horizon returns can be added later without changing the overall data design

That is the right setup if the goal is to keep the taxonomy narrow, keep the data reviewable, and make the model better mainly by improving the quality of the gold set.
