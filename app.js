const STORAGE_KEY = "alphalens-prototype-history";
const HORIZON_DAYS = 3;
const POINT_COUNT = 61;
const TIME_GRID = Array.from(
  { length: POINT_COUNT },
  (_, index) => (HORIZON_DAYS / (POINT_COUNT - 1)) * index,
);

const PREDICTION_MODES = {
  empirical: {
    label: "Empirical Template",
    shortLabel: "Empirical",
    timingKicker: "Relative order and rationale by asset (left = leads, right = lags)",
    toggleNote: "Blends calibrated responses from similar events.",
    methodCopy:
      "Empirical mode blends average amplitude, lag, and decay templates before drawing the scenario path.",
  },
  leadlag: {
    label: "Lead-Lag",
    shortLabel: "Lead-Lag",
    timingKicker: "Relative order and rationale by asset (left = leads, right = lags)",
    toggleNote: "Preserves the order reactions unfold across assets.",
    methodCopy:
      "Lead-Lag mode blends averaged horizon response paths directly, preserving who tends to move first and who follows later.",
  },
};

const ASSETS = {
  SOXX: {
    name: "SOXX",
    label: "Semiconductor ETF",
    legendLabel: "Semiconductors",
    color: "#7dc9ff",
  },
  QQQ: {
    name: "QQQ",
    label: "Broad Tech / Nasdaq-100 ETF",
    legendLabel: "Broad tech",
    color: "#67f0c6",
  },
  XLU: {
    name: "XLU",
    label: "Utilities ETF",
    legendLabel: "Utilities",
    color: "#ffb86b",
  },
  XLE: {
    name: "XLE",
    label: "Energy ETF",
    legendLabel: "Energy",
    color: "#ff7c82",
  },
};

const EVENT_TYPE_THEME = {
  policy_semiconductor: "semiconductor",
  ai_demand: "ai",
  power_bottleneck: "power",
  policy_ai_infra: "power",
  geopolitical_energy: "energy",
};

const THEME_CONFIG = {
  semiconductor: {
    title: "Semiconductors",
    color: ASSETS.SOXX.color,
  },
  ai: {
    title: "AI / Tech",
    color: ASSETS.QQQ.color,
  },
  power: {
    title: "Power / Infrastructure",
    color: ASSETS.XLU.color,
  },
  energy: {
    title: "Energy / Geopolitics",
    color: ASSETS.XLE.color,
  },
  neutral: {
    title: "General",
    color: "#b7caea",
  },
};

const SAMPLE_THEME_ORDER = ["semiconductor", "ai", "power", "energy"];
const SAMPLE_DISPLAY_OVERRIDES = {
  "AI data center demand surges after hyperscaler capex guidance":
    "AI data center demand surges after hyperscaler guidance",
  "AI demand surges but grid bottlenecks delay new data center capacity":
    "AI demand surges but grid bottlenecks delay new data centers",
  "New semiconductor tariffs announced on advanced chip imports from China":
    "New semiconductor tariffs announced on advanced chip imports",
  "Semiconductor tariff relief and federal permitting support AI infrastructure buildout":
    "Tariff relief and federal permitting support AI infrastructure",
  "Power grid bottleneck delays new data center capacity in Northern Virginia":
    "Power grid bottleneck delays new data center capacity",
  "Middle East oil supply disruption raises energy security concerns":
    "Middle East oil disruption raises energy security concerns",
  "Federal permitting for AI infrastructure accelerates across multiple agencies":
    "Federal permitting for AI infrastructure accelerates",
};

const DEMO_SCRIPT = {
  headline: "AI demand surges but grid bottlenecks delay new data center capacity",
  typeDelayMs: 18,
  moveDurationMs: 240,
  seriesRevealMs: 340,
  stepGapMs: 120,
};

const DOM = {
  tabs: document.querySelectorAll(".tab-button"),
  panels: document.querySelectorAll(".tab-panel"),
  input: document.querySelector("#event-input"),
  inputCard: document.querySelector(".input-card"),
  analyzeButton: document.querySelector("#analyze-button"),
  clearButton: document.querySelector("#clear-button"),
  playDemoButton: document.querySelector("#play-demo-button"),
  predictionSwitch: document.querySelector("#prediction-switch"),
  empiricalLabel: document.querySelector("#empirical-label"),
  leadLagLabel: document.querySelector("#leadlag-label"),
  sampleSelect: document.querySelector("#sample-select"),
  classificationCard: document.querySelector(".classification-card"),
  classificationBadge: document.querySelector("#classification-badge"),
  confidencePill: document.querySelector("#confidence-pill"),
  confidenceFill: document.querySelector("#confidence-fill"),
  blendList: document.querySelector("#blend-list"),
  classificationTheme: document.querySelector("#classification-theme"),
  classificationChannels: document.querySelector("#classification-channels"),
  classificationRationale: document.querySelector("#classification-rationale"),
  analogList: document.querySelector("#analog-list"),
  chart: document.querySelector("#reaction-chart"),
  chartCard: document.querySelector(".chart-card"),
  chartLegend: document.querySelector("#chart-legend"),
  predictionModeNote: document.querySelector("#prediction-mode-note"),
  moveStorySection: document.querySelector(".move-story-section"),
  timingList: document.querySelector("#timing-list"),
  timingKicker: document.querySelector("#timing-kicker"),
  marketReadText: document.querySelector("#market-read-text"),
  confidenceText: document.querySelector("#confidence-text"),
  analogCard: document.querySelector(".analog-card"),
  historyList: document.querySelector("#history-list"),
  demoOverlay: document.querySelector("#demo-overlay"),
  demoCursor: document.querySelector("#demo-cursor"),
};

const state = {
  catalog: null,
  curatedEvents: [],
  events: [],
  calibratedTemplates: {},
  leadLagProfiles: {},
  calibrationStats: {},
  predictionMode: "empirical",
  history: loadHistory(),
  demoRunId: 0,
  demoActive: false,
  demoAutoplayTimer: null,
};

initialize();

async function initialize() {
  renderLegend();
  renderHistory();
  bindEvents();
  updatePredictionModeUI();
  setLoadingState();

  try {
    await loadDataset();
    renderSampleOptions();

    const firstSample = state.catalog.sampleEvents[0];
    if (firstSample) {
      DOM.input.value = firstSample;
      if (DOM.sampleSelect) {
        DOM.sampleSelect.value = firstSample;
      }
      runAnalysis(firstSample, { persist: false });
      scheduleAutoDemo();
    }
  } catch (error) {
    setDatasetErrorState(error);
  }
}

async function loadDataset() {
  const [catalogResponse, csvResponse] = await Promise.all([
    fetch("./data/event_catalog.json"),
    fetch("./data/events_master.csv"),
  ]);

  if (!catalogResponse.ok) {
    throw new Error(`event_catalog.json returned ${catalogResponse.status}`);
  }

  if (!csvResponse.ok) {
    throw new Error(`events_master.csv returned ${csvResponse.status}`);
  }

  const baseCatalog = await catalogResponse.json();
  const curatedEvents = parseCsv(await csvResponse.text())
    .map((row) => normalizeCuratedEventRow(row))
    .sort((left, right) => right.event_date.localeCompare(left.event_date));

  state.catalog = buildRuntimeCatalog(baseCatalog, curatedEvents);
  state.curatedEvents = curatedEvents;

  const calibration = calibrateDataset(state.catalog, curatedEvents);
  state.events = calibration.events;
  state.calibratedTemplates = calibration.templates;
  state.leadLagProfiles = calibration.leadLagProfiles;
  state.calibrationStats = calibration.stats;
}

function bindEvents() {
  DOM.tabs.forEach((button) => {
    button.addEventListener("click", () => {
      clearDemoSequence();
      activateTab(button.dataset.tab);
    });
  });

  DOM.analyzeButton.addEventListener("click", () => {
    clearDemoSequence();
    runAnalysis(DOM.input.value, { persist: true });
  });

  DOM.clearButton.addEventListener("click", () => {
    clearDemoSequence();
    DOM.input.value = "";
    if (DOM.sampleSelect) {
      DOM.sampleSelect.value = "";
    }
    DOM.input.focus();
  });

  if (DOM.playDemoButton) {
    DOM.playDemoButton.addEventListener("click", playDemo);
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!state.demoActive || event.pointerType === "touch") {
        return;
      }

      if (DOM.playDemoButton?.contains(event.target)) {
        return;
      }

      clearDemoSequence();
    },
    true,
  );

  if (DOM.predictionSwitch) {
    DOM.predictionSwitch.addEventListener("click", () => {
      clearDemoSequence();
      const nextMode = state.predictionMode === "empirical" ? "leadlag" : "empirical";
      setPredictionMode(nextMode, { rerun: true });
    });
  }

  if (DOM.sampleSelect) {
    DOM.sampleSelect.addEventListener("change", () => {
      const sample = DOM.sampleSelect.value;
      if (!sample) {
        return;
      }

      clearDemoSequence();
      DOM.input.value = sample;
      runAnalysis(sample, { persist: true });
    });
  }

  DOM.input.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      runAnalysis(DOM.input.value, { persist: true });
    }
  });
}

function setPredictionMode(mode, options = { rerun: false }) {
  if (!PREDICTION_MODES[mode] || state.predictionMode === mode) {
    return;
  }

  state.predictionMode = mode;
  updatePredictionModeUI();

  if (options.rerun && state.catalog && DOM.input.value.trim()) {
    runAnalysis(DOM.input.value, { persist: false });
  }
}

