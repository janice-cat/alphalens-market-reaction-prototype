# AlphaLens Prototype

This folder contains the current build of the AlphaLens MVP prototype.

## Files

- `index.html` - app shell
- `styles.css` - visual design
- `app.js` - classifier, chart, explanation, history, and local data loading
- `data/event_catalog.json` - event taxonomy, keywords, and calibrated templates
- `data/events_seed.csv` - seeded historical event dataset

## Run locally

You can open `index.html` directly in a browser, or serve the `prototype/` folder locally:

```bash
cd "/Users/janicechen/MIT Dropbox/Yu-Chen Chen/TradingProject/prototype"
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Folder layout

- `index.html`, `styles.css`, `app.js` - main prototype app entrypoints
- `data/` - event taxonomy and seed dataset used by the prototype

## Current scope

- 5 supported event types
- 4 tracked ETFs: `SOXX`, `QQQ`, `XLU`, `XLE`
- local event taxonomy and seeded calibration pipeline
- CSV-backed seed event dataset
- rule-based event classification
- learned `amplitude_z`, `lag_days`, `decay`, and `uncertainty_z` templates aggregated from seeded event observations
- SVG chart rendering
- local browser history via `localStorage`

## Prototype limitations

- no live market data
- no backend
- no LLM classification
- no API integration yet
