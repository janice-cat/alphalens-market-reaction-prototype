import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

const SEED_PATH = path.join(DATA_DIR, "events_seed.csv");
const MASTER_PATH = path.join(DATA_DIR, "events_master.csv");
const GOLD_PATH = path.join(DATA_DIR, "events_gold.csv");
const SILVER_PATH = path.join(DATA_DIR, "events_silver.csv");
const COVERAGE_EVAL_PATH = path.join(DATA_DIR, "coverage_eval.csv");
const CATALOG_PATH = path.join(DATA_DIR, "event_catalog.json");

const MASTER_FIELDS = [
  "event_id",
  "event_date",
  "event_timestamp_utc",
  "headline_text",
  "source_query",
  "source_hint",
  "source_url",
  "tier",
  "review_status",
  "coverage_bucket",
  "final_event_type",
  "theme",
  "channels_hint",
  "polarity_expected",
  "routing_notes",
  "keyword_additions_suggested",
  "validation_status",
  "observed_soxx_amplitude_z",
  "observed_soxx_lag_days",
  "observed_soxx_decay",
  "observed_qqq_amplitude_z",
  "observed_qqq_lag_days",
  "observed_qqq_decay",
  "observed_xlu_amplitude_z",
  "observed_xlu_lag_days",
  "observed_xlu_decay",
  "observed_xle_amplitude_z",
  "observed_xle_lag_days",
  "observed_xle_decay",
  "observed_soxx_d0",
  "observed_soxx_d1",
  "observed_soxx_d2",
  "observed_soxx_d3",
  "observed_qqq_d0",
  "observed_qqq_d1",
  "observed_qqq_d2",
  "observed_qqq_d3",
  "observed_xlu_d0",
  "observed_xlu_d1",
  "observed_xlu_d2",
  "observed_xlu_d3",
  "observed_xle_d0",
  "observed_xle_d1",
  "observed_xle_d2",
  "observed_xle_d3",
  "timestamp_quality",
  "contamination_flag",
  "benchmark_symbol",
  "benchmark_adjustment_method",
  "human_notes",
];

const COVERAGE_EVAL_FIELDS = [
  "eval_id",
  "headline_text",
  "expected_bucket",
  "expected_event_type",
  "expected_polarity",
  "notes",
];

const ALLOWED_TIERS = new Set(["gold", "silver"]);
const ALLOWED_REVIEW_STATUSES = new Set([
  "raw",
  "reviewed",
  "gold_candidate",
  "gold_approved",
  "rejected",
]);
const ALLOWED_COVERAGE_BUCKETS = new Set([
  "",
  "existing_type_missing_words",
  "existing_type_polarity_bug",
  "out_of_scope_current",
  "needs_new_type_later",
]);
const ALLOWED_POLARITIES = new Set(["", "positive", "negative", "mixed", "conditional"]);
const GOLD_RESPONSE_FIELDS = [
  "observed_soxx_amplitude_z",
  "observed_soxx_lag_days",
  "observed_soxx_decay",
  "observed_qqq_amplitude_z",
  "observed_qqq_lag_days",
  "observed_qqq_decay",
  "observed_xlu_amplitude_z",
  "observed_xlu_lag_days",
  "observed_xlu_decay",
  "observed_xle_amplitude_z",
  "observed_xle_lag_days",
  "observed_xle_decay",
];

const DEFAULT_POLARITY_BY_TYPE = {
  policy_semiconductor: "negative",
  ai_demand: "positive",
  power_bottleneck: "mixed",
  geopolitical_energy: "mixed",
  policy_ai_infra: "positive",
};