function updatePredictionModeUI() {
  const modeConfig = predictionModeConfig(state.predictionMode);

  if (DOM.predictionSwitch) {
    const isLeadLag = state.predictionMode === "leadlag";
    DOM.predictionSwitch.classList.toggle("leadlag", isLeadLag);
    DOM.predictionSwitch.setAttribute("aria-checked", isLeadLag ? "true" : "false");
  }

  if (DOM.empiricalLabel) {
    DOM.empiricalLabel.classList.toggle("active", state.predictionMode === "empirical");
  }

  if (DOM.leadLagLabel) {
    DOM.leadLagLabel.classList.toggle("active", state.predictionMode === "leadlag");
  }

  if (DOM.predictionModeNote) {
    DOM.predictionModeNote.textContent = modeConfig.toggleNote;
  }

  if (DOM.timingKicker) {
    DOM.timingKicker.textContent = modeConfig.timingKicker;
  }
}

function setLoadingState() {
  DOM.analyzeButton.disabled = true;
  DOM.classificationBadge.textContent = "Loading dataset";
  DOM.classificationBadge.className = "event-badge neutral";
  DOM.confidencePill.textContent = "Confidence --";
  DOM.confidenceFill.style.width = "0%";
  DOM.blendList.innerHTML =
    '<p class="empty-state">Loading blend weights from the curated gold set.</p>';
  DOM.classificationTheme.textContent = "--";
  DOM.classificationChannels.textContent = "--";
  DOM.classificationRationale.textContent =
    "Loading event taxonomy and curated gold/silver event records from local data files.";
  DOM.analogList.innerHTML =
    '<p class="empty-state">Loading historical analogs from the curated gold set.</p>';
  DOM.timingList.innerHTML =
    '<p class="empty-state">Loading ETF reaction stories from the gold-set response templates.</p>';
  DOM.marketReadText.textContent =
    "Loading event taxonomy, curated master data, and gold-set response templates.";
  DOM.confidenceText.textContent =
    "The prototype now derives calibration from a master curated dataset with gold and silver tiers.";
}

function setDatasetErrorState(error) {
  DOM.analyzeButton.disabled = true;
  DOM.classificationBadge.textContent = "Dataset Load Failed";
  DOM.classificationBadge.className = "event-badge caution";
  DOM.blendList.innerHTML =
    '<p class="empty-state">Blend breakdown unavailable until the dataset loads.</p>';
  DOM.classificationRationale.textContent = `Could not load local dataset files: ${error.message}`;
  DOM.analogList.innerHTML =
    '<p class="empty-state">Dataset loading failed. Check the local server and curated data files.</p>';
  DOM.timingList.innerHTML =
    '<p class="empty-state">ETF reaction stories are unavailable until the dataset loads.</p>';
  DOM.marketReadText.textContent =
    "The prototype could not load its local data files. Once the dataset is available, event classification and reaction curves will resume.";
  DOM.confidenceText.textContent =
    "This usually means the prototype was opened without the local server or a data file is missing.";
}

function normalizeCuratedEventRow(row) {
  const eventType = row.final_event_type || row.event_type || "";
  const headlineText = row.headline_text || row.event_text || "";

  return {
    ...row,
    event_id: row.event_id || "",
    event_date: row.event_date || "",
    event_timestamp_utc: row.event_timestamp_utc || "",
    headline_text: headlineText,
    event_text: headlineText,
    event_type: eventType,
    final_event_type: eventType,
    theme: row.theme || "",
    source_query: row.source_query || "",
    source_hint: row.source_hint || "",
    source_url: row.source_url || "",
    tier: row.tier || "",
    review_status: row.review_status || "",
    coverage_bucket: row.coverage_bucket || "",
    channels_hint: row.channels_hint || "",
    polarity_expected: row.polarity_expected || "",
    routing_notes: row.routing_notes || "",
    keyword_additions_suggested: row.keyword_additions_suggested || "",
    validation_status: row.validation_status || "",
    contamination_flag: row.contamination_flag || "",
    benchmark_symbol: row.benchmark_symbol || "",
    benchmark_adjustment_method: row.benchmark_adjustment_method || "",
    human_notes: row.human_notes || "",
  };
}

function buildRuntimeCatalog(baseCatalog, curatedEvents) {
  const runtimeCatalog = JSON.parse(JSON.stringify(baseCatalog));

  curatedEvents.forEach((event) => {
    if (!isReviewedCoverageRow(event) || !runtimeCatalog.eventTypes[event.event_type]) {
      return;
    }

    const config = runtimeCatalog.eventTypes[event.event_type];
    const suggestedTerms = parseSuggestedTerms(event.keyword_additions_suggested);

    suggestedTerms.forEach((term) => {
      if (!config.keywords[term]) {
        config.keywords[term] = weightForSuggestedTerm(term);
      }
    });

    if (event.coverage_bucket === "existing_type_polarity_bug") {
      const overridePhrases = suggestedTerms.filter((term) => looksLikeNegatedReliefPhrase(term));
      config.orientationOverridePhrases = uniqueValues([
        ...(config.orientationOverridePhrases || []),
        ...overridePhrases,
      ]);
    }
  });

  return runtimeCatalog;
}

function parseSuggestedTerms(value) {
  return uniqueValues(
    String(value || "")
      .split(/[\n|,]+/)
      .map((term) => term.trim().toLowerCase())
      .filter(Boolean),
  );
}

function weightForSuggestedTerm(term) {
  return term.includes(" ") ? 3 : 2;
}

function isReviewedCoverageRow(event) {
  return (
    ["reviewed", "gold_candidate", "gold_approved"].includes(event.review_status) &&
    ["existing_type_missing_words", "existing_type_polarity_bug"].includes(event.coverage_bucket)
  );
}

function activateTab(tabName) {
  DOM.tabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  DOM.panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });
}

function renderSampleOptions() {
  DOM.analyzeButton.disabled = false;
  if (!DOM.sampleSelect) {
    return;
  }

  DOM.sampleSelect.innerHTML = '<option value="">Choose a sample event...</option>';

  state.catalog.sampleEvents.forEach((sample) => {
    const classification = classifyEvent(sample);
    const option = document.createElement("option");
    option.value = sample;
    option.textContent = `${classification.label} - ${sampleDisplayText(sample)}`;
    DOM.sampleSelect.appendChild(option);
  });
}

