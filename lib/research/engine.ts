import { evidenceRecords, FLEX_145_SOURCE_CONFLICT } from "./corpus.ts";
import { evidenceSchema, type Evidence, type ExperimentId, type Measurement } from "./schema.ts";

import { retrieveIndividualTests } from "./test-retrieval.ts";

const stopWords = new Set("a an the what which how why when where does do did is are was were be been can could would should for in on of to from and or with about by as at it its this that these those nasa research study studies experiment experiments tell me please reported report show shows explain compare versus vs between results result finding findings much many describe give any there available evidence scientific".split(" "));
const aliases: Record<string, string> = { o2: "oxygen", co2: "dioxide", co: "monoxide", air: "airflow", ventilation: "airflow", extinction: "extinction", extinguish: "extinction", extinguished: "extinction", extinguishing: "extinction", extinguishment: "extinction", droplets: "droplet", solids: "solid", conditions: "condition", temperatures: "temperature", fuels: "fuel", measurements: "measurement", measured: "measurement", suppressants: "suppressant", suppression: "suppressant", burns: "burning", burn: "burning", sizes: "size", limits: "limit", geometries: "geometry" };
export function tokenize(value: string): string[] {
  return [...new Set(value.toLowerCase().replaceAll("₂", "2").replaceAll("₀", "0").match(/[a-z0-9]+(?:\.[0-9]+)?/g)?.filter((v) => !stopWords.has(v)).map((v) => aliases[v] ?? v) ?? [])];
}
function searchable(record: Evidence) {
  // Limits are deliberately excluded: mentioning absent data must not make it an answer.
  return [record.id, record.experimentName, record.title, record.summary, record.finding, record.fuel, record.materialCategory, ...record.topics, ...record.conditions.map((c) => `${c.label} ${c.value}`)].join(" ");
}
const unsupportedPatterns = /\b(mars|martian|lunar|moon|radiation|battery|batteries|polypropylene|risk|probability|percent(?:age)?\s+(?:safe|risk)|certif\w*|safest|best suppressant|safe oxygen|safe concentration)\b/i;
export type SearchHit = { record: Evidence; score: number; reasons: string[]; matchedTerms: string[]; components: { relevance: number; conditions: number; directness: number; measurements: number; comparability: number; completeness: number } };
export type SearchResult = { query: string; hits: SearchHit[]; coverage: "supported" | "partial" | "insufficient"; gaps: string[]; unmatchedTerms: string[] };