const STARTER_SILVER_ROWS = [
  {
    event_id: "S001",
    event_date: "2026-04-29",
    event_timestamp_utc: "",
    headline_text: "OpenAI Misses Key Revenue, User Targets in High-Stakes Sprint Toward IPO",
    source_query: "OpenAI Misses Key Revenue, User Targets in High-Stakes Sprint Toward IPO",
    source_hint: "conversation_example",
    source_url: "manual://conversation/openai-revenue-miss",
    tier: "silver",
    review_status: "reviewed",
    coverage_bucket: "out_of_scope_current",
    final_event_type: "",
    theme: "company_execution",
    channels_hint: "",
    polarity_expected: "conditional",
    routing_notes:
      "Company-specific monetization and execution story. Do not force into the current AI infrastructure taxonomy.",
    keyword_additions_suggested: "",
    validation_status: "manual_reviewed_conversation_example",
    timestamp_quality: "",
    contamination_flag: "",
    benchmark_symbol: "",
    benchmark_adjustment_method: "",
    human_notes: "Keep in silver as evidence for possible later AI platform execution taxonomy.",
  },
  {
    event_id: "S002",
    event_date: "2026-04-29",
    event_timestamp_utc: "",
    headline_text: "Google will invest as much as $40 billion in Anthropic",
    source_query: "Google will invest as much as $40 billion in Anthropic",
    source_hint: "conversation_example",
    source_url: "manual://conversation/google-anthropic-investment",
    tier: "silver",
    review_status: "reviewed",
    coverage_bucket: "existing_type_missing_words",
    final_event_type: "ai_demand",
    theme: "ai_investment_commitment",
    channels_hint: "ai_capex|compute_demand|power_rotation",
    polarity_expected: "positive",
    routing_notes:
      "Treat as AI demand / capex commitment rather than a new taxonomy branch. Use for keyword and alias expansion first.",
    keyword_additions_suggested:
      "invest as much as|funding commitment|strategic investment|capital commitment",
    validation_status: "manual_reviewed_conversation_example",
    timestamp_quality: "",
    contamination_flag: "",
    benchmark_symbol: "",
    benchmark_adjustment_method: "",
    human_notes: "Silver until a human reviews whether it should also become a gold AI demand event.",
  },
  {
    event_id: "S003",
    event_date: "2026-04-29",
    event_timestamp_utc: "",
    headline_text:
      "Anthropic debuts preview of powerful new AI model Mythos in new cybersecurity initiative",
    source_query:
      "Anthropic debuts preview of powerful new AI model Mythos in new cybersecurity initiative",
    source_hint: "conversation_example",
    source_url: "manual://conversation/anthropic-mythos-launch",
    tier: "silver",
    review_status: "reviewed",
    coverage_bucket: "out_of_scope_current",
    final_event_type: "",
    theme: "model_launch",
    channels_hint: "",
    polarity_expected: "conditional",
    routing_notes:
      "Model and product launch signal. Not enough evidence that it shares the same transmission path as AI infrastructure demand headlines.",
    keyword_additions_suggested: "",
    validation_status: "manual_reviewed_conversation_example",
    timestamp_quality: "",
    contamination_flag: "",
    benchmark_symbol: "",
    benchmark_adjustment_method: "",
    human_notes: "Keep in silver only unless a later broader taxonomy explicitly supports model-launch events.",
  },
  {
    event_id: "S004",
    event_date: "2026-04-29",
    event_timestamp_utc: "",
    headline_text:
      "Oil prices close at highest level since 2022 as Iran negotiations fail to ease supply fears",
    source_query:
      "Oil prices close at highest level since 2022 as Iran negotiations fail to ease supply fears",
    source_hint: "conversation_example",
    source_url: "manual://conversation/iran-negotiations-oil-prices",
    tier: "silver",
    review_status: "reviewed",
    coverage_bucket: "existing_type_polarity_bug",
    final_event_type: "geopolitical_energy",
    theme: "iran_supply_risk",
    channels_hint: "oil_supply_risk|risk_off|inflation_sensitivity",
    polarity_expected: "mixed",
    routing_notes:
      "Correct event type is geopolitical energy. The phrase 'fail to ease' should preserve the shock orientation rather than flipping it as relief.",
    keyword_additions_suggested:
      "iran|iranian|negotiation|negotiations|supply fears|fail to ease|fails to ease|failed to ease",
    validation_status: "manual_reviewed_conversation_example",
    timestamp_quality: "",
    contamination_flag: "",
    benchmark_symbol: "",
    benchmark_adjustment_method: "",
    human_notes: "Use for both keyword expansion and polarity-bug regression testing.",
  },
  {
    event_id: "S005",
    event_date: "2026-04-29",
    event_timestamp_utc: "",
    headline_text: "The Iran conflict’s energy shocks are not yet fully realized",
    source_query: "The Iran conflict’s energy shocks are not yet fully realized",
    source_hint: "conversation_example",
    source_url: "manual://conversation/iran-conflict-energy-shocks",
    tier: "silver",
    review_status: "reviewed",
    coverage_bucket: "existing_type_missing_words",
    final_event_type: "geopolitical_energy",
    theme: "iran_energy_shock",
    channels_hint: "oil_supply_risk|risk_off|inflation_sensitivity",
    polarity_expected: "mixed",
    routing_notes:
      "Semantically still an energy/geopolitical supply-risk headline. Fix by broadening vocabulary, not by creating a new taxonomy class.",
    keyword_additions_suggested: "iran|iranian|energy shock|energy shocks|tehran|persian gulf",
    validation_status: "manual_reviewed_conversation_example",
    timestamp_quality: "",
    contamination_flag: "",
    benchmark_symbol: "",
    benchmark_adjustment_method: "",
    human_notes: "Starter silver example for geopolitical energy vocabulary coverage.",
  },
];

