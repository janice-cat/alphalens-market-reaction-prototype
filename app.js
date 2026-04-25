const STORAGE_KEY = "alphalens-prototype-history";
const HORIZON_DAYS = 3;
const POINT_COUNT = 61;

const ASSETS = {
  SOXX: {
    name: "SOXX",
    label: "Semiconductor ETF",
    color: "#7dc9ff",
  },
  QQQ: {
    name: "QQQ",
    label: "Broad Tech / Nasdaq-100 ETF",
    color: "#67f0c6",
  },
  XLU: {
    name: "XLU",
    label: "Utilities ETF",
    color: "#ffb86b",
  },
  XLE: {
    name: "XLE",
    label: "Energy ETF",
    color: "#ff7c82",
  },
};

const DOM = {
  tabs: document.querySelectorAll(".tab-button"),
  panels: document.querySelectorAll(".tab-panel"),
  input: document.querySelector("#event-input"),
  analyzeButton: document.querySelector("#analyze-button"),
  clearButton: document.querySelector("#clear-button"),
  sampleChips: document.querySelector("#sample-chips"),
  classificationBadge: document.querySelector("#classification-badge"),
  confidencePill: document.querySelector("#confidence-pill"),
  confidenceFill: document.querySelector("#confidence-fill"),
  classificationTheme: document.querySelector("#classification-theme"),
  classificationChannels: document.querySelector("#classification-channels"),
  classificationRationale: document.querySelector("#classification-rationale"),
  analogList: document.querySelector("#analog-list"),
  chart: document.querySelector("#reaction-chart"),
  chartLegend: document.querySelector("#chart-legend"),
  timingList: document.querySelector("#timing-list"),
  explanationText: document.querySelector("#explanation-text"),
  uncertaintyNote: document.querySelector("#uncertainty-note"),
  historyList: document.querySelector("#history-list"),
};

const state = {
  catalog: null,
  events: [],
  calibratedTemplates: {},
  calibrationStats: {},
  history: loadHistory(),
};

initialize();

async function initialize() {
  renderLegend();
  renderHistory();
  bindEvents();
  setLoadingState();

  try {
    await loadDataset();
    renderSampleChips();

    const firstSample = state.catalog.sampleEvents[0];
    if (firstSample) {
      DOM.input.value = firstSample;
      runAnalysis(firstSample, { persist: false });
    }
  } catch (error) {
    setDatasetErrorState(error);
  }
}

async function loadDataset() {
  const [catalogResponse, csvResponse] = await Promise.all([
    fetch("./data/event_catalog.json"),
    fetch("./data/events_seed.csv"),
  ]);

  if (!catalogResponse.ok) {
    throw new Error(`event_catalog.json returned ${catalogResponse.status}`);
  }

  if (!csvResponse.ok) {
    throw new Error(`events_seed.csv returned ${csvResponse.status}`);
  }

  state.catalog = await catalogResponse.json();
  const parsedEvents = parseCsv(await csvResponse.text())
    .map((row) => ({
      ...row,
      event_date: row.event_date || "",
    }))
    .sort((left, right) => right.event_date.localeCompare(left.event_date));

  const calibration = calibrateDataset(state.catalog, parsedEvents);
  state.events = calibration.events;
  state.calibratedTemplates = calibration.templates;
  state.calibrationStats = calibration.stats;
}

function bindEvents() {
  DOM.tabs.forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  DOM.analyzeButton.addEventListener("click", () => {
    runAnalysis(DOM.input.value, { persist: true });
  });

  DOM.clearButton.addEventListener("click", () => {
    DOM.input.value = "";
    DOM.input.focus();
  });

  DOM.input.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      runAnalysis(DOM.input.value, { persist: true });
    }
  });
}

