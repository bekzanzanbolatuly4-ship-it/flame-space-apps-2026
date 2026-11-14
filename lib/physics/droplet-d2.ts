import { evidenceRecords } from "../research/corpus.ts";

export type ParameterProvenance = {
  parameter: "initialDiameterM" | "extinctionDiameterM" | "effectiveRateM2PerS";
  category: "observed" | "derived";
  sourceStatus: "unresolved-source-conflict";
  recordId: string;
  sourceUrl: string;
  locator: string;
};

export type DropletD2Parameters = {
  initialDiameterM: number;
  extinctionDiameterM: number;
  effectiveRateM2PerS: number;
  provenance: ParameterProvenance[];
};

export type DropletD2Result = {
  elapsedSeconds: number;
  diameterM: number;
  diameterSquaredM2: number;
  normalizedProgress: number;
  modeledDurationSeconds: number;
  status: "active" | "terminated";
  validity: "within-model-domain" | "terminated-at-reported-extinction";
  limitations: string[];
  provenance: ParameterProvenance[];
};

export const D2_MODEL_ASSUMPTIONS = [
  "A spherical droplet follows a constant effective d²-law rate between the reported initial and extinction diameters.",
  "The effective rate is an average for FLEX-145; no raw time series or fit interval is available in the evidence record.",
  "Extinction is represented by the reported finite droplet diameter, not by complete droplet consumption.",
  "The model does not resolve unsteady burning, flame structure, temperature, transport, or changes in experimental conditions.",
  "The d²-law approximation may fail during transient ignition, near extinction, or outside the reported FLEX-145 regime.",
  "This is a single-run explanatory model, not a validated prediction or a general microgravity combustion simulation.",
  "NASA source slides 9 and 10 both identify FLEX-145 but conflict on diameters, diluent order, and burning-rate value or units. FLEX_145_D2_PARAMETERS uses slide 10 only; results are conditional scenarios, not resolved experimental values.",
] as const;

function finitePositive(value: number, name: string, allowZero = false) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new RangeError(`${name} must be a finite ${allowZero ? "non-negative" : "positive"} SI value.`);
  }
}

function validateParameters(parameters: DropletD2Parameters) {
  finitePositive(parameters.initialDiameterM, "Initial diameter");
  finitePositive(parameters.extinctionDiameterM, "Extinction diameter", true);
  finitePositive(parameters.effectiveRateM2PerS, "Effective rate");
  if (parameters.extinctionDiameterM >= parameters.initialDiameterM) {
    throw new RangeError("Extinction diameter must be smaller than initial diameter.");
  }
}

/** Evaluates D² = D₀² − Kt until the supplied finite extinction diameter. All inputs and outputs use SI units. */
export function evaluateDropletD2(parameters: DropletD2Parameters, elapsedSeconds: number): DropletD2Result {
  validateParameters(parameters);
  finitePositive(elapsedSeconds, "Elapsed time", true);

  const { initialDiameterM: d0, extinctionDiameterM: dext, effectiveRateM2PerS: rate } = parameters;
  // Factored subtraction avoids loss of precision when endpoint diameters are close.
  const duration = ((d0 - dext) * (d0 + dext)) / rate;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError("The parameter combination does not produce a finite positive model duration.");
  }
  const terminated = elapsedSeconds >= duration;
  const modeledTime = terminated ? duration : elapsedSeconds;
  const diameterSquaredM2 = terminated ? dext * dext : Math.max(dext * dext, d0 * d0 - rate * modeledTime);
  const diameterM = terminated ? dext : Math.sqrt(Math.max(0, diameterSquaredM2));

  return {
    elapsedSeconds,
    diameterM,
    diameterSquaredM2: diameterM * diameterM,
    normalizedProgress: Math.min(1, modeledTime / duration),
    modeledDurationSeconds: duration,
    status: terminated ? "terminated" : "active",
    validity: terminated ? "terminated-at-reported-extinction" : "within-model-domain",
    limitations: [...D2_MODEL_ASSUMPTIONS],
    provenance: parameters.provenance.map((item) => ({ ...item })),
  };
}

function slideTenParameter(recordId: string, parameter: ParameterProvenance["parameter"], convert: (value: number) => number): { value: number; provenance: ParameterProvenance } {
  const record = evidenceRecords.find((item) => item.id === recordId);
  if (!record?.measurement) throw new Error(`Slide 10 model record ${recordId} is missing its source value.`);
  return {
    value: convert(record.measurement.value),
    provenance: { parameter, category: record.measurement.kind === "measured" ? "observed" : "derived", sourceStatus: "unresolved-source-conflict", recordId, sourceUrl: record.source.url, locator: record.source.locator },
  };
}

const initial = slideTenParameter("FLEX-145-INITIAL", "initialDiameterM", (value) => value / 1000);
const extinction = slideTenParameter("FLEX-145-EXTINCTION", "extinctionDiameterM", (value) => value / 1000);
const effectiveRate = slideTenParameter("FLEX-145-RATE", "effectiveRateM2PerS", (value) => value * 1e-6);

/** Conditional FLEX-145 scenario parameters using slide 10 only; NASA's slide 9 conflict remains unresolved. */
export const FLEX_145_D2_PARAMETERS: Readonly<DropletD2Parameters> = Object.freeze({
  initialDiameterM: initial.value,
  extinctionDiameterM: extinction.value,
  effectiveRateM2PerS: effectiveRate.value,
  provenance: [initial.provenance, extinction.provenance, effectiveRate.provenance],
});

export function evaluateFlex145Droplet(elapsedSeconds: number): DropletD2Result {
  return evaluateDropletD2(FLEX_145_D2_PARAMETERS, elapsedSeconds);
}
