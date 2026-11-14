import assert from "node:assert/strict";
import test from "node:test";
import { D2_MODEL_ASSUMPTIONS, evaluateDropletD2, evaluateFlex145Droplet, FLEX_145_D2_PARAMETERS } from "../lib/physics/droplet-d2.ts";

const illustrative = {
  initialDiameterM: 0.01,
  extinctionDiameterM: 0.002,
  effectiveRateM2PerS: 2e-6,
  provenance: [],
};

test("d² model preserves initial conditions and SI provenance", () => {
  const result = evaluateFlex145Droplet(0);
  assert.equal(result.diameterM, 0.00333);
  assert.equal(result.normalizedProgress, 0);
  assert.equal(result.status, "active");
  assert.equal(result.provenance[0].category, "observed");
  assert.equal(result.provenance[2].category, "derived");
  assert.ok(result.provenance.every((item) => item.sourceStatus === "unresolved-source-conflict"));
  assert.match(result.provenance[2].sourceUrl, /^https:\/\/.*nasa\.gov/);
  assert.equal(FLEX_145_D2_PARAMETERS.effectiveRateM2PerS, 0.448e-6);
  const expectedModelDuration = (0.00333 ** 2 - 0.001613 ** 2) / 0.448e-6;
  assert.ok(Math.abs(result.modeledDurationSeconds - expectedModelDuration) < 1e-12);
  assert.ok(result.limitations.some((limitation) => /conditional scenarios, not resolved experimental values/.test(limitation)));
  assert.ok(result.provenance.every((source) => source.locator.includes("Slide 10")));
});

test("analytical d² solution matches independently calculated intermediate diameter", () => {
  const result = evaluateDropletD2(illustrative, 12);
  const expectedDiameterM = Math.sqrt(0.01 ** 2 - 2e-6 * 12);
  assert.ok(Math.abs(result.diameterM - expectedDiameterM) < 1e-15);
  assert.ok(Math.abs(result.diameterSquaredM2 - (0.01 ** 2 - 2e-6 * 12)) < 1e-18);
  assert.equal(result.modeledDurationSeconds, 48);
  assert.equal(result.normalizedProgress, 0.25);
});

test("model terminates at finite reported extinction and stays there afterward", () => {
  const duration = ((illustrative.initialDiameterM - illustrative.extinctionDiameterM) * (illustrative.initialDiameterM + illustrative.extinctionDiameterM)) / illustrative.effectiveRateM2PerS;
  const atEnd = evaluateDropletD2(illustrative, duration);
  const afterEnd = evaluateDropletD2(illustrative, duration * 2);
  assert.equal(atEnd.diameterM, illustrative.extinctionDiameterM);
  assert.equal(atEnd.normalizedProgress, 1);
  assert.equal(atEnd.status, "terminated");
  assert.equal(afterEnd.diameterM, illustrative.extinctionDiameterM);
  assert.equal(afterEnd.status, "terminated");
  assert.equal(afterEnd.validity, "terminated-at-reported-extinction");
});

test("rejects invalid parameters, units by convention, and elapsed time", () => {
  assert.throws(() => evaluateDropletD2({ ...illustrative, initialDiameterM: 0 }, 0), RangeError);
  assert.throws(() => evaluateDropletD2({ ...illustrative, effectiveRateM2PerS: 0 }, 0), RangeError);
  assert.throws(() => evaluateDropletD2({ ...illustrative, extinctionDiameterM: 0.01 }, 0), RangeError);
  assert.throws(() => evaluateDropletD2({ ...illustrative, initialDiameterM: 1e308, extinctionDiameterM: 0, effectiveRateM2PerS: 1e-308 }, 0), RangeError);
  assert.throws(() => evaluateDropletD2(illustrative, -1), RangeError);
  assert.throws(() => evaluateDropletD2(illustrative, Number.POSITIVE_INFINITY), RangeError);
  assert.equal(D2_MODEL_ASSUMPTIONS.some((item) => item.includes("outside the reported FLEX-145 regime")), true);
  assert.equal(D2_MODEL_ASSUMPTIONS.some((item) => item.includes("slides 9 and 10") && item.includes("conditional scenarios")), true);
});

test("near-endpoint arithmetic remains finite and evaluation is deterministic", () => {
  const close = { ...illustrative, initialDiameterM: 1, extinctionDiameterM: 1 - 1e-12, effectiveRateM2PerS: 1 };
  const half = evaluateDropletD2(close, 1e-12);
  assert.ok(Number.isFinite(half.diameterM));
  assert.ok(half.diameterM >= close.extinctionDiameterM && half.diameterM <= close.initialDiameterM);
  assert.deepEqual(evaluateFlex145Droplet(4.2), evaluateFlex145Droplet(4.2));
});