function renderLegend() {
  DOM.chartLegend.innerHTML = "";

  Object.values(ASSETS).forEach((asset) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <span class="legend-swatch" style="background:${asset.color}"></span>
      <span class="legend-copy">
        <span class="legend-ticker">${asset.name}</span>
        <span class="legend-caption">${asset.legendLabel}</span>
      </span>
    `;
    DOM.chartLegend.appendChild(item);
  });
}

function calibrateDataset(catalog, events) {
  const calibratedEvents = events.map((event) => {
    const config = catalog.eventTypes[event.event_type];
    if (!config?.templates) {
      return event;
    }

    return {
      ...event,
      calibration: parseObservedResponses(event) || buildEventObservation(event, config),
      leadLagObservation: parseObservedLeadLagResponses(event),
    };
  });

  const stats = {};
  const templates = {};
  const leadLagProfiles = {};

  Object.entries(catalog.eventTypes).forEach(([eventType, config]) => {
    const sample = {
      eventCount: 0,
      assets: mapValues(ASSETS, () => ({
        amplitudes: [],
        lags: [],
        decays: [],
        pathBuckets: TIME_GRID.map(() => []),
      })),
    };

    calibratedEvents.forEach((event) => {
      if (!shouldTrainOnEvent(event, eventType) || !event.calibration) {
        return;
      }

      sample.eventCount += 1;

      Object.keys(ASSETS).forEach((assetName) => {
        const observation = event.calibration[assetName];
        sample.assets[assetName].amplitudes.push(observation.amplitude_z);
        sample.assets[assetName].lags.push(observation.lag_days);
        sample.assets[assetName].decays.push(observation.decay);
        buildLeadLagPathFromEvent(event, assetName, observation).forEach((response, index) => {
          sample.assets[assetName].pathBuckets[index].push(response);
        });
      });
    });

    templates[eventType] = mapValues(config.templates, (fallbackTemplate, assetName) => {
      const assetSample = sample.assets[assetName];

      if (assetSample.amplitudes.length === 0) {
        return { ...fallbackTemplate };
      }

      return {
        amplitude_z: roundTo(mean(assetSample.amplitudes), 2),
        lag_days: roundTo(mean(assetSample.lags), 2),
        decay: roundTo(mean(assetSample.decays), 2),
        uncertainty_z: roundTo(clamp(standardDeviation(assetSample.amplitudes), 0.18, 0.85), 2),
      };
    });

    leadLagProfiles[eventType] = mapValues(config.templates, (fallbackTemplate, assetName) => {
      const assetSample = sample.assets[assetName];

      if (assetSample.amplitudes.length === 0) {
        return {
          responses: buildResponsePath(fallbackTemplate).map((value) => roundTo(value, 4)),
          uncertainty: TIME_GRID.map(() => roundTo(fallbackTemplate.uncertainty_z, 4)),
        };
      }

      return {
        responses: assetSample.pathBuckets.map((bucket) => roundTo(mean(bucket), 4)),
        uncertainty: assetSample.pathBuckets.map((bucket) =>
          roundTo(clamp(standardDeviation(bucket), 0.08, 0.95), 4),
        ),
      };
    });

    stats[eventType] = {
      eventCount: sample.eventCount,
      assets: mapValues(sample.assets, (assetSample) => ({
        sampleCount: assetSample.amplitudes.length,
        amplitudeMean: roundTo(mean(assetSample.amplitudes), 2),
        amplitudeStd: roundTo(standardDeviation(assetSample.amplitudes), 2),
        lagMean: roundTo(mean(assetSample.lags), 2),
        decayMean: roundTo(mean(assetSample.decays), 2),
      })),
    };
  });

  return {
    events: calibratedEvents,
    templates,
    leadLagProfiles,
    stats,
  };
}

function buildEventObservation(event, config) {
  const normalizedText = buildObservationText(event);
  const orientation = detectOrientation(event.event_type, normalizedText);

  return mapValues(config.templates, (template, assetName) => {
    const adjustment = computeCalibrationAdjustments(event, assetName, normalizedText);
    const amplitudeNoise = seededNoise(`${event.event_id}:${assetName}:amplitude`) * 0.08;
    const lagNoise = seededNoise(`${event.event_id}:${assetName}:lag`) * 0.1;
    const decayNoise = seededNoise(`${event.event_id}:${assetName}:decay`) * 0.12;
    const scaledAmplitude = template.amplitude_z * orientation.multiplier;
    const magnitudeScale = clamp(
      1 + adjustment.amplitudeScale + amplitudeNoise,
      0.62,
      1.58,
    );

    return {
      amplitude_z: roundTo(clamp(scaledAmplitude * magnitudeScale, -2.4, 2.4), 2),
      lag_days: roundTo(
        clamp(template.lag_days + adjustment.lagShift + lagNoise, 0, 2.6),
        2,
      ),
      decay: roundTo(
        clamp(template.decay + adjustment.decayShift + decayNoise, 0.9, 2.7),
        2,
      ),
    };
  });
}

function parseObservedResponses(event) {
  const observed = {};

  for (const assetName of Object.keys(ASSETS)) {
    const lower = assetName.toLowerCase();
    const amplitude = Number.parseFloat(event[`observed_${lower}_amplitude_z`]);
    const lag = Number.parseFloat(event[`observed_${lower}_lag_days`]);
    const decay = Number.parseFloat(event[`observed_${lower}_decay`]);

    if ([amplitude, lag, decay].some((value) => Number.isNaN(value))) {
      return null;
    }

    observed[assetName] = {
      amplitude_z: roundTo(amplitude, 2),
      lag_days: roundTo(lag, 2),
      decay: roundTo(decay, 2),
    };
  }

  return observed;
}

function parseObservedLeadLagResponses(event) {
  const observed = {};

  for (const assetName of Object.keys(ASSETS)) {
    const lower = assetName.toLowerCase();
    const horizons = [0, 1, 2, 3].map((horizon) =>
      Number.parseFloat(event[`observed_${lower}_d${horizon}`]),
    );

    if (horizons.every((value) => !Number.isNaN(value))) {
      observed[assetName] = horizons.map((value) => roundTo(value, 4));
    }
  }

  return Object.keys(observed).length ? observed : null;
}

function buildLeadLagPathFromEvent(event, assetName, fallbackObservation) {
  const measured = event.leadLagObservation?.[assetName];
  if (measured?.length === 4) {
    return TIME_GRID.map((t) => roundTo(interpolateMeasuredHorizonPath(measured, t), 4));
  }

  return buildResponsePath(fallbackObservation);
}

function buildObservationText(event) {
  return [
    event.event_text,
    event.theme.replaceAll("_", " "),
    event.source_query.replaceAll("_", " "),
  ]
    .join(" ")
    .toLowerCase();
}

function computeCalibrationAdjustments(event, assetName, normalizedText) {
  const hasTradeShock = containsAny(normalizedText, [
    "tariff",
    "tariffs",
    "restriction",
    "restrictions",
    "export control",
    "export controls",
    "supply chain",
    "sanctions",
    "china",
    "trade",
    "smuggling",
  ]);
  const hasDemandImpulse = containsAny(normalizedText, [
    "demand",
    "capex",
    "investment",
    "earnings",
    "hyperscaler",
    "hyperscalers",
    "gpu",
    "compute",
    "cloud",
    "server",
    "buildout",
    "spending",
  ]);
  const hasPowerConstraint = containsAny(normalizedText, [
    "power",
    "grid",
    "electricity",
    "interconnection",
    "load",
    "constraint",
    "constraints",
    "scarcity",
    "capacity",
    "transmission",
    "gigawatt",
    "bottleneck",
  ]);
  const hasEnergyShock = containsAny(normalizedText, [
    "oil",
    "gas",
    "lng",
    "hormuz",
    "middle east",
    "red sea",
    "shipping",
    "conflict",
    "escalation",
    "disruption",
  ]);
  const hasPolicySupport = containsAny(normalizedText, [
    "permit",
    "permitting",
    "executive",
    "federal",
    "doe",
    "support",
    "supports",
    "procurement",
    "co-location",
    "colocation",
    "designates",
    "sites",
    "vetoes",
    "veto",
  ]);
  const referencesUtilities = containsAny(normalizedText, [
    "utility",
    "utilities",
    "regulated",
    "grid equipment",
    "power providers",
  ]);
  const referencesGasGeneration = containsAny(normalizedText, [
    "natural gas",
    "gas demand",
    "generation",
    "backup power",
    "energy co-location",
  ]);

  const adjustments = {
    amplitudeScale: 0,
    lagShift: 0,
    decayShift: 0,
  };

  if (assetName === "SOXX") {
    if (hasTradeShock) adjustments.amplitudeScale += 0.12;
    if (hasDemandImpulse) adjustments.amplitudeScale += 0.09;
    if (hasPowerConstraint) adjustments.amplitudeScale += 0.05;
    if (hasDemandImpulse || hasTradeShock) adjustments.lagShift -= 0.06;
    if (hasPolicySupport) adjustments.decayShift += 0.05;
  }

  if (assetName === "QQQ") {
    if (hasTradeShock) adjustments.amplitudeScale += 0.08;
    if (hasDemandImpulse) adjustments.amplitudeScale += 0.07;
    if (hasEnergyShock) adjustments.amplitudeScale += 0.06;
    if (hasDemandImpulse) adjustments.lagShift -= 0.05;
    if (hasPowerConstraint) adjustments.decayShift += 0.04;
  }

  if (assetName === "XLU") {
    if (hasPowerConstraint) adjustments.amplitudeScale += 0.14;
    if (hasPolicySupport) adjustments.amplitudeScale += 0.12;
    if (referencesUtilities) adjustments.lagShift -= 0.12;
    if (hasDemandImpulse && !hasPowerConstraint) adjustments.lagShift += 0.08;
    if (hasPolicySupport || hasPowerConstraint) adjustments.decayShift += 0.12;
  }

  if (assetName === "XLE") {
    if (hasEnergyShock) adjustments.amplitudeScale += 0.16;
    if (referencesGasGeneration) adjustments.amplitudeScale += 0.1;
    if (hasPowerConstraint) adjustments.amplitudeScale += 0.05;
    if (hasEnergyShock) adjustments.lagShift -= 0.08;
    if (hasEnergyShock || referencesGasGeneration) adjustments.decayShift += 0.08;
  }

  if (event.event_type === "policy_ai_infra" && assetName === "XLU") {
    adjustments.amplitudeScale += 0.06;
  }

  if (event.event_type === "geopolitical_energy" && assetName === "XLE") {
    adjustments.amplitudeScale += 0.05;
  }

  return adjustments;
}

function containsAny(text, terms) {
  return terms.some((term) => textIncludesTerm(text, term));
}

function textIncludesTerm(text, term) {
  const escaped = term
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

function getTemplatesForEventType(eventType) {
  return (
    state.calibratedTemplates[eventType] ||
    state.catalog.eventTypes[eventType]?.templates ||
    {}
  );
}

function runAnalysis(inputText, options = { persist: true }) {
  if (!state.catalog) {
    return null;
  }

  const cleanInput = inputText.trim();
  if (!cleanInput) {
    if (DOM.sampleSelect) {
      DOM.sampleSelect.value = "";
    }
    return null;
  }

  if (DOM.sampleSelect) {
    DOM.sampleSelect.value = state.catalog.sampleEvents.includes(cleanInput) ? cleanInput : "";
  }

  const classification = classifyEvent(cleanInput);
  const scenario = buildScenario(classification, state.predictionMode);

  updateClassificationUI(classification);
  renderAnalogs(classification);
  renderChart(scenario);
  renderTiming(classification, scenario);
  renderExplanation(classification, scenario);

  if (options.persist) {
    pushHistory(cleanInput, classification, scenario);
  }

  return { classification, scenario };
}

function classifyEvent(text) {
  const normalized = text.toLowerCase();
  const eventTypes = state.catalog.eventTypes;

  const scores = Object.entries(eventTypes).map(([eventType, config]) => {
    let score = 0;
    const matchedTerms = [];

    Object.entries(config.keywords).forEach(([keyword, weight]) => {
      if (textIncludesTerm(normalized, keyword)) {
        score += weight;
        matchedTerms.push(keyword);
      }
    });

    return {
      eventType,
      score,
      matchedTerms,
      config,
    };
  });

  scores.sort((left, right) => right.score - left.score);

  const top = scores[0];
  const second = scores[1];
  const totalMatched = scores.reduce((sum, item) => sum + item.score, 0);

  if (!top || top.score < 4) {
    const approximateClassification = buildApproximateClassification(scores, normalized);
    if (approximateClassification) {
      return approximateClassification;
    }

    return {
      supported: false,
      event_type: "unsupported",
      label: "Outside Current Template Set",
      tone: "caution",
      theme: "unsupported",
      channels: ["needs_review"],
      confidence: 0.24,
      rationale:
        "The input does not strongly match the current AI, policy, power, or energy templates. A broader production system would either ask for clarification or route the event into a wider taxonomy.",
    };
  }

  const blendedComponents = buildBlendedComponents(scores, normalized);
  const separation = Math.max(0, top.score - (second?.score ?? 0));
  const baseConfidence =
    0.46 + Math.min(top.score, 14) * 0.035 + Math.min(separation, 6) * 0.03;
  const overlapPenalty =
    totalMatched > 0 ? Math.max(0, 0.1 - separation * 0.01) : 0;
  const blendPenalty =
    blendedComponents.length > 1
      ? (1 - blendedComponents[0].weight) * 0.16
      : 0;
  const confidence = clamp(baseConfidence - overlapPenalty - blendPenalty, 0.38, 0.94);
  const primaryComponent = blendedComponents[0];
  const rationale = buildClassificationRationale(blendedComponents);

  return {
    supported: true,
    event_type: primaryComponent.eventType,
    primary_event_type: primaryComponent.eventType,
    label: buildClassificationLabel(blendedComponents),
    tone: deriveClassificationTone(blendedComponents),
    theme: blendedComponents.map((component) => component.theme).join(" + "),
    channels: uniqueValues(
      blendedComponents.flatMap((component) => component.channels),
    ),
    confidence,
    rationale,
    components: blendedComponents,
    approximate: false,
  };
}

function buildApproximateClassification(scores, normalizedText) {
  const positiveScores = scores.filter((item) => item.score > 0);
  const top = positiveScores[0];
  if (!top) {
    return null;
  }

  const maxMatchedWeight = Math.max(
    0,
    ...top.matchedTerms.map((term) => top.config.keywords[term] || 0),
  );
  const hasMultipleSignals = top.matchedTerms.length >= 2;
  const hasEnoughSignal = top.score >= 3 || (top.score >= 2 && hasMultipleSignals) || maxMatchedWeight >= 4;

  if (!hasEnoughSignal) {
    return null;
  }

  const component = {
    eventType: top.eventType,
    label: top.config.label,
    tone: top.config.tone,
    theme: top.config.theme,
    channels: top.config.channels,
    matchedTerms: top.matchedTerms,
    score: top.score,
    weight: 1,
    orientation: detectOrientation(top.eventType, normalizedText),
  };
  const second = positiveScores[1];
  const separation = Math.max(0, top.score - (second?.score ?? 0));
  const confidence = clamp(0.3 + Math.min(top.score, 4) * 0.045 + Math.min(separation, 4) * 0.02, 0.34, 0.54);

  return {
    supported: true,
    approximate: true,
    event_type: top.eventType,
    primary_event_type: top.eventType,
    label: top.config.label,
    tone: top.config.tone,
    theme: top.config.theme,
    channels: top.config.channels,
    confidence,
    rationale: `Low-signal nearest-template match to ${top.config.label.toLowerCase()} via ${top.matchedTerms.join(", ")}. Review suggested before trusting the scenario.`,
    components: [component],
  };
}

function buildBlendedComponents(scores, normalizedText) {
  const positiveScores = scores.filter((item) => item.score > 0);
  const top = positiveScores[0];
  const threshold = Math.max(4, top.score * 0.45);
  const selected = positiveScores
    .filter((item, index) => index === 0 || item.score >= threshold)
    .slice(0, 3);
  const weightedBase = selected.reduce(
    (sum, item) => sum + item.score ** 1.25,
    0,
  );

  return selected.map((item) => ({
    eventType: item.eventType,
    label: item.config.label,
    tone: item.config.tone,
    theme: item.config.theme,
    channels: item.config.channels,
    matchedTerms: item.matchedTerms,
    score: item.score,
    weight: roundTo(item.score ** 1.25 / weightedBase, 3),
    orientation: detectOrientation(item.eventType, normalizedText),
  }));
}

function detectOrientation(eventType, normalizedText) {
  const orientationOverridePhrases =
    state.catalog?.eventTypes?.[eventType]?.orientationOverridePhrases || [];
  const reliefSignals = [
    "ease",
    "eases",
    "eased",
    "relief",
    "improve",
    "improves",
    "improved",
    "resume",
    "resumes",
    "reopen",
    "reopens",
    "resolved",
    "resolve",
    "rollback",
    "roll back",
    "waive",
    "waives",
    "lift",
    "lifts",
    "relax",
    "relaxes",
  ];
  const negativeSignals = [
    "cut",
    "cuts",
    "slowdown",
    "delay",
    "delays",
    "delayed",
    "weak",
    "weaker",
    "freeze",
    "halt",
    "halts",
    "pause",
    "paused",
    "veto",
  ];

  const aiContext = ["demand", "capex", "spending", "compute", "server", "buildout", "hyperscaler", "cloud"];
  const policyContext = ["permit", "permitting", "policy", "infrastructure", "federal", "doe", "support", "agency"];
  const semiconductorContext = ["tariff", "tariffs", "restriction", "restrictions", "export", "control", "controls", "semiconductor", "chip", "chips", "china"];
  const powerContext = ["power", "grid", "electricity", "interconnection", "capacity", "constraint", "constraints", "bottleneck", "load", "transmission"];
  const energyContext = ["oil", "gas", "lng", "shipping", "supply", "sanctions", "conflict", "middle east", "hormuz", "red sea", "energy"];
  const negatedReliefSignals = [
    "fail to ease",
    "fails to ease",
    "failed to ease",
    "failure to ease",
    "not ease",
    "does not ease",
    "did not ease",
    "unable to ease",
    "no easing",
    ...orientationOverridePhrases,
  ];
  const hasVetoedFreeze =
    containsAny(normalizedText, ["veto", "vetoes"]) &&
    containsAny(normalizedText, ["freeze", "freezes"]);
  const hasNegatedRelief = containsAny(normalizedText, negatedReliefSignals);

  if (eventType === "ai_demand") {
    if (containsAny(normalizedText, negativeSignals) && containsAny(normalizedText, aiContext)) {
      return { multiplier: -1, flipped: true };
    }
    return { multiplier: 1, flipped: false };
  }

  if (eventType === "policy_ai_infra") {
    if (hasVetoedFreeze) {
      return { multiplier: 1, flipped: false };
    }
    if (containsAny(normalizedText, negativeSignals) && containsAny(normalizedText, policyContext)) {
      return { multiplier: -1, flipped: true };
    }
    return { multiplier: 1, flipped: false };
  }

  if (eventType === "policy_semiconductor") {
    if (hasNegatedRelief) {
      return { multiplier: 1, flipped: false };
    }
    if (containsAny(normalizedText, reliefSignals) && containsAny(normalizedText, semiconductorContext)) {
      return { multiplier: -1, flipped: true };
    }
    return { multiplier: 1, flipped: false };
  }

  if (eventType === "power_bottleneck") {
    if (hasNegatedRelief) {
      return { multiplier: 1, flipped: false };
    }
    if (containsAny(normalizedText, reliefSignals) && containsAny(normalizedText, powerContext)) {
      return { multiplier: -1, flipped: true };
    }
    return { multiplier: 1, flipped: false };
  }

  if (eventType === "geopolitical_energy") {
    if (hasNegatedRelief) {
      return { multiplier: 1, flipped: false };
    }
    if (containsAny(normalizedText, reliefSignals) && containsAny(normalizedText, energyContext)) {
      return { multiplier: -1, flipped: true };
    }
    return { multiplier: 1, flipped: false };
  }

  return { multiplier: 1, flipped: false };
}

function buildClassificationLabel(components) {
  if (components.length === 1) {
    return components[0].label;
  }

  return components
    .slice(0, 2)
    .map((component) => component.label)
    .join(" + ");
}

function buildClassificationRationale(components) {
  if (components.length === 1) {
    const component = components[0];
    const rationaleBits = component.matchedTerms.slice(0, 4);
    return `Matched strongest to ${component.label.toLowerCase()} via ${rationaleBits.join(", ")}${
      component.orientation.flipped ? ", with polarity adjusted for the wording of the headline" : ""
    }.`;
  }

  const summary = components
    .map((component) => {
      const terms = component.matchedTerms.slice(0, 3).join(", ");
      const polarity = component.orientation.flipped
        ? " with polarity adjustment"
        : "";
      return `${Math.round(component.weight * 100)}% ${component.label} (${terms}${polarity})`;
    })
    .join(" + ");

  return `Blended market channels detected: ${summary}.`;
}

function deriveClassificationTone(components) {
  if (components.length === 1) {
    return components[0].tone;
  }

  const tones = uniqueValues(components.map((component) => component.tone));
  return tones.length === 1 ? tones[0] : "caution";
}

function buildScenario(classification, predictionMode = state.predictionMode) {
  if (predictionMode === "leadlag") {
    return buildLeadLagScenario(classification);
  }

  return buildEmpiricalScenario(classification);
}

function buildEmpiricalScenario(classification) {
  if (!classification.supported) {
    return buildUnsupportedScenario("empirical");
  }

  const blendedTemplates = buildBlendedTemplates(classification.components);
  const blendedStats = buildBlendedCalibrationStats(classification.components);
  const confidencePenalty = (1 - classification.confidence) * 0.45;
  const points = [];

  for (const t of TIME_GRID) {
    const row = { t, values: {} };

    Object.entries(blendedTemplates).forEach(([assetName, template]) => {
      const response =
        template.amplitude_z * responseKernel(t, template.lag_days, template.decay);
      const uncertainty = template.uncertainty_z + confidencePenalty;

      row.values[assetName] = {
        response,
        upper: response + uncertainty,
        lower: response - uncertainty,
      };
    });

    points.push(row);
  }

  return {
    supported: true,
    mode: "empirical",
    modeLabel: predictionModeConfig("empirical").label,
    eventType: classification.event_type,
    label: classification.label,
    points,
    calibrationStats: blendedStats,
    components: classification.components,
    templates: mapValues(blendedTemplates, (template) => ({
      ...template,
      uncertainty_z: template.uncertainty_z + confidencePenalty,
    })),
  };
}

function buildLeadLagScenario(classification) {
  if (!classification.supported) {
    return buildUnsupportedScenario("leadlag");
  }

  const blendedProfiles = buildBlendedLeadLagProfiles(classification.components);
  const blendedStats = buildBlendedCalibrationStats(classification.components);
  const confidencePenalty = (1 - classification.confidence) * 0.45;
  const points = TIME_GRID.map((t, index) => ({
    t,
    values: mapValues(ASSETS, (_, assetName) => {
      const response = blendedProfiles[assetName].responses[index];
      const uncertainty = blendedProfiles[assetName].uncertainty[index] + confidencePenalty;

      return {
        response,
        upper: response + uncertainty,
        lower: response - uncertainty,
      };
    }),
  }));

  return {
    supported: true,
    mode: "leadlag",
    modeLabel: predictionModeConfig("leadlag").label,
    eventType: classification.event_type,
    label: classification.label,
    points,
    calibrationStats: blendedStats,
    components: classification.components,
    templates: summarizeScenarioTemplates(points),
  };
}

function buildBlendedTemplates(components) {
  return mapValues(ASSETS, (_, assetName) => {
    let amplitude = 0;
    let lagNumerator = 0;
    let lagDenominator = 0;
    let decayNumerator = 0;
    let decayDenominator = 0;
    let baseUncertainty = 0;
    let disagreement = 0;
    const contributions = [];

    components.forEach((component) => {
      const template = getTemplatesForEventType(component.eventType)[assetName];
      const orientedAmplitude = template.amplitude_z * component.orientation.multiplier;
      const contributionWeight = component.weight * Math.max(0.12, Math.abs(orientedAmplitude));

      amplitude += component.weight * orientedAmplitude;
      lagNumerator += contributionWeight * template.lag_days;
      lagDenominator += contributionWeight;
      decayNumerator += contributionWeight * template.decay;
      decayDenominator += contributionWeight;
      baseUncertainty += component.weight * template.uncertainty_z;
      contributions.push({
        amplitude: orientedAmplitude,
        weight: component.weight,
      });
    });

    const meanContribution = contributions.reduce(
      (sum, item) => sum + item.amplitude * item.weight,
      0,
    );
    disagreement = Math.sqrt(
      contributions.reduce(
        (sum, item) => sum + item.weight * (item.amplitude - meanContribution) ** 2,
        0,
      ),
    );

    return {
      amplitude_z: roundTo(amplitude, 2),
      lag_days: roundTo(lagDenominator ? lagNumerator / lagDenominator : 0, 2),
      decay: roundTo(decayDenominator ? decayNumerator / decayDenominator : 1.5, 2),
      uncertainty_z: roundTo(clamp(baseUncertainty + disagreement * 0.35, 0.18, 0.95), 2),
    };
  });
}

function buildBlendedLeadLagProfiles(components) {
  return mapValues(ASSETS, (_, assetName) => {
    const blendedResponses = TIME_GRID.map(() => 0);
    const baseUncertainty = TIME_GRID.map(() => 0);
    const contributionSeries = [];

    components.forEach((component) => {
      const profile = getLeadLagProfileForEventType(component.eventType)[assetName];
      const signedResponses = profile.responses.map(
        (response) => response * component.orientation.multiplier,
      );

      contributionSeries.push({
        weight: component.weight,
        responses: signedResponses,
      });

      signedResponses.forEach((response, index) => {
        blendedResponses[index] += component.weight * response;
        baseUncertainty[index] += component.weight * profile.uncertainty[index];
      });
    });

    const disagreement = TIME_GRID.map((_, index) =>
      Math.sqrt(
        contributionSeries.reduce(
          (sum, series) =>
            sum + series.weight * (series.responses[index] - blendedResponses[index]) ** 2,
          0,
        ),
      ),
    );

    return {
      responses: blendedResponses.map((response) => roundTo(response, 4)),
      uncertainty: baseUncertainty.map((uncertainty, index) =>
        roundTo(clamp(uncertainty + disagreement[index] * 0.35, 0.16, 1.05), 4),
      ),
    };
  });
}

function buildBlendedCalibrationStats(components) {
  return {
    eventCount: components.reduce(
      (sum, component) =>
        sum + (state.calibrationStats[component.eventType]?.eventCount ?? 0),
      0,
    ),
    components: components.map((component) => ({
      eventType: component.eventType,
      label: component.label,
      weight: component.weight,
      eventCount: state.calibrationStats[component.eventType]?.eventCount ?? 0,
    })),
  };
}

function buildUnsupportedScenario(mode = "empirical") {
  const points = [];

  for (const t of TIME_GRID) {
    const row = { t, values: {} };

    Object.keys(ASSETS).forEach((assetName) => {
      row.values[assetName] = {
        response: 0,
        upper: 0.2,
        lower: -0.2,
      };
    });

    points.push(row);
  }

  return {
    supported: false,
    mode,
    modeLabel: predictionModeConfig(mode).label,
    label: "Unsupported Template",
    points,
    templates: mapValues(ASSETS, () => ({
      amplitude_z: 0,
      lag_days: null,
      uncertainty_z: 0.2,
    })),
  };
}

function responseKernel(t, lagDays, decay) {
  const x = t - lagDays;
  const ramp = smoothstep(-0.16, 0.22, x);
  const decayTerm = x < 0 ? 1 : Math.exp(-x / decay);
  return ramp * decayTerm;
}

function buildResponsePath(template) {
  return TIME_GRID.map((t) => template.amplitude_z * responseKernel(t, template.lag_days, template.decay));
}

function getLeadLagProfileForEventType(eventType) {
  if (state.leadLagProfiles[eventType]) {
    return state.leadLagProfiles[eventType];
  }

  return mapValues(getTemplatesForEventType(eventType), (template) => ({
    responses: buildResponsePath(template).map((value) => roundTo(value, 4)),
    uncertainty: TIME_GRID.map(() => roundTo(template.uncertainty_z, 4)),
  }));
}

function summarizeScenarioTemplates(points) {
  return mapValues(ASSETS, (_, assetName) => {
    let peak = { response: 0, t: 0, uncertainty: 0 };

    points.forEach((point) => {
      const current = point.values[assetName];
      if (Math.abs(current.response) > Math.abs(peak.response)) {
        peak = {
          response: current.response,
          t: point.t,
          uncertainty: (current.upper - current.lower) / 2,
        };
      }
    });

    return {
      amplitude_z: roundTo(peak.response, 2),
      lag_days: roundTo(peak.t, 2),
      decay: null,
      uncertainty_z: roundTo(peak.uncertainty, 2),
    };
  });
}

function smoothstep(edge0, edge1, x) {
  const scale = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return scale * scale * (3 - 2 * scale);
}

function renderChart(scenario) {
  const width = 960;
  const height = 460;
  const padding = { top: 24, right: 40, bottom: 42, left: 64 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const values = [];
  scenario.points.forEach((point) => {
    Object.values(point.values).forEach((value) => {
      values.push(value.lower, value.upper);
    });
  });

  const maxAbs = Math.max(1.4, ...values.map((value) => Math.abs(value)));
  const yDomain = Math.ceil(maxAbs * 1.1 * 2) / 2;

  const xScale = (x) => padding.left + (x / HORIZON_DAYS) * innerWidth;
  const yScale = (y) =>
    padding.top + innerHeight - ((y + yDomain) / (2 * yDomain)) * innerHeight;

  const chartParts = [];

  for (let i = 0; i <= 6; i += 1) {
    const yValue = yDomain - (i / 6) * (2 * yDomain);
    const y = yScale(yValue);
    chartParts.push(
      `<line class="chart-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>`,
    );
    chartParts.push(
      `<text class="chart-tick" x="${padding.left - 12}" y="${y + 4}" text-anchor="end">${formatSigned(
        yValue,
      )}</text>`,
    );
  }

  for (let day = 0; day <= HORIZON_DAYS; day += 1) {
    const x = xScale(day);
    chartParts.push(
      `<line class="chart-grid" x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}"></line>`,
    );
    chartParts.push(
      `<text class="chart-tick" x="${x}" y="${height - 14}" text-anchor="middle">Day ${day}</text>`,
    );
  }

  chartParts.push(
    `<line class="chart-zero" x1="${padding.left}" y1="${yScale(0)}" x2="${width - padding.right}" y2="${yScale(
      0,
    )}"></line>`,
  );
  chartParts.push(
    `<text class="chart-axis-label" x="${width / 2}" y="${height - 2}" text-anchor="middle">Trading days after event</text>`,
  );
  chartParts.push(
    `<text class="chart-axis-label" x="18" y="${height / 2}" transform="rotate(-90 18 ${
      height / 2
    })" text-anchor="middle">Relative reaction strength</text>`,
  );

  Object.entries(ASSETS).forEach(([assetName, asset]) => {
    const upperPoints = scenario.points.map(
      (point) => `${xScale(point.t)},${yScale(point.values[assetName].upper)}`,
    );
    const lowerPoints = scenario.points
      .slice()
      .reverse()
      .map(
        (point) => `${xScale(point.t)},${yScale(point.values[assetName].lower)}`,
      );
    const linePoints = scenario.points.map(
      (point) => `${xScale(point.t)},${yScale(point.values[assetName].response)}`,
    );
    const labelPoint = scenario.points[scenario.points.length - 1];

    chartParts.push(
      `<g class="chart-series" data-asset="${assetName}">
        <polygon class="band-path" fill="${asset.color}" points="${upperPoints
          .concat(lowerPoints)
          .join(" ")}"></polygon>
        <polyline class="line-path" stroke="${asset.color}" points="${linePoints.join(
          " ",
        )}"></polyline>
        <text class="chart-axis-label chart-series-label" x="${xScale(labelPoint.t) + 10}" y="${yScale(
          labelPoint.values[assetName].response,
        ) + 4}">${assetName}</text>
      </g>`,
    );
  });

  DOM.chart.innerHTML = chartParts.join("");
}

