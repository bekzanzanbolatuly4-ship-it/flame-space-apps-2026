import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceRecords, FLEX_145_SOURCE_CONFLICT } from "../lib/research/corpus.ts";
import { corpusSchema, evidenceSchema } from "../lib/research/schema.ts";
import { compareEvidence, normalizeMeasurement, searchEvidence } from "../lib/research/engine.ts";
import { validateGroundedAnswer } from "../lib/research/grounding.ts";
import { evaluationQuestions } from "../lib/research/evaluation.ts";
import { samplingTemperatureForModel } from "../lib/research/gemini-model.ts";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const get = (id: string) => evidenceRecords.find((r) => r.id === id)!;
test("all nine primary-source records validate; measurements are separate from derivations", () => {
  assert.equal(corpusSchema.parse(evidenceRecords).length, 9);
  assert.equal(evidenceRecords.filter((r) => r.measurement?.kind === "measured").length, 2);
  assert.equal(evidenceRecords.filter((r) => r.measurement?.kind === "derived").length, 2);
  assert.equal(get("BASS-HEAT").measurement, null);
});
test("FLEX-145 slide 9 and 10 values stay visibly unresolved and are not silently merged", () => {
  assert.equal(FLEX_145_SOURCE_CONFLICT.resolved, false);
  assert.equal(FLEX_145_SOURCE_CONFLICT.slide9.testLabel, "FLEX-145");
  assert.equal(FLEX_145_SOURCE_CONFLICT.slide10.testLabel, "FLEX-145 · C01M201");
  assert.equal(FLEX_145_SOURCE_CONFLICT.slide9.initialDiameter, "3.38 mm");
  assert.equal(FLEX_145_SOURCE_CONFLICT.slide10.initialDiameter, "3.330 mm");
  assert.equal(FLEX_145_SOURCE_CONFLICT.slide9.burningRate, "0.44 m²/s");
  assert.equal(FLEX_145_SOURCE_CONFLICT.slide10.burningRate, "0.448 mm²/s");
  for (const id of ["FLEX-145-INITIAL", "FLEX-145-EXTINCTION", "FLEX-145-RATE"]) {
    const record = get(id);
    assert.match(record.title, /source conflict/);
    assert.match(record.finding, /slide 9/i);
    assert.match(record.finding, /slide 10/i);
    assert.ok(record.limitations.some((limitation) => /does not identify a correction/i.test(limitation)));
  }
});
test("missing/invalid source metadata, duplicates, and unsupported units fail validation", () => {
  const record = get("FLEX-145-INITIAL");
  for (const source of [{ ...record.source, locator: "" }, { ...record.source, url: "https://example.com/paper" }, { ...record.source, verifiedOn: "yesterday" }]) assert.equal(evidenceSchema.safeParse({ ...record, source }).success, false);
  assert.equal(corpusSchema.safeParse([record, record]).success, false);
  assert.equal(evidenceSchema.safeParse({ ...record, measurement: { ...record.measurement, unit: "W" } }).success, false);
  assert.equal(evidenceSchema.safeParse({ ...record, measurement: null }).success, false);
  assert.equal(evidenceSchema.safeParse({ ...record, context: { ...record.context, runId: null } }).success, false);
});
test("ranking is deterministic, transparent and scoped", () => {
  const a = searchEvidence("methanol extinction diameter");
  assert.deepEqual(a, searchEvidence("methanol extinction diameter"));
  assert.equal(a.hits[0].record.id, "FLEX-145-EXTINCTION");
  for (const hit of a.hits) assert.equal(hit.score, Object.values(hit.components).reduce((x, y) => x + y, 0));
  assert.ok(searchEvidence("oxygen", { experimentId: "bass-ii" }).hits.every((h) => h.record.experimentId === "bass-ii"));
});
test("unresolved FLEX-145 source conflict withholds a quantitative within-run delta", () => {
  const comparison = compareEvidence(get("FLEX-145-INITIAL"), get("FLEX-145-EXTINCTION"));
  assert.equal(comparison.kind, "qualitative");
  assert.equal(comparison.delta, null);
  assert.match(comparison.reasons.join(" "), /unresolved slide 9\/10 conflict/);
  const reverse = compareEvidence(get("FLEX-145-EXTINCTION"), get("FLEX-145-INITIAL"));
  assert.equal(reverse.delta, null);
});
test("incompatible experiments, quantities, absent measurements and self-comparisons never produce deltas", () => {
  for (const [a, b] of [["BASS-RATIO", "FLEX-145-EXTINCTION"], ["FLEX-145-RATE", "FLEX-145-INITIAL"], ["BASS-HEAT", "BASS-GASES"], ["FLEX-145-INITIAL", "FLEX-145-INITIAL"]]) {
    const comparison = compareEvidence(get(a), get(b));
    assert.equal(comparison.kind, "qualitative"); assert.equal(comparison.delta, null); assert.ok(comparison.reasons.length);
  }
});
test("unit conversion is explicit and conflicted FLEX-145 inputs remain non-comparable", () => {
  const start = get("FLEX-145-INITIAL"), end = structuredClone(get("FLEX-145-EXTINCTION"));
  end.measurement!.value = .001613; end.measurement!.unit = "m";
  assert.equal(normalizeMeasurement(start.measurement!).value, .00333);
  assert.equal(normalizeMeasurement(end.measurement!).value, .001613);
  end.context.runId = "TEST-FIXTURE-ONLY";
  assert.equal(compareEvidence(start, end).delta, null);
});
test("only retrieved citation identifiers are accepted and links are server-owned", () => {
  const record = get("FLEX-145-EXTINCTION");
  const answer = { claims: [{ text: "The plot reports 1.613 mm.", kind: "reported-fact", evidenceIds: [record.id] }], limitations: ["Uncertainty is unavailable."] };
  assert.equal(validateGroundedAnswer(answer, [record]).sources[0].href, record.source.url);
  assert.equal(validateGroundedAnswer({ ...answer, claims: [{ ...answer.claims[0], text: "FLEX-145 ended with a 1.613 mm droplet." }] }, [record]).sources[0].id, record.id);
  assert.throws(() => validateGroundedAnswer({ ...answer, claims: [{ ...answer.claims[0], text: `See ${record.id}.` }] }, [record]));
  assert.doesNotThrow(() => validateGroundedAnswer({ ...answer, limitations: ["Slide 9 gives conflicting values."] }, [record]));
  for (const id of ["NASA-FAKE", "BASS-SETUP"]) assert.throws(() => validateGroundedAnswer({ ...answer, claims: [{ ...answer.claims[0], evidenceIds: [id] }] }, [record]));
  for (const text of ["See https://evil.example", "Claim [FAKE-123]", "The diameter is 99.99 mm."]) assert.throws(() => validateGroundedAnswer({ ...answer, claims: [{ ...answer.claims[0], text }] }, [record]));
  assert.throws(() => validateGroundedAnswer({ ...answer, claims: [{ ...answer.claims[0], evidenceIds: [] }] }, [record]));
  assert.throws(() => validateGroundedAnswer({ ...answer, limitations: ["Uncertainty is 99.99 mm."] }, [record]));
});
test("installed Google AI SDK recognizes Hydrogen and its request omits ignored temperature", () => {
  const hydrogen = createGoogleGenerativeAI({ apiKey: "test-only-not-used" })("gemini-4-hydrogen");
  assert.equal(hydrogen.modelId, "gemini-4-hydrogen");
  assert.equal(hydrogen.provider, "google.generative-ai");
  assert.equal(hydrogen.specificationVersion, "v4");
  assert.equal(samplingTemperatureForModel("gemini-4-hydrogen"), undefined);
  assert.equal(samplingTemperatureForModel("gemini-4-hydrogen-preview"), undefined);
  assert.equal(samplingTemperatureForModel("gemini-3.5-flash-lite"), 0.1);
});
test("hand-authored scientific evaluation: retrieval recall@3 and unsupported-question rejection", () => {
  let retrieved = 0, rejected = 0;
  for (const item of evaluationQuestions) {
    const result = searchEvidence(item.question);
    if (item.supported) {
      assert.ok(result.hits.slice(0, 3).some((hit) => item.expected.includes(hit.record.id)), item.question);
      assert.notEqual(result.coverage, "insufficient", item.question); retrieved++;
    } else { assert.equal(result.coverage, "insufficient", item.question); rejected++; }
  }
  console.log(`Evaluation: ${retrieved}/9 answerable questions retrieved in top 3; ${rejected}/6 unsupported questions rejected.`);
});
test("gaps distinguish unavailable corpus evidence from unstudied science", () => {
  const result = searchEvidence("Mars fire risk percentage");
  assert.equal(result.coverage, "insufficient");
  assert.match(result.gaps.join(" "), /does not mean NASA has not studied/);
  assert.match(searchEvidence("methanol extinction diameter").gaps.join(" "), /uncertainty is unavailable/);
});
