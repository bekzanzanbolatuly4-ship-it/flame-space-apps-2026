import { test } from "node:test";
import assert from "node:assert/strict";
import { flexTestRecords } from "../lib/research/corpus.ts";
import { assessFlexComparability, filterFlexTests, getFlexPlotSamples, selectFlexTestPair, type FlexTestFilters } from "../lib/research/flex-data-lab.ts";

const allFilters: FlexTestFilters = { fuel: "all", oxygen: "all", pressureMin: 0, pressureMax: Number.MAX_VALUE, outcome: "all" };

test("filters use only reported fuel, oxygen, pressure and test-end fields", () => {
  assert.equal(filterFlexTests(flexTestRecords, allFilters).length, 30);
  const heptane = filterFlexTests(flexTestRecords, { ...allFilters, fuel: "Heptane" });
  assert.ok(heptane.length > 0 && heptane.every((record) => record.fuel === "Heptane"));
  const lowOxygen = filterFlexTests(flexTestRecords, { ...allFilters, oxygen: .21 });
  assert.ok(lowOxygen.length > 0 && lowOxygen.every((record) => record.ambientComposition.o2 === .21));
  const pressureBand = filterFlexTests(flexTestRecords, { ...allFilters, pressureMin: 757, pressureMax: 763 });
  assert.ok(pressureBand.length > 0 && pressureBand.every(({ ambientPressure }) => ambientPressure.value >= 757 && ambientPressure.value <= 763));
  const completions = filterFlexTests(flexTestRecords, { ...allFilters, outcome: "Completion" });
  assert.ok(completions.length > 0 && completions.every(({ terminationCategory }) => terminationCategory === "Completion"));
});

test("plot samples are exactly records with both source-reported variables; missing is never zero-filled", () => {
  const samples = getFlexPlotSamples(flexTestRecords);
  const expected = flexTestRecords.filter(({ initialDropletDiameter, averageBurningRateConstant }) => initialDropletDiameter !== null && averageBurningRateConstant !== null);
  assert.deepEqual(samples.map(({ record }) => record.testId), expected.map(({ testId }) => testId));
  assert.ok(samples.every(({ initialDiameterMm, averageBurningRateMm2PerS }) => Number.isFinite(initialDiameterMm) && Number.isFinite(averageBurningRateMm2PerS)));
  assert.ok(!samples.some(({ record }) => record.testId === "FLEX-009" || record.testId === "FLEX-024"));
  assert.equal(samples.find(({ record }) => record.testId === "FLEX-001")?.averageBurningRateMm2PerS, .52);
});

test("point selection always maintains two distinct eligible tests", () => {
  const initial: [string, string] = ["FLEX-001", "FLEX-002"];
  assert.deepEqual(selectFlexTestPair(initial, "FLEX-003", ["FLEX-001", "FLEX-002", "FLEX-003"]), ["FLEX-001", "FLEX-003"]);
  assert.deepEqual(selectFlexTestPair(initial, "FLEX-001", ["FLEX-001", "FLEX-002"]), ["FLEX-002", "FLEX-001"]);
  assert.deepEqual(selectFlexTestPair(initial, "FLEX-030", ["FLEX-001", "FLEX-002"]), initial);
});

test("comparability reports condition differences, cautious matched conditions and missing metadata", () => {
  const left = flexTestRecords.find(({ testId }) => testId === "FLEX-001")!;
  const different = flexTestRecords.find(({ testId }) => testId === "FLEX-002")!;
  const changed = assessFlexComparability(left, different);
  assert.equal(changed.status, "different-conditions");
  assert.ok(changed.differences.some((difference) => difference.includes("Ambient pressure")));
  assert.match(changed.note, /does not isolate a single causal variable/);

  const sameConditions = structuredClone(left);
  sameConditions.testId = "FLEX-002";
  sameConditions.provenance.row = "FLEX-002";
  const matched = assessFlexComparability(left, sameConditions);
  assert.equal(matched.status, "comparable-recorded-conditions");
  assert.match(matched.note, /does not establish full experimental equivalence/);

  assert.equal(assessFlexComparability(left, undefined).status, "insufficient-metadata");
  const incomplete = structuredClone(left);
  (incomplete.ambientComposition as unknown as { co2: number | null }).co2 = null;
  assert.equal(assessFlexComparability(left, incomplete).status, "insufficient-metadata");
});