function buildTimingEntries(classification, scenario) {
  const isBlended = (classification.components?.length ?? 0) > 1;

  return Object.entries(scenario.templates)
    .map(([assetName, template]) => {
      const lag = template.lag_days ?? 0;
      return {
        assetName,
        timingLabel: "",
        lag,
        interpretation: isBlended
          ? blendedInterpretationForAsset(classification.components, assetName)
          : interpretationForAsset(
              classification.event_type,
              assetName,
              classification.supported,
            ),
        amplitude: template.amplitude_z,
      };
    })
    .sort((left, right) => left.lag - right.lag);
}

function renderTiming(classification, scenario) {
  DOM.timingList.innerHTML = "";
  const entries = buildTimingEntries(classification, scenario);

  entries.forEach((entry, index) => {
    entry.timingLabel = timingLabelForRank(index, entries.length);
    const item = document.createElement("div");
    item.className = "move-story-item themed-card";
    item.dataset.asset = entry.assetName;
    item.setAttribute("style", buildThemeVars(ASSETS[entry.assetName].color, 0.12));
    item.innerHTML = `
      <div class="story-asset-row">
        <div class="story-asset-name">
          <span>${entry.assetName}</span>
          <span class="story-direction">${directionArrow(entry.amplitude)}</span>
        </div>
        <span class="story-time-pill">${entry.timingLabel}</span>
      </div>
      <p class="story-body">${entry.interpretation}</p>
    `;
    DOM.timingList.appendChild(item);
  });
}