function setLoadingState() {
  DOM.analyzeButton.disabled = true;
  DOM.classificationBadge.textContent = "Loading dataset";
  DOM.classificationBadge.className = "event-badge neutral";
  DOM.confidencePill.textContent = "Confidence --";
  DOM.confidenceFill.style.width = "0%";
  DOM.classificationTheme.textContent = "--";
  DOM.classificationChannels.textContent = "--";
  DOM.classificationRationale.textContent =
    "Loading event templates and seed events from local data files.";
  DOM.analogList.innerHTML =
    '<p class="empty-state">Loading historical analogs from the seed dataset.</p>';
  DOM.timingList.innerHTML =
    '<p class="empty-state">Loading calibrated response templates.</p>';
  DOM.explanationText.textContent =
    "Loading event taxonomy, templates, and seed data.";
  DOM.uncertaintyNote.textContent =
    "The prototype now loads from local dataset files instead of hardcoded constants.";
}

function setDatasetErrorState(error) {
  DOM.analyzeButton.disabled = true;
  DOM.classificationBadge.textContent = "Dataset Load Failed";
  DOM.classificationBadge.className = "event-badge caution";
  DOM.classificationRationale.textContent = `Could not load local dataset files: ${error.message}`;
  DOM.analogList.innerHTML =
    '<p class="empty-state">Dataset loading failed. Check the local server and data files.</p>';
  DOM.timingList.innerHTML =
    '<p class="empty-state">Timing panel unavailable until the dataset loads.</p>';
  DOM.explanationText.textContent =
    "The prototype could not load its local data files. Once the dataset is available, event classification and reaction curves will resume.";
  DOM.uncertaintyNote.textContent =
    "This usually means the prototype was opened without the local server or a data file is missing.";
}

function activateTab(tabName) {
  DOM.tabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  DOM.panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
  });
}

function renderSampleChips() {
  DOM.analyzeButton.disabled = false;
  DOM.sampleChips.innerHTML = "";

  state.catalog.sampleEvents.forEach((sample) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = sample;
    button.addEventListener("click", () => {
      DOM.input.value = sample;
      runAnalysis(sample, { persist: true });
    });
    DOM.sampleChips.appendChild(button);
  });
}

