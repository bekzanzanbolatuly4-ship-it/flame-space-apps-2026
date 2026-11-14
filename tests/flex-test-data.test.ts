import { test } from "node:test";
import assert from "node:assert/strict";
import { flexTestRecords, flexTestRecordsSchema, flexTestSource } from "../lib/research/flex-test-data.ts";
import { flexTestRecords as researchLayerRecords } from "../lib/research/corpus.ts";

const byId = (id: string) => flexTestRecords.find((record) => record.testId === id)!;

test("imports 30 unique, individually sourced FLEX tests into the research data layer", () => {
  assert.equal(flexTestRecords.length, 30);
  assert.equal(researchLayerRecords.length, 30);
  assert.equal(new Set(flexTestRecords.map(({ testId }) => testId)).size, 30);
  assert.equal(new Set(flexTestRecords.map(({ flexIdentifier }) => flexIdentifier)).size, 30);
  assert.equal(flexTestSource.documentId, "NASA/TP-2015-216046");
  assert.equal(flexTestSource.table, "Appendix A, Table IX — Results by Test Number and FLEX Identifier");
  for (const record of flexTestRecords) {
    assert.equal(record.provenance.row, record.testId);
    assert.equal(record.provenance.printedPage, 20);
    assert.equal(record.provenance.valueProvenance, "Source-reported values transcribed from the individual test summary row.");
    assert.equal(record.recordType, "individual-nasa-test");
  }
});

test("source spot checks preserve exact values, units and test-end categories", () => {
  const first = byId("FLEX-001");
  assert.deepEqual([first.flexIdentifier, first.testDateReported, first.testTimeGmt, first.fuel], ["20CAL08", "3/5/09", "17:22:03", "Methanol"]);
  assert.deepEqual([first.ambientPressure, first.ambientComposition], [
    { value: 757.7, unit: "mmHg" },
    { o2: .21, n2: .79, co2: 0, he: 0, unit: "mole fraction" },
  ]);
  assert.deepEqual([first.initialDropletDiameter, first.visibleFlameExtinctionDiameter, first.averageBurningRateConstant, first.burnTime, first.terminationCategory], [
    { value: 1.69, unit: "mm" }, { value: .89, unit: "mm" }, { value: .52, unit: "mm²/s" }, { value: 4.3, unit: "s" }, "Disruption",
  ]);

  const missingExtinction = byId("FLEX-004");
  assert.deepEqual([missingExtinction.initialDropletDiameter, missingExtinction.visibleFlameExtinctionDiameter, missingExtinction.averageBurningRateConstant, missingExtinction.burnTime, missingExtinction.terminationCategory], [
    { value: 2.06, unit: "mm" }, null, { value: .6, unit: "mm²/s" }, { value: 7.64, unit: "s" }, "Extinction",
  ]);
  assert.equal(missingExtinction.missingData[0].field, "visibleFlameExtinctionDiameter");

  const sparse = byId("FLEX-009");
  assert.deepEqual([sparse.flexIdentifier, sparse.testTimeGmt, sparse.ambientPressure, sparse.initialDropletDiameter, sparse.visibleFlameExtinctionDiameter, sparse.averageBurningRateConstant, sparse.burnTime, sparse.terminationCategory], [
    "30CAL07", null, { value: 760, unit: "mmHg" }, null, null, null, null, "Disruption",
  ]);
  assert.deepEqual(sparse.missingData.map(({ field }) => field).sort(), ["averageBurningRateConstant", "burnTime", "initialDropletDiameter", "testTimeGmt", "visibleFlameExtinctionDiameter"].sort());

  const laterRow = byId("FLEX-020");
  assert.deepEqual([laterRow.flexIdentifier, laterRow.fuel, laterRow.ambientPressure, laterRow.ambientComposition, laterRow.initialDropletDiameter, laterRow.visibleFlameExtinctionDiameter, laterRow.averageBurningRateConstant, laterRow.burnTime, laterRow.terminationCategory], [
    "192F001", "Methanol", { value: 539.5, unit: "mmHg" }, { o2: .34, n2: .66, co2: 0, he: 0, unit: "mole fraction" },
    { value: 3.4, unit: "mm" }, { value: 1.56, unit: "mm" }, { value: .53, unit: "mm²/s" }, { value: 17.4, unit: "s" }, "Completion",
  ]);

  const finalImported = byId("FLEX-030");
  assert.deepEqual([finalImported.flexIdentifier, finalImported.testDateReported, finalImported.ambientPressure.value, finalImported.initialDropletDiameter?.value, finalImported.visibleFlameExtinctionDiameter?.value, finalImported.averageBurningRateConstant?.value, finalImported.burnTime?.value, finalImported.terminationCategory], [
    "178F001", "11/13/09", 769.2, 3.26, 1.32, .59, 15.6, "Extinction",
  ]);
});

test("units, finite values and source dashes are validated without replacing missing values with zero", () => {
  const zeroComposition = byId("FLEX-001");
  assert.equal(zeroComposition.ambientComposition.co2, 0);
  assert.equal(zeroComposition.ambientComposition.he, 0);
  assert.equal(zeroComposition.missingData.some(({ field }) => field === "visibleFlameExtinctionDiameter"), false);

  const missing = byId("FLEX-009");
  const badUnit = structuredClone(missing);
  badUnit.ambientPressure.unit = "Pa" as "mmHg";
  assert.equal(flexTestRecordsSchema.safeParse([...flexTestRecords.filter(({ testId }) => testId !== missing.testId), badUnit]).success, false);

  const missingMarkerLost = structuredClone(missing);
  missingMarkerLost.missingData = missingMarkerLost.missingData.slice(1);
  assert.equal(flexTestRecordsSchema.safeParse([...flexTestRecords.filter(({ testId }) => testId !== missing.testId), missingMarkerLost]).success, false);

  const duplicate = [...flexTestRecords, flexTestRecords[0]];
  assert.equal(flexTestRecordsSchema.safeParse(duplicate).success, false);
  const nonFinite = structuredClone(flexTestRecords);
  nonFinite[0].ambientPressure.value = Number.NaN;
  assert.equal(flexTestRecordsSchema.safeParse(nonFinite).success, false);
});