function renderExplanation(classification, scenario) {
  if (!classification.supported) {
    DOM.marketReadText.textContent =
      "This headline sits outside the prototype's current template set, so AlphaLens intentionally avoids a strong sector-level call.";
    DOM.confidenceText.textContent =
      "Confidence is low because the current MVP only supports a narrow set of AI infrastructure, semiconductor policy, power, and energy-linked events.";
    return;
  }

  const config = state.catalog.eventTypes[classification.event_type];
  const isBlended = (classification.components?.length ?? 0) > 1;
  const strongestAsset = Object.entries(scenario.templates).sort(
    (left, right) => Math.abs(right[1].amplitude_z) - Math.abs(left[1].amplitude_z),
  )[0][0];
  const eventCount = scenario.calibrationStats?.eventCount ?? 0;
  const modeConfig = predictionModeConfig(scenario.mode);
  const confidenceTone = classification.approximate
    ? "This is a nearest-template route based on limited in-scope signal, so treat the scenario as a cautious directional sketch."
    : classification.confidence > 0.78
      ? "The headline maps fairly cleanly into the current event map."
      : "The headline overlaps multiple market channels, so the scenario is more interpretive.";

  const blendSentence = classification.approximate
    ? `This read anchors on the closest current template: ${classification.label.toLowerCase()}.`
    : isBlended
      ? `This read blends ${classification.components
          .map(
            (component) =>
              `${Math.round(component.weight * 100)}% ${component.label.toLowerCase()}`,
          )
          .join(" with ")}.`
      : `This read is driven mainly by ${classification.label.toLowerCase()}.`;

  const leadSentence = classification.approximate
    ? `The strongest modeled move under this approximate route is ${strongestAsset}.`
    : `The strongest modeled move in this scenario is ${strongestAsset}.`;

  DOM.marketReadText.innerHTML = [
    classification.approximate
      ? "This headline only weakly matches the current taxonomy, so AlphaLens is routing it to the nearest supported template."
      : escapeHtml(config.explanation),
    `<strong>${escapeHtml(blendSentence)}</strong>`,
    escapeHtml(modeConfig.methodCopy),
    `<strong>${escapeHtml(leadSentence)}</strong>`,
  ].join(" ");
  DOM.confidenceText.textContent = `${modeConfig.label} is active. Current confidence is ${Math.round(
    classification.confidence * 100,
  )}%. ${confidenceTone} The reaction paths are learned from ${eventCount} gold-approved analogs in the local dataset, so treat them as structured directional sketches rather than precise forecasts.`;
}

