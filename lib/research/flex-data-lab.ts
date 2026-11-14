import type { FlexTestRecord } from "./flex-test-data.ts";

export type FlexFuelFilter = "all" | "Methanol" | "Heptane";
export type FlexOutcomeFilter = "all" | FlexTestRecord["terminationCategory"];
export type FlexTestFilters = {
  fuel: FlexFuelFilter;
  oxygen: "all" | number;
  pressureMin: number;
  pressureMax: number;
  outcome: FlexOutcomeFilter;
};

export type FlexPlotSample = {
  record: FlexTestRecord;
  initialDiameterMm: number;
  averageBurningRateMm2PerS: number;
};

export function filterFlexTests(records: readonly FlexTestRecord[], filters: FlexTestFilters) {
  const pressureLow = Math.min(filters.pressureMin, filters.pressureMax);
  const pressureHigh = Math.max(filters.pressureMin, filters.pressureMax);
  return records.filter((record) =>
    (filters.fuel === "all" || record.fuel === filters.fuel) &&
    (filters.oxygen === "all" || record.ambientComposition.o2 === filters.oxygen) &&
    (filters.outcome === "all" || record.terminationCategory === filters.outcome) &&
    record.ambientPressure.value >= pressureLow &&
    record.ambientPressure.value <= pressureHigh,
  );
}

export function getFlexPlotSamples(records: readonly FlexTestRecord[]): FlexPlotSample[] {
  return records.flatMap((record) => {
    const initialDiameterMm = record.initialDropletDiameter?.value;
    const averageBurningRateMm2PerS = record.averageBurningRateConstant?.value;
    if (initialDiameterMm === undefined || averageBurningRateMm2PerS === undefined) return [];
    return [{ record, initialDiameterMm, averageBurningRateMm2PerS }];
  });
}

export function selectFlexTestPair(current: readonly [string, string], clickedId: string, eligibleIds: readonly string[]): [string, string] {
  if (!eligibleIds.includes(clickedId)) return [current[0], current[1]];
  if (clickedId === current[0]) return [current[1], current[0]];
  return [current[0], clickedId];
}

export type FlexComparability = {
  status: "comparable-recorded-conditions" | "different-conditions" | "insufficient-metadata";
  title: string;
  differences: string[];
  note: string;
};

export function assessFlexComparability(left?: FlexTestRecord, right?: FlexTestRecord): FlexComparability {
  if (!left || !right) return {
    status: "insufficient-metadata",
    title: "Insufficient metadata to establish comparability",
    differences: [],
    note: "Select two distinct NASA test records with available condition fields.",
  };

  const conditions = [
    { label: "Fuel", a: left.fuel, b: right.fuel },
    { label: "Ambient pressure", a: left.ambientPressure?.value, b: right.ambientPressure?.value, unit: "mmHg" },
    { label: "O₂ mole fraction", a: left.ambientComposition?.o2, b: right.ambientComposition?.o2 },
    { label: "N₂ mole fraction", a: left.ambientComposition?.n2, b: right.ambientComposition?.n2 },
    { label: "CO₂ mole fraction", a: left.ambientComposition?.co2, b: right.ambientComposition?.co2 },
    { label: "He mole fraction", a: left.ambientComposition?.he, b: right.ambientComposition?.he },
  ];
  if (conditions.some(({ a, b }) => a === null || a === undefined || b === null || b === undefined || (typeof a === "number" && !Number.isFinite(a)) || (typeof b === "number" && !Number.isFinite(b)))) {
    return {
      status: "insufficient-metadata",
      title: "Insufficient metadata to establish comparability",
      differences: [],
      note: "One or more reported fuel or ambient-condition fields are unavailable.",
    };
  }

  const differences = conditions.flatMap(({ label, a, b, unit }) => a === b ? [] : [`${label}: ${a}${unit ? ` ${unit}` : ""} vs ${b}${unit ? ` ${unit}` : ""}`]);
  if (differences.length) return {
    status: "different-conditions",
    title: "Different experimental conditions",
    differences,
    note: "Differences are descriptive. This pair does not isolate a single causal variable.",
  };

  return {
    status: "comparable-recorded-conditions",
    title: "Comparable recorded conditions",
    differences: [],
    note: "Fuel, pressure and listed gas fractions match. This does not establish full experimental equivalence; other setup details and uncertainty are not represented here.",
  };
}