const STARTER_COVERAGE_ROWS = [
  {
    eval_id: "C001",
    headline_text: "OpenAI Misses Key Revenue, User Targets in High-Stakes Sprint Toward IPO",
    expected_bucket: "out_of_scope_current",
    expected_event_type: "",
    expected_polarity: "conditional",
    notes: "Company execution story, not current infra taxonomy.",
  },
  {
    eval_id: "C002",
    headline_text: "Google will invest as much as $40 billion in Anthropic",
    expected_bucket: "existing_type_missing_words",
    expected_event_type: "ai_demand",
    expected_polarity: "positive",
    notes: "Investment/capex-style AI demand signal.",
  },
  {
    eval_id: "C003",
    headline_text:
      "Anthropic debuts preview of powerful new AI model Mythos in new cybersecurity initiative",
    expected_bucket: "out_of_scope_current",
    expected_event_type: "",
    expected_polarity: "conditional",
    notes: "Model launch should remain out of scope for the current taxonomy.",
  },
  {
    eval_id: "C004",
    headline_text:
      "Oil prices close at highest level since 2022 as Iran negotiations fail to ease supply fears",
    expected_bucket: "existing_type_polarity_bug",
    expected_event_type: "geopolitical_energy",
    expected_polarity: "mixed",
    notes: "Should remain an energy shock despite the phrase 'fail to ease'.",
  },
  {
    eval_id: "C005",
    headline_text: "The Iran conflict’s energy shocks are not yet fully realized",
    expected_bucket: "existing_type_missing_words",
    expected_event_type: "geopolitical_energy",
    expected_polarity: "mixed",
    notes: "Existing-type vocabulary miss.",
  },
];

await fs.mkdir(path.join(ROOT_DIR, "scripts"), { recursive: true });

const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, "utf8"));
let masterRows = await loadOrBootstrapMaster(catalog);
validateMasterRows(masterRows, catalog);

const goldRows = masterRows.filter(
  (row) => row.tier === "gold" && row.review_status === "gold_approved",
);
const silverRows = masterRows.filter((row) => row.review_status !== "rejected");

await fs.writeFile(MASTER_PATH, toCsv(MASTER_FIELDS, masterRows), "utf8");
await fs.writeFile(GOLD_PATH, toCsv(MASTER_FIELDS, goldRows), "utf8");
await fs.writeFile(SILVER_PATH, toCsv(MASTER_FIELDS, silverRows), "utf8");

try {
  await fs.access(COVERAGE_EVAL_PATH);
} catch {
  await fs.writeFile(
    COVERAGE_EVAL_PATH,
    toCsv(COVERAGE_EVAL_FIELDS, STARTER_COVERAGE_ROWS),
    "utf8",
  );
}

const countsByType = Object.keys(catalog.eventTypes).reduce((accumulator, eventType) => {
  accumulator[eventType] = goldRows.filter(
    (row) => row.final_event_type === eventType && !isTruthyFlag(row.contamination_flag),
  ).length;
  return accumulator;
}, {});

console.log(
  JSON.stringify(
    {
      masterRows: masterRows.length,
      goldRows: goldRows.length,
      silverRows: silverRows.length,
      goldByType: countsByType,
    },
    null,
    2,
  ),
);

async function loadOrBootstrapMaster(catalogData) {
  try {
    const masterText = await fs.readFile(MASTER_PATH, "utf8");
    return parseCsv(masterText).map((row) => normalizeRow(row));
  } catch {
    const seedText = await fs.readFile(SEED_PATH, "utf8");
    const seedRows = parseCsv(seedText);
    return bootstrapMasterRows(seedRows, catalogData);
  }
}