function updateClassificationUI(classification) {
  DOM.classificationBadge.textContent = classification.label;
  DOM.classificationBadge.className = `event-badge ${classification.tone}`;
  DOM.confidencePill.textContent = `Confidence ${Math.round(
    classification.confidence * 100,
  )}%`;
  DOM.confidenceFill.style.width = `${Math.round(classification.confidence * 100)}%`;
  DOM.classificationTheme.textContent = humanizeDisplayText(classification.theme);
  const visibleChannels = classification.channels
    .slice(0, 4)
    .map((channel) => humanizeDisplayText(channel));
  if (classification.channels.length > 4) {
    visibleChannels.push(`+${classification.channels.length - 4} more`);
  }
  DOM.classificationChannels.textContent = visibleChannels.join(" · ");
  DOM.classificationRationale.textContent = classification.rationale;
  renderBlendMix(classification);
}

function renderBlendMix(classification) {
  DOM.blendList.innerHTML = "";

  if (!classification.supported) {
    DOM.blendList.innerHTML =
      '<p class="empty-state">No supported template blend for this headline.</p>';
    return;
  }

  const components = classification.components || [];

  components.forEach((component) => {
    const item = document.createElement("div");
    item.className = "blend-item";
    const weightPercent = Math.round(component.weight * 100);
    const polarityNote = component.orientation.flipped
      ? '<span class="blend-flag">Polarity adjusted</span>'
      : "";

    item.innerHTML = `
      <div class="blend-row">
        <div class="blend-label-group">
          <span class="blend-label">${component.label}</span>
          ${polarityNote}
        </div>
        <span class="blend-value">${weightPercent}%</span>
      </div>
      <div class="blend-bar">
        <div class="blend-fill" style="width:${weightPercent}%"></div>
      </div>
    `;

    DOM.blendList.appendChild(item);
  });
}

function renderAnalogs(classification) {
  DOM.analogList.innerHTML = "";

  if (!classification.supported) {
    DOM.analogList.innerHTML =
      '<p class="empty-state">No curated analogs because this event is outside the current template taxonomy.</p>';
    return;
  }

  const componentWeights = Object.fromEntries(
    (classification.components || []).map((component) => [
      component.eventType,
      component.weight,
    ]),
  );
  const analogs = state.events
    .filter((event) => componentWeights[event.event_type] && shouldTrainOnEvent(event, event.event_type))
    .sort((left, right) => {
      const weightDelta =
        componentWeights[right.event_type] - componentWeights[left.event_type];
      if (Math.abs(weightDelta) > 0.001) {
        return weightDelta;
      }

      return right.event_date.localeCompare(left.event_date);
    })
    .slice(0, 3);

  analogs.forEach((analog) => {
    const item = document.createElement("div");
    item.className = "analog-item";
    item.innerHTML = `
      <div class="analog-date">${analog.event_date}</div>
      ${buildAnalogTitleMarkup(analog)}
      <div class="analog-note">${formatAnalogNote(analog)}</div>
    `;
    DOM.analogList.appendChild(item);
  });
}

function formatAnalogNote(event) {
  if (!event.calibration) {
    return `Theme: ${humanizeDisplayText(event.theme)}. Source: ${event.source_hint}. Status: ${humanizeDisplayText(
      event.validation_status,
    )}.`;
  }

  const topMoves = Object.entries(event.calibration)
    .sort((left, right) => Math.abs(right[1].amplitude_z) - Math.abs(left[1].amplitude_z))
    .slice(0, 2)
    .map(([assetName, observation]) => `${assetName} ${formatSigned(observation.amplitude_z)}`)
    .join(" · ");

  return `Type: ${state.catalog.eventTypes[event.event_type]?.label ?? event.event_type}. Theme: ${humanizeDisplayText(
    event.theme,
  )}. Gold-set observed peaks: ${topMoves}. Source: ${event.source_hint}.`;
}

