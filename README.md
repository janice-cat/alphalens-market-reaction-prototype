# AlphaLens Prototype

This folder contains the current build of the AlphaLens MVP prototype.

## Files

- `index.html` - app shell
- `styles.css` - visual design
- `app.js` - classifier, chart, explanation, history, and local data loading
- `data/event_catalog.json` - event taxonomy, keywords, and calibrated templates
- `data/events_master.csv` - source-of-truth curated event table with gold/silver tiering and review fields
- `data/events_gold.csv` - derived gold-approved training subset used for calibration audits
- `data/events_silver.csv` - derived non-rejected curation pool used for coverage and taxonomy discipline
- `data/coverage_eval.csv` - starter recent-news coverage checks for routing and polarity review
- `scripts/prepare_curation_data.mjs` - validates the master table and regenerates gold/silver exports
- `data/events_seed.csv` - legacy seed snapshot preserved for provenance during the migration

## Run locally

You can open `index.html` directly in a browser, or serve the `prototype/` folder locally:

```bash
cd "/Users/janicechen/MIT Dropbox/Yu-Chen Chen/TradingProject/prototype"
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Refresh curated data

Regenerate the derived gold/silver files after editing `data/events_master.csv`:

```bash
cd "/Users/janicechen/MIT Dropbox/Yu-Chen Chen/TradingProject/prototype"
node scripts/prepare_curation_data.mjs
```

## Folder layout

- `index.html`, `styles.css`, `app.js` - main prototype app entrypoints
- `data/` - taxonomy plus curated master/gold/silver datasets
- `scripts/` - local maintenance scripts for curation data preparation

## Current scope

- 5 supported event types
- 4 tracked ETFs: `SOXX`, `QQQ`, `XLU`, `XLE`
- local event taxonomy with curated gold/silver data workflow
- human-auditable master curation table plus derived training views
- per-event provenance, routing, coverage, and review metadata
- weighted multi-channel event classification with runtime keyword augmentation from reviewed silver examples
- learned `amplitude_z`, `lag_days`, `decay`, and `uncertainty_z` templates aggregated only from gold-approved observations
- lead-lag calibration that prefers measured horizon fields when present and otherwise falls back to amplitude/lag/decay-derived paths
- SVG chart rendering
- local browser history via `localStorage`

## Prototype limitations

- no live market data
- no backend
- no LLM classification
- no API integration yet
- most gold observations still use approximate amplitude/lag/decay labels rather than measured ETF windows
- silver coverage examples are currently a starter set, not yet a full recent-news evaluation corpus