function bootstrapMasterRows(seedRows, catalogData) {
  const rows = seedRows.map((seedRow) => {
    const eventType = seedRow.event_type;
    const config = catalogData.eventTypes[eventType] || {};

    return normalizeRow({
      event_id: seedRow.event_id,
      event_date: seedRow.event_date,
      event_timestamp_utc: "",
      headline_text: seedRow.event_text,
      source_query: seedRow.source_query,
      source_hint: seedRow.source_hint,
      source_url: seedRow.source_url,
      tier: "gold",
      review_status: "gold_approved",
      coverage_bucket: "",
      final_event_type: eventType,
      theme: seedRow.theme,
      channels_hint: Array.isArray(config.channels) ? config.channels.join("|") : "",
      polarity_expected: DEFAULT_POLARITY_BY_TYPE[eventType] || "conditional",
      routing_notes: "Legacy seeded gold observation migrated from events_seed.csv.",
      keyword_additions_suggested: "",
      validation_status: seedRow.validation_status,
      observed_soxx_amplitude_z: seedRow.observed_soxx_amplitude_z,
      observed_soxx_lag_days: seedRow.observed_soxx_lag_days,
      observed_soxx_decay: seedRow.observed_soxx_decay,
      observed_qqq_amplitude_z: seedRow.observed_qqq_amplitude_z,
      observed_qqq_lag_days: seedRow.observed_qqq_lag_days,
      observed_qqq_decay: seedRow.observed_qqq_decay,
      observed_xlu_amplitude_z: seedRow.observed_xlu_amplitude_z,
      observed_xlu_lag_days: seedRow.observed_xlu_lag_days,
      observed_xlu_decay: seedRow.observed_xlu_decay,
      observed_xle_amplitude_z: seedRow.observed_xle_amplitude_z,
      observed_xle_lag_days: seedRow.observed_xle_lag_days,
      observed_xle_decay: seedRow.observed_xle_decay,
      observed_soxx_d0: "",
      observed_soxx_d1: "",
      observed_soxx_d2: "",
      observed_soxx_d3: "",
      observed_qqq_d0: "",
      observed_qqq_d1: "",
      observed_qqq_d2: "",
      observed_qqq_d3: "",
      observed_xlu_d0: "",
      observed_xlu_d1: "",
      observed_xlu_d2: "",
      observed_xlu_d3: "",
      observed_xle_d0: "",
      observed_xle_d1: "",
      observed_xle_d2: "",
      observed_xle_d3: "",
      timestamp_quality: "",
      contamination_flag: "",
      benchmark_symbol: "",
      benchmark_adjustment_method: "",
      human_notes: "Migrated from legacy seed dataset.",
    });
  });

  STARTER_SILVER_ROWS.forEach((starterRow) => {
    if (!rows.some((row) => row.event_id === starterRow.event_id)) {
      rows.push(normalizeRow(starterRow));
    }
  });

  return rows.sort(compareRows);
}

function validateMasterRows(rows, catalogData) {
  rows.forEach((row) => {
    const id = row.event_id || "<missing event_id>";
    const requiredValues = [
      row.event_id,
      row.event_date,
      row.headline_text,
      row.source_query,
      row.source_hint,
      row.source_url,
      row.tier,
      row.review_status,
    ];

    if (requiredValues.some((value) => value === "")) {
      throw new Error(`Row ${id} is missing required provenance or review fields.`);
    }

    if (!ALLOWED_TIERS.has(row.tier)) {
      throw new Error(`Row ${id} has unsupported tier "${row.tier}".`);
    }

    if (!ALLOWED_REVIEW_STATUSES.has(row.review_status)) {
      throw new Error(`Row ${id} has unsupported review_status "${row.review_status}".`);
    }

    if (!ALLOWED_COVERAGE_BUCKETS.has(row.coverage_bucket)) {
      throw new Error(`Row ${id} has unsupported coverage_bucket "${row.coverage_bucket}".`);
    }

    if (!ALLOWED_POLARITIES.has(row.polarity_expected)) {
      throw new Error(`Row ${id} has unsupported polarity_expected "${row.polarity_expected}".`);
    }

    if (row.final_event_type && !catalogData.eventTypes[row.final_event_type]) {
      throw new Error(`Row ${id} has unknown final_event_type "${row.final_event_type}".`);
    }

    if (row.review_status === "gold_approved") {
      GOLD_RESPONSE_FIELDS.forEach((field) => {
        if (row[field] === "") {
          throw new Error(`Gold-approved row ${id} is missing required field ${field}.`);
        }
      });
    }
  });
}

function normalizeRow(row) {
  const normalized = {};
  MASTER_FIELDS.forEach((field) => {
    normalized[field] = (row[field] ?? "").trim();
  });
  return normalized;
}

function compareRows(left, right) {
  return `${right.event_date}:${right.event_id}`.localeCompare(`${left.event_date}:${left.event_id}`);
}

function isTruthyFlag(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized !== "" && !["0", "false", "no"].includes(normalized);
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
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      pushCell();
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      pushCell();
      pushRow();
      continue;
    }

    current += character;
  }

  if (current !== "" || row.length) {
    pushCell();
    pushRow();
  }

  if (rows.length === 0) {
    return [];
  }

  const [header, ...body] = rows;
  return body.map((cells) => {
    const record = {};
    header.forEach((columnName, index) => {
      record[columnName] = cells[index] ?? "";
    });
    return record;
  });
}

function toCsv(fields, rows) {
  const lines = [fields.join(",")];
  rows.forEach((row) => {
    lines.push(
      fields
        .map((field) => escapeCsv(row[field] ?? ""))
        .join(","),
    );
  });
  return `${lines.join("\n")}\n`;
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}