function buildAnalogTitleMarkup(event) {
  if (!event.source_url) {
    return `<div class="analog-title">${event.event_text}</div>`;
  }

  return `<a class="analog-title analog-title-link" href="${event.source_url}" target="_blank" rel="noreferrer">${event.event_text}</a>`;
}

function interpretationForAsset(eventType, assetName, supported) {
  if (!supported) {
    return "Unsupported event outside the narrow prototype scope";
  }

  const map = {
    policy_semiconductor: {
      SOXX: "Immediate semiconductor repricing on direct policy exposure",
      QQQ: "Broad tech follows as growth expectations reset",
      XLU: "Utilities pick up later on domestic infrastructure rotation",
      XLE: "Energy spillover remains conditional rather than direct",
    },
    ai_demand: {
      SOXX: "Chip names lead because demand lands first in compute suppliers",
      QQQ: "Broad tech follows as capex optimism spreads",
      XLU: "Utilities react later when the story broadens to power demand",
      XLE: "Energy responds only if the market extrapolates generation needs",
    },
    power_bottleneck: {
      SOXX: "Semiconductors soften as deployment timing is questioned",
      QQQ: "Broader tech digests the growth-delay narrative next",
      XLU: "Utilities benefit once grid scarcity becomes the main story",
      XLE: "Energy upside depends on whether gas and generation enter the narrative",
    },
    geopolitical_energy: {
      SOXX: "Semiconductors reprice after the initial risk-off move",
      QQQ: "Tech weakens quickly as duration and risk sentiment worsen",
      XLU: "Utilities are defensive but not clean direct beneficiaries",
      XLE: "Energy leads because the shock directly alters supply-risk pricing",
    },
    policy_ai_infra: {
      SOXX: "Semiconductors lift early on better deployment expectations",
      QQQ: "Broad tech follows as policy support validates spending",
      XLU: "Utilities move later as power infrastructure becomes more investable",
      XLE: "Energy gains remain smaller unless policy includes generation themes",
    },
  };

  return map[eventType][assetName];
}

function blendedInterpretationForAsset(components, assetName) {
  const labels = components
    .slice(0, 2)
    .map((component) => component.label)
    .join(" + ");

  const assetCopy = {
    SOXX: `Semiconductors absorb the blended signal from ${labels} first.`,
    QQQ: `Broad tech reflects the weighted mix of ${labels} after semiconductors.`,
    XLU: `Utilities capture the blended second-order power and infrastructure read-through.`,
    XLE: `Energy only follows when the blended narrative touches fuel, generation, or supply risk.`,
  };

  return assetCopy[assetName];
}

function timingLabelForRank(index, total) {
  if (total <= 1) {
    return "Lead";
  }

  if (index === 0) {
    return "Lead";
  }

  if (index === 1) {
    return "Follow";
  }

  if (index === total - 2) {
    return "Lag";
  }

  return "Late";
}

function pushHistory(inputText, classification, scenario) {
  const summary = Object.entries(scenario.templates).reduce(
    (accumulator, [assetName, template]) => {
      accumulator[assetName] = directionArrow(template.amplitude_z);
      return accumulator;
    },
    {},
  );

  const item = {
    timestamp: new Date().toISOString(),
    inputText,
    label: classification.label,
    eventType: classification.event_type,
    mode: scenario.mode,
    confidence: classification.confidence,
    summary,
  };

  state.history = [item, ...state.history].slice(0, 12);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  DOM.historyList.innerHTML = "";

  if (state.history.length === 0) {
    DOM.historyList.innerHTML =
      '<p class="empty-state">No analyses yet. Run an event from the Analyze tab to start building a prototype history.</p>';
    return;
  }

  state.history.forEach((entry) => {
    const wrapper = document.createElement("div");
    const theme = themeForKey(themeKeyForEventType(entry.eventType));
    wrapper.className = "history-item themed-card";
    wrapper.setAttribute("style", buildThemeVars(theme.color, 0.11));
    wrapper.innerHTML = `
      <div class="history-copy">
        <div class="history-meta-row">
          <span class="mini-pill">${formatDateTime(entry.timestamp)}</span>
          <span class="mini-pill">${theme.title}</span>
          <span class="mini-pill">${entry.label}</span>
          <span class="mini-pill">${predictionModeConfig(entry.mode).shortLabel}</span>
          <span class="mini-pill">Confidence ${Math.round(entry.confidence * 100)}%</span>
        </div>
        <div class="history-title">${entry.inputText}</div>
        <div class="history-summary">${entry.summary.SOXX} SOXX · ${entry.summary.QQQ} QQQ · ${entry.summary.XLU} XLU · ${entry.summary.XLE} XLE</div>
      </div>
      <button class="history-reload" type="button">Reload Analysis</button>
    `;

    wrapper.querySelector(".history-reload").addEventListener("click", () => {
      activateTab("analyze");
      setPredictionMode(entry.mode || "empirical");
      DOM.input.value = entry.inputText;
      runAnalysis(entry.inputText, { persist: false });
    });

    DOM.historyList.appendChild(wrapper);
  });
}

function directionArrow(value) {
  if (value > 0.12) {
    return "↑";
  }

  if (value < -0.12) {
    return "↓";
  }

  return "→";
}