export function searchEvidence(query: string, options: { experimentId?: ExperimentId; compareTo?: string } = {}, records = evidenceRecords): SearchResult {
  const terms = tokenize(query);
  const individual = records === evidenceRecords ? retrieveIndividualTests(query) : [];
  const exactIds: string[] = query.toUpperCase().match(/\bFLEX-\d{3}\b/g) ?? [];
  const explicitFlex = individual.length > 0 || /\bflex\b|methanol|droplet/i.test(query);
  const explicitBass = /\bbass(?:-ii)?\b/i.test(query);
  const scope = explicitFlex && explicitBass ? undefined : explicitFlex ? "flex" : explicitBass ? "bass-ii" : options.experimentId;
  const scoped = [...records, ...individual].filter(r => (!scope || r.experimentId === scope)
    && (!exactIds.length || exactIds.some(id => r.context.runId === id || r.id.startsWith(`${id}-`))));
  const reference = records.find((r) => r.id === options.compareTo);
  const hits = scoped.flatMap((record): SearchHit[] => {
    const indexed = new Set(tokenize(searchable(record)));
    const matchedTerms = terms.filter((term) => indexed.has(term));
    if (terms.length && !matchedTerms.length) return [];
    const conditions = new Set(tokenize(record.conditions.map((c) => `${c.label} ${c.value}`).join(" ")));
    const conditionMatches = matchedTerms.filter((term) => conditions.has(term));
    const focusTerms = new Set(tokenize(`${record.title} ${record.topics.join(" ")}`));
    const focusMatches = terms.filter((term) => focusTerms.has(term));
    const components = {
      relevance: terms.length ? Math.round(45 * matchedTerms.length / terms.length + 20 * focusMatches.length / terms.length) : 0,
      conditions: terms.length ? Math.round(10 * conditionMatches.length / terms.length) : 0,
      directness: ["measurement", "derived-result"].includes(record.evidenceType) ? 8 : record.evidenceType === "qualitative-finding" ? 6 : record.evidenceType === "media-observation" ? 4 : 2,
      measurements: record.measurement?.kind === "measured" ? 6 : record.measurement ? 3 : 0,
      comparability: reference && compareEvidence(reference, record).kind === "quantitative" ? 5 : 0,
      completeness: record.source.locator && record.source.verifiedOn ? 6 : 0,
    };
    return [{ record, components, matchedTerms, score: Object.values(components).reduce((a, b) => a + b, 0), reasons: [
      `Question terms: ${matchedTerms.length}/${terms.length || 0}; ${focusMatches.length} title/topic matches (${components.relevance}/65: coverage up to 45, focus up to 20).`,
      `Condition terms: ${conditionMatches.join(", ") || "none"} (${components.conditions}/10); a text match does not establish identical trial conditions.`,
      `Evidence type: ${record.evidenceType} (${components.directness}/8).`,
      `Numeric evidence: ${record.measurement?.kind ?? "none"} (${components.measurements}/6).`,
      `Compatible reference comparison: ${components.comparability ? "yes" : "not established"} (${components.comparability}/5).`,
      `Source URL, locator and verification date present (${components.completeness}/6).`,
    ] }];
  }).sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id, "en"));
  const covered = new Set(hits.flatMap((h) => h.matchedTerms));
  const unmatchedTerms = terms.filter((t) => !covered.has(t));
  const bestCoverage = terms.length ? Math.max(0, ...hits.map((h) => h.matchedTerms.length / terms.length)) : 0;
  const unsupported = unsupportedPatterns.test(query) || !hits.length || (terms.length > 0 && bestCoverage < .5);
  // Numeric questions require actual numeric observations, not a procedure or a mention in prose.
  const quantitativeQuestion = /\b(how much|how many|exact|numerical|temperature|uncertainty|confidence interval)\b/i.test(query);
  const missingNumeric = (quantitativeQuestion && !hits.some((h) => h.record.measurement && h.components.relevance >= 32)) || /\b(temperature|uncertainty|confidence interval)\b/i.test(query);
  const coverage = unsupported || missingNumeric ? "insufficient" : unmatchedTerms.length ? "partial" : "supported";
  const selected = hits.slice(0, 6);
  return { query, hits: selected, coverage, unmatchedTerms, gaps: detectGaps(query, selected.map((h) => h.record), coverage, unmatchedTerms) };
}

export function detectGaps(query: string, records: Evidence[], coverage: SearchResult["coverage"], unmatched: string[] = []) {
  const gaps = ["Coverage is limited to this curated corpus; absence here does not mean NASA has not studied the question."];
  if (coverage === "insufficient") gaps.push("Insufficient evidence to answer this question from the available records. Related results below are not an answer.");
  if (unmatched.length) gaps.push(`These query terms did not match the searched records (not a claim that NASA evidence is absent): ${unmatched.join(", ")}.`);
  if (unsupportedPatterns.test(query)) gaps.push("The requested environment, material or safety conclusion is outside this corpus's verified scope.");
  if (!records.some((r) => r.measurement)) gaps.push("These retrieved records do not supply exact measurements for the question; individual Data Lab tests can be retrieved by their test identifiers.");
  const missing = [...new Set(records.flatMap((r) => r.missingParameters))];
  if (missing.length) gaps.push(`Missing parameters: ${missing.join("; ")}.`);
  if (records.some((r) => r.measurement?.uncertainty === null)) gaps.push("Numerical uncertainty is unavailable; error bars and statistical significance cannot be calculated.");
  if (new Set(records.map((r) => r.materialCategory)).size > 1) gaps.push("Solid samples and liquid droplets are different systems; no cross-system numerical difference is justified.");
  return gaps;
}

