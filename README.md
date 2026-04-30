# AlphaLens Market Reaction Simulator

**Post-COVID Alpha Signals from AI Infrastructure, Power Constraints, and Policy Shocks.**

AlphaLens turns market-moving news into a structured cross-sector ETF reaction simulation. The prototype blends event classification, transmission channels, and timing-aware response paths to show how a headline may propagate across `SOXX`, `QQQ`, `XLU`, and `XLE`. It is designed to make the market story inspectable: what the event is, which channels matter, who moves first, and why.

Highlights:

- turns market-moving news into a structured cross-sector ETF reaction simulation
- uses timing-aware response paths rather than direction-only scenarios
- keeps a human-auditable curation table for training the response model
- makes the output explainable instead of opaque

## Current Scope

- 5 supported event types in the current taxonomy
- 4 tracked ETFs: `SOXX`, `QQQ`, `XLU`, `XLE`
- 2 prediction modes:
  - `Empirical Templates`
  - `Lead-Lag`
- weighted multi-channel event classification
- runtime keyword and polarity improvements from reviewed silver examples
- response learning from gold-approved events only
- interactive explainable UI with:
  - event understanding
  - reaction trajectory
  - lead/lag interpretation
  - analog-based context
- About page narrative explaining method, data workflow, and limitations

## Project Layout

This prototype is a static browser app with local curated data and no backend dependency.

- `index.html` — app shell, top-banner navigation, and About-page narrative structure
- `styles.css` — visual system, page layouts, chart styling, and scene-level motion
- `app.js` — event classification, scenario building, chart rendering, demo flow, and local data loading
- `assets/logo.jpg` — AlphaLens brand mark
- `data/event_catalog.json` — supported event taxonomy, keywords, and fallback templates
- `data/events_master.csv` — master human-auditable curation table
- `data/events_gold.csv` — derived gold-approved training subset
- `data/events_silver.csv` — derived reviewed coverage and routing subset
- `data/coverage_eval.csv` — recent-news evaluation examples for routing and polarity checks
- `data/events_seed.csv` — legacy seed snapshot preserved for provenance
- `scripts/prepare_curation_data.mjs` — validates the master table and regenerates derived datasets
- `plan/data-curation-plan.md` — human-in-the-loop curation strategy
- `plan/data-curation-plan.pdf` — exported PDF copy of the curation plan

## Data Curation

AlphaLens uses a tiered curation workflow so coverage can expand without polluting the response model.

- `Master` is the source of truth: provenance, review state, routing notes, polarity expectations, and response labels all live in `events_master.csv`.
- `Gold` is the high-trust reviewed subset used to learn empirical templates and lead-lag response paths.
- `Silver` improves event classification coverage, keyword breadth, and polarity handling, but does not directly train response parameters.
- `Coverage Eval` is a recent-news check set used to test whether in-scope headlines route correctly and whether polarity logic behaves as expected.

This structure keeps the taxonomy narrow, the labels auditable, and the system extensible for future measured event-window calibration.

## Prototype Limitations

- no live market data or intraday feed
- no backend or external API integration
- no LLM-assisted classification in the current release
- most current gold labels still rely on approximate amplitude / lag / decay annotations rather than fully measured event-window returns
- silver coverage is a starter review set, not yet a broad production-scale recent-news corpus
- outputs are scenario estimates for exploration and interpretation, not investment advice
- the current release is a static browser app with local curated data and no backend dependency