function formatSigned(value) {
  if (Math.abs(value) < 0.01) {
    return "0.0";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function playDemo() {
  if (!state.catalog?.sampleEvents?.length) {
    return;
  }

  if (state.demoActive) {
    clearDemoSequence();
    return;
  }

  clearDemoSequence();
  activateTab("analyze");
  const runId = state.demoRunId + 1;
  state.demoRunId = runId;
  state.demoActive = true;

  document.body.classList.add("demo-running");
  if (DOM.demoOverlay) {
    DOM.demoOverlay.classList.add("active");
  }

  if (DOM.playDemoButton) {
    DOM.playDemoButton.classList.add("is-running");
    DOM.playDemoButton.setAttribute("aria-pressed", "true");
  }

  try {
    await runDemoSequence(runId);
  } finally {
    if (runId === state.demoRunId) {
      state.demoActive = false;
      document.body.classList.remove("demo-running");
      if (DOM.demoOverlay) {
        DOM.demoOverlay.classList.remove("active");
      }
      if (DOM.demoCursor) {
        DOM.demoCursor.classList.remove("active", "is-clicking");
      }
      if (DOM.playDemoButton) {
        DOM.playDemoButton.classList.remove("is-running");
        DOM.playDemoButton.setAttribute("aria-pressed", "false");
      }
    }
  }
}

function clearDemoSequence() {
  if (state.demoAutoplayTimer) {
    window.clearTimeout(state.demoAutoplayTimer);
    state.demoAutoplayTimer = null;
  }

  state.demoRunId += 1;
  state.demoActive = false;
  document.body.classList.remove("demo-running");

  if (DOM.demoOverlay) {
    DOM.demoOverlay.classList.remove("active");
  }

  if (DOM.demoCursor) {
    DOM.demoCursor.classList.remove("active", "is-clicking");
    DOM.demoCursor.style.removeProperty("transform");
    DOM.demoCursor.style.removeProperty("--demo-move-duration");
  }

  if (DOM.playDemoButton) {
    DOM.playDemoButton.classList.remove("is-running");
    DOM.playDemoButton.setAttribute("aria-pressed", "false");
  }

  [
    DOM.inputCard,
    DOM.classificationCard,
    DOM.chartCard,
    DOM.moveStorySection,
    DOM.analogCard,
    DOM.analyzeButton,
    DOM.predictionSwitch,
  ]
    .filter(Boolean)
    .forEach((element) =>
      element.classList.remove("demo-spotlight", "demo-target-focus", "demo-press"),
    );

  DOM.chart
    ?.querySelectorAll(".chart-series")
    .forEach((group) => resetChartSeriesAnimation(group));

  DOM.timingList
    ?.querySelectorAll(".move-story-item")
    .forEach((item) => item.classList.remove("demo-card-hidden", "demo-card-reveal"));
}

function scheduleAutoDemo() {
  if (state.demoAutoplayTimer) {
    window.clearTimeout(state.demoAutoplayTimer);
  }

  state.demoAutoplayTimer = window.setTimeout(() => {
    state.demoAutoplayTimer = null;
    playDemo();
  }, 440);
}

async function runDemoSequence(runId) {
  const headline = getDemoHeadline();

  setPredictionMode("empirical", { rerun: false });
  DOM.input.value = "";
  await nextPaint();
  if (!isDemoRunActive(runId)) {
    return;
  }

  await moveDemoCursorTo(DOM.input, { xFactor: 0.2, yFactor: 0.36 }, runId);
  DOM.input.focus({ preventScroll: true });
  DOM.inputCard?.classList.add("demo-target-focus");
  await typeDemoHeadline(headline, runId);
  DOM.inputCard?.classList.remove("demo-target-focus");

  if (!isDemoRunActive(runId)) {
    return;
  }

  await delay(120);
  await moveDemoCursorTo(DOM.analyzeButton, { xFactor: 0.5, yFactor: 0.5 }, runId);
  await clickDemoTarget(DOM.analyzeButton, runId);
  DOM.input.value = headline;
  const empiricalResult = runAnalysis(headline, { persist: false });
  flashDemoSpotlight(DOM.classificationCard);
  await delay(300);

  if (!isDemoRunActive(runId) || !empiricalResult) {
    return;
  }

  await moveDemoCursorTo(DOM.predictionSwitch, { xFactor: 0.55, yFactor: 0.5 }, runId);
  await clickDemoTarget(DOM.predictionSwitch, runId);
  setPredictionMode("leadlag", { rerun: false });
  const leadLagResult = runAnalysis(headline, { persist: false });
  flashDemoSpotlight(DOM.chartCard);
  flashDemoSpotlight(DOM.moveStorySection);
  await nextPaint();

  if (!isDemoRunActive(runId) || !leadLagResult) {
    return;
  }

  const orderedAssets = buildTimingEntries(
    leadLagResult.classification,
    leadLagResult.scenario,
  ).map((entry) => entry.assetName);

  prepareDemoChartAnimation(orderedAssets);
  prepareDemoTimingAnimation(orderedAssets);
  await delay(120);
  await animateLeadLagReveal(orderedAssets, runId);
  await delay(280);
}

function getDemoHeadline() {
  if (state.catalog?.sampleEvents?.includes(DEMO_SCRIPT.headline)) {
    return DEMO_SCRIPT.headline;
  }

  return (
    state.catalog?.sampleEvents?.find((sample) =>
      sample.toLowerCase().includes("grid bottleneck"),
    ) ||
    state.catalog?.sampleEvents?.[0] ||
    DEMO_SCRIPT.headline
  );
}

function isDemoRunActive(runId) {
  return state.demoActive && state.demoRunId === runId;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

async function moveDemoCursorTo(
  element,
  {
    xFactor = 0.5,
    yFactor = 0.5,
    offsetX = 0,
    offsetY = 0,
    duration = DEMO_SCRIPT.moveDurationMs,
  } = {},
  runId,
) {
  if (!DOM.demoCursor || !element || !isDemoRunActive(runId)) {
    return;
  }

  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width * xFactor + offsetX;
  const y = rect.top + rect.height * yFactor + offsetY;

  DOM.demoCursor.classList.add("active");
  DOM.demoCursor.style.setProperty("--demo-move-duration", `${duration}ms`);
  DOM.demoCursor.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;

  await delay(duration + 40);
}

async function typeDemoHeadline(text, runId) {
  DOM.input.value = "";

  for (const char of text) {
    if (!isDemoRunActive(runId)) {
      return;
    }

    DOM.input.value += char;
    await delay(DEMO_SCRIPT.typeDelayMs);
  }
}

async function clickDemoTarget(element, runId) {
  if (!element || !isDemoRunActive(runId)) {
    return;
  }

  element.classList.add("demo-target-focus", "demo-press");
  if (DOM.demoCursor) {
    DOM.demoCursor.classList.add("is-clicking");
  }

  await delay(130);

  element.classList.remove("demo-press");
  if (DOM.demoCursor) {
    DOM.demoCursor.classList.remove("is-clicking");
  }

  await delay(70);
  element.classList.remove("demo-target-focus");
}

function flashDemoSpotlight(element) {
  if (!element) {
    return;
  }

  element.classList.remove("demo-spotlight");
  void element.offsetWidth;
  element.classList.add("demo-spotlight");
  window.setTimeout(() => {
    element.classList.remove("demo-spotlight");
  }, 760);
}

function prepareDemoChartAnimation(assetOrder) {
  if (!DOM.chart) {
    return;
  }

  assetOrder.forEach((assetName) => {
    const group = DOM.chart.querySelector(`.chart-series[data-asset="${assetName}"]`);
    if (!group) {
      return;
    }

    const line = group.querySelector(".line-path");
    const band = group.querySelector(".band-path");
    const label = group.querySelector(".chart-series-label");
    const lineLength = line?.getTotalLength?.() ?? 0;

    if (line) {
      line.style.transition = "none";
      line.style.strokeDasharray = `${lineLength}`;
      line.style.strokeDashoffset = `${lineLength}`;
    }

    if (band) {
      band.style.opacity = "0";
      band.style.transition = "none";
    }

    if (label) {
      label.style.opacity = "0";
      label.style.transform = "translateY(6px)";
      label.style.transition = "none";
    }
  });

  void DOM.chart.getBoundingClientRect();
}

function revealChartSeries(assetName) {
  const group = DOM.chart?.querySelector(`.chart-series[data-asset="${assetName}"]`);
  if (!group) {
    return;
  }

  const line = group.querySelector(".line-path");
  const band = group.querySelector(".band-path");
  const label = group.querySelector(".chart-series-label");

  if (line) {
    line.style.transition = `stroke-dashoffset ${DEMO_SCRIPT.seriesRevealMs}ms ease`;
    line.style.strokeDashoffset = "0";
  }

  if (band) {
    band.style.transition = "opacity 220ms ease";
    band.style.opacity = "0.16";
  }

  if (label) {
    label.style.transition = "opacity 220ms ease, transform 220ms ease";
    label.style.opacity = "1";
    label.style.transform = "translateY(0)";
  }
}

function resetChartSeriesAnimation(group) {
  const line = group.querySelector(".line-path");
  const band = group.querySelector(".band-path");
  const label = group.querySelector(".chart-series-label");

  if (line) {
    line.style.removeProperty("transition");
    line.style.removeProperty("stroke-dasharray");
    line.style.removeProperty("stroke-dashoffset");
  }

  if (band) {
    band.style.removeProperty("opacity");
    band.style.removeProperty("transition");
  }

  if (label) {
    label.style.removeProperty("opacity");
    label.style.removeProperty("transform");
    label.style.removeProperty("transition");
  }
}

function prepareDemoTimingAnimation(assetOrder) {
  if (!DOM.timingList) {
    return;
  }

  assetOrder.forEach((assetName) => {
    const card = DOM.timingList.querySelector(`.move-story-item[data-asset="${assetName}"]`);
    if (card) {
      card.classList.add("demo-card-hidden");
    }
  });
}

function revealTimingCard(assetName) {
  const card = DOM.timingList?.querySelector(`.move-story-item[data-asset="${assetName}"]`);
  if (!card) {
    return;
  }

  card.classList.remove("demo-card-hidden");
  card.classList.add("demo-card-reveal");
  window.setTimeout(() => {
    card.classList.remove("demo-card-reveal");
  }, 420);
}

async function animateLeadLagReveal(assetOrder, runId) {
  for (const assetName of assetOrder) {
    if (!isDemoRunActive(runId)) {
      return;
    }

    revealChartSeries(assetName);
    await delay(DEMO_SCRIPT.stepGapMs);
    revealTimingCard(assetName);
    await delay(DEMO_SCRIPT.stepGapMs + 40);
  }
}

function themeKeyForEventType(eventType) {
  return EVENT_TYPE_THEME[eventType] || "neutral";
}

function themeForKey(themeKey) {
  return THEME_CONFIG[themeKey] || THEME_CONFIG.neutral;
}

function sampleDisplayText(sample) {
  return SAMPLE_DISPLAY_OVERRIDES[sample] || sample;
}

function humanizeDisplayText(value) {
  return String(value || "").replaceAll("_", " ");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shouldTrainOnEvent(event, eventType) {
  return (
    event.event_type === eventType &&
    event.tier === "gold" &&
    event.review_status === "gold_approved" &&
    !isTruthyFlag(event.contamination_flag)
  );
}

function isTruthyFlag(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized !== "" && !["0", "false", "no"].includes(normalized);
}

function interpolateMeasuredHorizonPath(measuredPoints, t) {
  const clampedT = clamp(t, 0, HORIZON_DAYS);
  const lowerIndex = Math.floor(clampedT);
  const upperIndex = Math.min(Math.ceil(clampedT), measuredPoints.length - 1);

  if (lowerIndex === upperIndex) {
    return measuredPoints[lowerIndex];
  }

  const lowerValue = measuredPoints[lowerIndex];
  const upperValue = measuredPoints[upperIndex];
  const weight = clampedT - lowerIndex;

  return lowerValue + (upperValue - lowerValue) * weight;
}

function looksLikeNegatedReliefPhrase(term) {
  return /\b(fail|fails|failed|failure|unable|not|no)\b/.test(term);
}

function predictionModeConfig(mode) {
  return PREDICTION_MODES[mode] || PREDICTION_MODES.empirical;
}

function buildThemeVars(color, backgroundAlpha = 0.1) {
  return [
    `--theme-accent:${color}`,
    `--theme-border:${hexToRgba(color, 0.26)}`,
    `--theme-bg:${hexToRgba(color, backgroundAlpha)}`,
    `--theme-soft:${hexToRgba(color, 0.14)}`,
  ].join(";");
}

function hexToRgba(hex, alpha) {
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((character) => character + character)
      .join("");
  }

  const value = Number.parseInt(normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? JSON.parse(raw).map((entry) => ({
          ...entry,
          mode: entry.mode || "empirical",
        }))
      : [];
  } catch (error) {
    return [];
  }
}

function parseCsv(csvText) {
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;

  function pushCell() {
    row.push(current);
    current = "";
  }

  function pushRow() {
    if (row.length > 1 || row[0] !== "") {
      rows.push(row);
    }
    row = [];
  }

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      pushCell();
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      pushCell();
      pushRow();
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    pushCell();
    pushRow();
  }

  const [header, ...dataRows] = rows;
  return dataRows.map((cells) =>
    Object.fromEntries(header.map((key, index) => [key, (cells[index] || "").trim()])),
  );
}

function mapValues(object, mapper) {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, mapper(value, key)]),
  );
}

function uniqueValues(values) {
  return [...new Set(values)];
}

function mean(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length <= 1) {
    return 0;
  }

  const average = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function seededNoise(seed) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) / 4294967295) * 2 - 1;
}

function roundTo(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