export function normalizeMeasurement(value: Measurement) {
  const factors: Record<Measurement["unit"], number> = { mm: .001, m: 1, "mm²/s": .000001, "m²/s": 1, W: 1, kW: 1000, "1": 1 };
  const units: Record<Measurement["quantity"], string> = { "droplet-diameter": "m", "burning-rate-constant": "m²/s", "heat-release-rate": "W", "equivalence-ratio": "1" };
  return { value: value.value * factors[value.unit], unit: units[value.quantity] };
}
export type Comparison = { kind: "qualitative" | "quantitative"; reasons: string[]; context: { id: string; material: string; fuel: string; apparatus: string; finding: string; source: Evidence["source"] }[]; delta: { value: number; unit: string; kind: "derived"; formula: string } | null; limitations: string[] };
export function compareEvidence(left: Evidence, right: Evidence): Comparison {
  evidenceSchema.parse(left); evidenceSchema.parse(right);
  const reasons: string[] = [];
  const conflictedIds = new Set<string>(FLEX_145_SOURCE_CONFLICT.recordIds);
  const sourceConflict = conflictedIds.has(left.id) || conflictedIds.has(right.id);
  if (sourceConflict) {
    reasons.push("The NASA source has an unresolved slide 9/10 conflict for FLEX-145; quantitative comparisons using these disputed values are withheld.");
  }
  const a = left.measurement, b = right.measurement;
  if (left.id === right.id) reasons.push("Choose distinct records; a record is not an independent replicate of itself.");
  if (left.materialCategory !== right.materialCategory || left.apparatus !== right.apparatus) reasons.push("Different experimental systems (material or apparatus).");
  if (!a || !b) reasons.push("Both records must contain exact numerical observations; document summaries cannot supply missing measurements.");
  if (a && b && (a.quantity !== b.quantity || a.statistic !== b.statistic || a.kind !== b.kind)) reasons.push("Quantities, statistics or measured/derived status do not match.");
  const sameRun = !!left.context.runId && left.context.runId === right.context.runId;
  const withinRun = sameRun && a?.quantity === "droplet-diameter" && b?.quantity === "droplet-diameter" && new Set([left.context.stage, right.context.stage]).has("initial") && new Set([left.context.stage, right.context.stage]).has("extinction");
  if (!withinRun) {
    for (const key of ["gravity", "pressurePa", "gasComposition", "flow", "support"] as const) {
      if (left.context[key] === null || right.context[key] === null) reasons.push(`Missing matched ${key}; quantitative comparability is not established.`);
      else if (left.context[key] !== right.context[key]) reasons.push(`Different ${key}.`);
    }
    if (left.fuel !== right.fuel || left.context.stage !== right.context.stage) reasons.push("Fuel or observation stage differs.");
    if (sameRun) reasons.push(sourceConflict
      ? "The same-run label does not resolve the conflicting source values; no initial-to-extinction delta is reported."
      : "Same-run records are not independent trials; only an explicit initial-to-extinction diameter change is supported.");
  } else if (left.fuel !== right.fuel || left.context.pressurePa !== right.context.pressurePa || left.context.gasComposition !== right.context.gasComposition) reasons.push("Conflicting context within the identified run.");
  const compatible = !reasons.length && a && b;
  const delta = compatible ? { value: Number(((normalizeMeasurement(b).value - normalizeMeasurement(a).value) / (a.unit === "mm" ? .001 : a.unit === "mm²/s" ? .000001 : a.unit === "kW" ? 1000 : 1)).toPrecision(10)), unit: a.unit, kind: "derived" as const, formula: `${right.id} minus ${left.id}; unit-normalized subtraction` } : null;
  return { kind: delta ? "quantitative" : "qualitative", delta, reasons: delta ? [withinRun ? "Within-run diameter change: initial and extinction observations of the same FLEX-145 droplet. This is not a comparison of independent trials, a rate or a hazard score." : "Quantity, units, observation stage and recorded conditions match; descriptive difference only."] : reasons,
    context: [left, right].map((r) => ({ id: r.id, material: r.materialCategory, fuel: r.fuel, apparatus: r.apparatus, finding: r.finding, source: r.source })),
    limitations: [...new Set([...left.limitations, ...right.limitations, "No uncertainty propagation or statistical inference is possible from these records."])],
  };
}