function renderLegend() {
  DOM.chartLegend.innerHTML = "";

  Object.values(ASSETS).forEach((asset) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <span class="legend-swatch" style="background:${asset.color}"></span>
      <span>${asset.name}</span>
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
      calibration: buildEventObservation(event, config),
    };
  });

  const stats = {};
  const templates = {};

  Object.entries(catalog.eventTypes).forEach(([eventType, config]) => {
    const sample = {
      eventCount: 0,
      assets: mapValues(ASSETS, () => ({
        amplitudes: [],
        lags: [],
        decays: [],
      })),
    };

    calibratedEvents.forEach((event) => {
      if (event.event_type !== eventType || !event.calibration) {
        return;
      }

      sample.eventCount += 1;

      Object.keys(ASSETS).forEach((assetName) => {
        const observation = event.calibration[assetName];
        sample.assets[assetName].amplitudes.push(observation.amplitude_z);
        sample.assets[assetName].lags.push(observation.lag_days);
        sample.assets[assetName].decays.push(observation.decay);
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
  return terms.some((term) => text.includes(term));
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
    return;
  }

  const cleanInput = inputText.trim();
  if (!cleanInput) {
    return;
  }

  const classification = classifyEvent(cleanInput);
  const scenario = buildScenario(classification);

  updateClassificationUI(classification);
  renderAnalogs(classification);
  renderChart(scenario);
  renderTiming(classification, scenario);
  renderExplanation(classification, scenario);

  if (options.persist) {
    pushHistory(cleanInput, classification, scenario);
  }
}

function classifyEvent(text) {
  const normalized = text.toLowerCase();
  const eventTypes = state.catalog.eventTypes;

  const scores = Object.entries(eventTypes).map(([eventType, config]) => {
    let score = 0;
    const matchedTerms = [];

    Object.entries(config.keywords).forEach(([keyword, weight]) => {
      if (normalized.includes(keyword)) {
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

  const separation = Math.max(0, top.score - (second?.score ?? 0));
  const baseConfidence =
    0.46 + Math.min(top.score, 14) * 0.035 + Math.min(separation, 6) * 0.03;
  const overlapPenalty =
    totalMatched > 0 ? Math.max(0, 0.1 - separation * 0.01) : 0;
  const confidence = clamp(baseConfidence - overlapPenalty, 0.38, 0.94);

  const orientation = detectOrientation(top.eventType, normalized);
  const rationaleBits = top.matchedTerms.slice(0, 4);
  const rationale = `Matched strongest to ${top.config.label.toLowerCase()} via ${rationaleBits.join(", ")}${
    orientation.flipped ? ", with polarity adjusted for the wording of the headline" : ""
  }.`;

  return {
    supported: true,
    event_type: top.eventType,
    label: top.config.label,
    tone: top.config.tone,
    theme: top.config.theme,
    channels: top.config.channels,
    confidence,
    rationale,
    orientation,
  };
}

function detectOrientation(eventType, normalizedText) {
  const supportiveReversal =
    (normalizedText.includes("veto") && normalizedText.includes("freeze")) ||
    ((normalizedText.includes("reverse") || normalizedText.includes("reverses")) &&
      containsAny(normalizedText, [
        "restriction",
        "restrictions",
        "tariff",
        "tariffs",
        "export policy",
        "export control",
        "freeze",
      ]));
  const negativeWords = [
    "slow",
    "slows",
    "slowdown",
    "cuts",
    "cut",
    "weak",
    "weaker",
    "delay",
    "delays",
    "delayed",
    "freeze",
    "veto",
    "risk",
    "bottleneck",
  ];

  const positiveWords = [
    "accelerate",
    "accelerates",
    "surge",
    "surges",
    "boost",
    "boosts",
    "support",
    "supports",
    "expands",
    "eases",
    "relief",
    "reopens",
    "improves",
    "reverses",
    "reverse",
    "rollback",
    "waives",
  ];

  const hasNegative = negativeWords.some((word) => normalizedText.includes(word));
  const hasPositive = positiveWords.some((word) => normalizedText.includes(word));

  const positiveBase =
    eventType === "ai_demand" || eventType === "policy_ai_infra";
  const negativeBase =
    eventType === "policy_semiconductor" ||
    eventType === "power_bottleneck" ||
    eventType === "geopolitical_energy";

  if (negativeBase && supportiveReversal) {
    return { multiplier: -1, flipped: true };
  }

  if (positiveBase && supportiveReversal) {
    return { multiplier: 1, flipped: false };
  }

  if (positiveBase && hasNegative && !hasPositive) {
    return { multiplier: -1, flipped: true };
  }

  if (negativeBase && hasPositive && !hasNegative) {
    return { multiplier: -1, flipped: true };
  }

  return { multiplier: 1, flipped: false };
}

function buildScenario(classification) {
  if (!classification.supported) {
    return buildUnsupportedScenario();
  }

  const config = state.catalog.eventTypes[classification.event_type];
  const calibratedTemplates = getTemplatesForEventType(classification.event_type);
  const calibrationStats = state.calibrationStats[classification.event_type];
  const orientationMultiplier = classification.orientation.multiplier;
  const confidencePenalty = (1 - classification.confidence) * 0.45;
  const points = [];

  for (let index = 0; index < POINT_COUNT; index += 1) {
    const t = (HORIZON_DAYS / (POINT_COUNT - 1)) * index;
    const row = { t, values: {} };

    Object.entries(calibratedTemplates).forEach(([assetName, template]) => {
      const response =
        template.amplitude_z *
        orientationMultiplier *
        responseKernel(t, template.lag_days, template.decay);
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
    eventType: classification.event_type,
    label: config.label,
    points,
    calibrationStats,
    templates: mapValues(calibratedTemplates, (template) => ({
      ...template,
      amplitude_z: template.amplitude_z * orientationMultiplier,
      uncertainty_z: template.uncertainty_z + confidencePenalty,
    })),
  };
}

function buildUnsupportedScenario() {
  const points = [];

  for (let index = 0; index < POINT_COUNT; index += 1) {
    const t = (HORIZON_DAYS / (POINT_COUNT - 1)) * index;
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

function smoothstep(edge0, edge1, x) {
  const scale = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return scale * scale * (3 - 2 * scale);
}

function renderChart(scenario) {
  const width = 960;
  const height = 420;
  const padding = { top: 28, right: 40, bottom: 48, left: 66 };
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
      `<text class="chart-tick" x="${x}" y="${height - 18}" text-anchor="middle">Day ${day}</text>`,
    );
  }

  chartParts.push(
    `<line class="chart-zero" x1="${padding.left}" y1="${yScale(0)}" x2="${width - padding.right}" y2="${yScale(
      0,
    )}"></line>`,
  );
  chartParts.push(
    `<text class="chart-axis-label" x="${width / 2}" y="${height - 4}" text-anchor="middle">Trading days after event</text>`,
  );
  chartParts.push(
    `<text class="chart-axis-label" x="18" y="${height / 2}" transform="rotate(-90 18 ${
      height / 2
    })" text-anchor="middle">Relative response (z-score)</text>`,
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
      `<polygon class="band-path" fill="${asset.color}" points="${upperPoints
        .concat(lowerPoints)
        .join(" ")}"></polygon>`,
    );
    chartParts.push(
      `<polyline class="line-path" stroke="${asset.color}" points="${linePoints.join(
        " ",
      )}"></polyline>`,
    );
    chartParts.push(
      `<text class="chart-axis-label" x="${xScale(labelPoint.t) + 10}" y="${yScale(
        labelPoint.values[assetName].response,
      ) + 4}">${assetName}</text>`,
    );
  });

  DOM.chart.innerHTML = chartParts.join("");
}

function renderTiming(classification, scenario) {
  DOM.timingList.innerHTML = "";

  const entries = Object.entries(scenario.templates)
    .map(([assetName, template]) => {
      const lag = template.lag_days ?? 0;
      return {
        assetName,
        timingLabel: toTimingLabel(lag),
        lag,
        interpretation: interpretationForAsset(
          classification.event_type,
          assetName,
          classification.supported,
        ),
        amplitude: template.amplitude_z,
      };
    })
    .sort((left, right) => left.lag - right.lag);

  entries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "timing-item";
    item.innerHTML = `
      <div class="timing-copy">
        <div class="timing-meta">${entry.assetName} · ${ASSETS[entry.assetName].label}</div>
        <div class="timing-title">${entry.interpretation}</div>
        <div class="history-summary">Peak modeled response ${formatSigned(entry.amplitude)} z with lag ${
      entry.lag === null ? "--" : `${entry.lag.toFixed(1)}d`
    }.</div>
      </div>
      <div class="timing-badge">${entry.timingLabel}</div>
    `;
    DOM.timingList.appendChild(item);
  });
}

function renderExplanation(classification, scenario) {
  if (!classification.supported) {
    DOM.explanationText.textContent =
      "This headline sits outside the prototype's current template set, so AlphaLens intentionally avoids a strong sector-level call.";
    DOM.uncertaintyNote.textContent =
      "Uncertainty is high because the current MVP only supports a narrow set of AI infrastructure, semiconductor policy, power, and geopolitical energy events.";
    return;
  }

  const config = state.catalog.eventTypes[classification.event_type];
  const strongestAsset = Object.entries(scenario.templates).sort(
    (left, right) => Math.abs(right[1].amplitude_z) - Math.abs(left[1].amplitude_z),
  )[0][0];
  const eventCount = scenario.calibrationStats?.eventCount ?? 0;
  const confidenceTone =
    classification.confidence > 0.78
      ? "Confidence is relatively strong because the headline maps cleanly to one template."
      : "Confidence is moderate because the headline overlaps multiple market channels.";

  DOM.explanationText.textContent = `${config.explanation} The strongest modeled move is in ${strongestAsset}. These curves are learned from ${eventCount} seeded analogs in the local dataset rather than pulled directly from a fixed template row. ${confidenceTone}`;
  DOM.uncertaintyNote.textContent = `Uncertainty_z comes from cross-event dispersion in the seed dataset, then widens when classification confidence falls. Current confidence: ${Math.round(
    classification.confidence * 100,
  )}% across the supported template set.`;
}

function updateClassificationUI(classification) {
  DOM.classificationBadge.textContent = classification.label;
  DOM.classificationBadge.className = `event-badge ${classification.tone}`;
  DOM.confidencePill.textContent = `Confidence ${Math.round(
    classification.confidence * 100,
  )}%`;
  DOM.confidenceFill.style.width = `${Math.round(classification.confidence * 100)}%`;
  DOM.classificationTheme.textContent = classification.theme;
  DOM.classificationChannels.textContent = classification.channels.join(" · ");
  DOM.classificationRationale.textContent = classification.rationale;
}

function renderAnalogs(classification) {
  DOM.analogList.innerHTML = "";

  if (!classification.supported) {
    DOM.analogList.innerHTML =
      '<p class="empty-state">No seeded analogs because this event is outside the current template taxonomy.</p>';
    return;
  }

  const analogs = state.events
    .filter((event) => event.event_type === classification.event_type)
    .slice(0, 3);

  analogs.forEach((analog) => {
    const item = document.createElement("div");
    item.className = "analog-item";
    item.innerHTML = `
      <div class="analog-date">${analog.event_date}</div>
      <div class="analog-title">${analog.event_text}</div>
      <div class="analog-note">${formatAnalogNote(analog)}</div>
    `;
    DOM.analogList.appendChild(item);
  });
}

function formatAnalogNote(event) {
  if (!event.calibration) {
    return `Theme: ${event.theme}. Source: ${event.source_hint}. Status: ${event.validation_status}.`;
  }

  const topMoves = Object.entries(event.calibration)
    .sort((left, right) => Math.abs(right[1].amplitude_z) - Math.abs(left[1].amplitude_z))
    .slice(0, 2)
    .map(([assetName, observation]) => `${assetName} ${formatSigned(observation.amplitude_z)}`)
    .join(" · ");

  return `Theme: ${event.theme}. Seeded observed peaks: ${topMoves}. Source: ${event.source_hint}.`;
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

function toTimingLabel(lagDays) {
  if (lagDays === null || lagDays === undefined) {
    return "Conditional";
  }

  if (lagDays <= 0.5) {
    return "Immediate";
  }

  if (lagDays <= 1.0) {
    return "Short Lag";
  }

  if (lagDays <= 2.0) {
    return "Lagged";
  }

  return "Conditional";
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
    wrapper.className = "history-item";
    wrapper.innerHTML = `
      <div class="history-copy">
        <div class="history-meta-row">
          <span class="mini-pill">${formatDateTime(entry.timestamp)}</span>
          <span class="mini-pill">${entry.label}</span>
          <span class="mini-pill">Confidence ${Math.round(entry.confidence * 100)}%</span>
        </div>
        <div class="history-title">${entry.inputText}</div>
        <div class="history-summary">${entry.summary.SOXX} SOXX · ${entry.summary.QQQ} QQQ · ${entry.summary.XLU} XLU · ${entry.summary.XLE} XLE</div>
      </div>
      <button class="history-reload" type="button">Reload Analysis</button>
    `;

    wrapper.querySelector(".history-reload").addEventListener("click", () => {
      activateTab("analyze");
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

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
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
