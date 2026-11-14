import { corpusSchema, type Evidence } from "./schema.ts";
import { flexTestSource } from "./flex-test-data.ts";

export { flexTestRecords, flexTestRecordCount, flexTestSource } from "./flex-test-data.ts";

const verifiedOn = "2026-11-14";
const bassSource = { id: "NTRS-20210011385", title: "BASS-II Summary Report", url: "https://ntrs.nasa.gov/citations/20210011385", locator: "NTRS record · Abstract · October 2021 report", verifiedOn };
const plotSource = { id: "NTRS-20130010979", title: "Dynamics of Water Absorption and Evaporation During Methanol Droplet Combustion in Microgravity", url: "https://ntrs.nasa.gov/api/citations/20130010979/downloads/20130010979.pdf#page=10", locator: "Slide 10 of 15, MeOH Burning History, FLEX-145 plot inset; visually checked", verifiedOn };
export const FLEX_145_SOURCE_CONFLICT = {
  resolved: false,
  recordIds: ["FLEX-145-INITIAL", "FLEX-145-EXTINCTION", "FLEX-145-RATE"],
  sourceUrl: "https://ntrs.nasa.gov/api/citations/20130010979/downloads/20130010979.pdf",
  slide9: {
    page: 9,
    testLabel: "FLEX-145",
    fuel: "Methanol",
    pressure: "1.0 atm",
    composition: "20% O₂ / 75% CO₂ / 5% N₂",
    initialDiameter: "3.38 mm",
    extinctionDiameter: "1.66 (unit not repeated on slide 9)",
    burningRate: "0.44 m²/s",
  },
  slide10: {
    page: 10,
    testLabel: "FLEX-145 · C01M201",
    date: "Tue, Nov 16, 2010",
    fuel: "Methanol",
    pressure: "763.468 mmHg",
    composition: "O₂ 0.199 / N₂ 0.749 / CO₂ 0.050 / He 0.000",
    initialDiameter: "3.330 mm",
    extinctionDiameter: "1.613 mm",
    burningRate: "0.448 mm²/s",
  },
  note: "Both slides identify FLEX-145 and methanol, but the presentation does not state that one slide corrects the other or explain the numerical, unit, and diluent-order differences.",
} as const;
const psiSource = { id: "PSI-69", title: "FLEX investigation · PSI-69 · DOI 10.60555/mbq8-0451", url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-69", locator: "Version 5: Project, Objectives, Approach and Hardware sections", verifiedOn };
const svsSource = { id: "SVS-11318", title: "Great Balls Of Fire", url: "https://svs.gsfc.nasa.gov/11318/", locator: "Introductory explanation and caption of ISS_FlexFlame-540-MASTER_high.mp4", verifiedOn };

const bassBase = {
  experimentId: "bass-ii", experimentName: "Burning and Suppression of Solids–II",
  objective: "Study small-scale solid combustion while varying oxygen concentration, ventilation flow, and fuel type, thickness and geometry.",
  platform: "International Space Station · Microgravity Science Glovebox", apparatus: "BASS-II contained flow duct",
  materialCategory: "solid", fuel: "Solid samples; multiple types and geometries",
  conditions: [
    { label: "Environment", value: "Microgravity aboard the ISS", role: "reported-condition" },
    { label: "Oxygen / airflow", value: "Oxygen concentration and ventilation velocity varied", role: "varied-parameter" },
    { label: "Material", value: "Fuel type, thickness and geometry varied", role: "varied-parameter" },
    { label: "Atmosphere control", value: "Nitrogen dilution of the glovebox working volume", role: "protocol" },
  ],
  context: { runId: null, stage: "investigation", gravity: "microgravity", pressurePa: null, gasComposition: null, flow: null, support: null },
  source: bassSource, measurement: null, availability: "document-only",
  missingParameters: ["Trial identifiers", "Per-trial oxygen concentration", "Per-trial airflow", "Per-trial fuel geometry", "Measurement uncertainty"],
  limitations: ["Abstract-level evidence aggregates different fuels and conditions; no trial rows have been transcribed into this corpus."],
} satisfies Partial<Evidence>;
const flexBase = {
  experimentId: "flex", experimentName: "Flame Extinguishment Experiment",
  objective: "Map liquid-fuel flammability limits and investigate gaseous suppression in microgravity.",
  platform: "International Space Station", apparatus: "Combustion Integrated Rack / Multi-user Droplet Combustion Apparatus",
  materialCategory: "liquid-droplet", fuel: "Liquid fuel droplets",
  conditions: [{ label: "Environment", value: "Microgravity aboard the ISS", role: "reported-condition" }],
  context: { runId: null, stage: "investigation", gravity: "microgravity", pressurePa: null, gasComposition: null, flow: null, support: null },
  source: psiSource, measurement: null, availability: "document-only",
  missingParameters: ["Matched trial-level conditions", "Measurement uncertainty"],
  limitations: ["Investigation objectives are not measured outcomes or operational safety limits."],
} satisfies Partial<Evidence>;
const runBase = {
  ...flexBase, fuel: "Methanol", source: plotSource, availability: "published-run-summary",
  conditions: [
    { label: "Fuel", value: "Methanol · FLEX-145 / C01M201", role: "reported-condition" },
    { label: "Pressure", value: "763.468 mmHg · plot annotation", role: "reported-condition" },
    { label: "Gas composition", value: "Reported fractions: O₂ 0.199 / N₂ 0.749 / CO₂ 0.050 / He 0.000", role: "reported-condition" },
    { label: "Unresolved source conflict", value: "Slide 9 reverses the reported N₂ and CO₂ percentages; see both slide locators.", role: "reported-condition" },
  ],
  context: { runId: "FLEX-145", stage: "whole-run", gravity: "microgravity", pressurePa: 763.468 * 101325 / 760, gasComposition: "O2=.199;N2=.749;CO2=.050;He=.000 (reported, not renormalized)", flow: null, support: null },
  missingParameters: ["Uncertainty for the transcribed values", "Run-specific flow", "Droplet support configuration", "Raw time series"],
  limitations: [
    `Slides 9 and 10 both identify FLEX-145 and methanol at about 1 atm and 20% O₂, but conflict: slide 9 reports D₀ = 3.38 mm, Dext = 1.66 (unit not repeated), K = 0.44 m²/s, and 75% CO₂ / 5% N₂; slide 10's FLEX-145 / C01M201 inset reports D₀ = 3.330 mm, Dext = 1.613 mm, Kavg = 0.448 mm²/s, and N₂ 0.749 / CO₂ 0.050. The source does not identify a correction; do not treat either set as a resolved canonical value.`,
    "Reported gas fractions are retained as printed, without renormalizing. Pressure conversion to Pa is derived using 101325 Pa / 760 mmHg.",
    "One run is not a flammability limit. The archival video is not identified as FLEX-145 and is not synchronized with these values.",
  ],
} satisfies Partial<Evidence>;

export const evidenceRecords: Evidence[] = corpusSchema.parse([
  { ...bassBase, id: "BASS-SETUP", title: "Solid-fuel experimental conditions", summary: "BASS-II varied the air and the solid sample to study burning in the ISS glovebox.", finding: "Oxygen, ventilation and sample geometry were varied; cameras and gas analyzers recorded the experiments.", topics: ["solid", "oxygen", "ventilation", "airflow", "geometry", "nitrogen", "conditions", "objective"], evidenceType: "experiment-description" },
  { ...bassBase, id: "BASS-HEAT", title: "Heat release inferred from oxygen consumption", summary: "Most tests released heat at rates well below 100 W, according to the report's calculation.", finding: "Heat-release rates were calculated from oxygen consumption and burn duration. Most were well below 100 W; this is an aggregate bound, not a trial measurement.", topics: ["heat", "release", "oxygen", "calorimetry", "power", "derived"], evidenceType: "qualitative-finding", limitations: [...bassBase.limitations, "The 100 W bound is not stored as an exact measured scalar. The calculation uses an assumed energy-per-oxygen conversion."] },
  { ...bassBase, id: "BASS-GASES", title: "Combustion-product trends depend on conditions", summary: "Carbon monoxide and carbon dioxide did not follow one universal trend across all tests.", finding: "CO versus CO₂ showed a linear trend for some datasets, but not across every fuel geometry and flow. Gas readings were taken before and after each test.", topics: ["carbon", "monoxide", "dioxide", "co", "co2", "products", "geometry", "flow"], evidenceType: "qualitative-finding" },
  { ...bassBase, id: "BASS-RATIO", title: "Estimated mean global equivalence ratio", summary: "The report estimates that the tests were fuel-rich on average.", finding: "The report estimates an average global equivalence ratio of 1.3 using mass loss and oxygen consumption.", topics: ["equivalence", "ratio", "rich", "mass", "oxygen"], evidenceType: "derived-result", measurement: { quantity: "equivalence-ratio", value: 1.3, unit: "1", kind: "derived", statistic: "aggregate-mean", method: "Estimate from mass loss and oxygen consumption, as described in the abstract", uncertainty: null, uncertaintyNote: "No uncertainty or sample count is supplied for this mean in the abstract." } },
  { ...flexBase, id: "FLEX-OBJECTIVE", title: "Liquid-fuel extinction and suppressant research", summary: "FLEX studies when liquid droplets stop burning and how gases affect that limit.", finding: "PSI describes mapping liquid-fuel flammability limits and studying gaseous suppressants including CO₂, helium and SF₆. These are research objectives, not ranked suppressant performance results.", topics: ["objective", "suppression", "suppressant", "oxygen", "pressure", "liquid", "droplet", "flammability", "limits", "helium", "co2", "sf6"], evidenceType: "experiment-description", conditions: [...flexBase.conditions, { label: "Planned pressure range", value: "0.5–1.5 atm in the described LOI procedure; protocol, not a measured trial", role: "protocol" }], limitations: [...flexBase.limitations, "PSI notes that some extinction diameters were too small for the diagnostics. Slow-flow hardware did not provide adequate diagnostics over the entire test."] },
  { ...flexBase, id: "FLEX-COOL", title: "Combustion continuing after visible flame extinction", summary: "NASA's recording shows fuel continuing to burn after the bright flame goes out.", finding: "NASA SVS describes a cool-flame stage under certain conditions and provides a recording of continued burning after the visible flame is extinguished.", topics: ["cool", "flame", "extinction", "invisible", "visible", "video", "footage", "spherical"], evidenceType: "media-observation", source: svsSource, availability: "archival-media", limitations: ["The media page does not identify this recording's run, fuel, oxygen fraction or pressure. It must not be assigned the FLEX-145 conditions.", "Footage is not calibrated temperature or droplet-diameter telemetry."], missingParameters: ["Video run identifier", "Video fuel", "Video pressure and gas mixture", "Calibrated measurements"] },
  { ...runBase, id: "FLEX-145-INITIAL", title: "FLEX-145 initial droplet diameter · source conflict", summary: "Slide 10 labels D₀ as 3.330 mm; slide 9 gives 3.38 mm for FLEX-145. The source does not resolve the difference.", finding: "Slide 10's FLEX-145 plot inset reports D₀ = 3.330 mm; slide 9 also labels FLEX-145 and reports D₀ = 3.38 mm. Neither is established as a correction to the other.", topics: ["methanol", "droplet", "diameter", "initial", "size", "pressure", "oxygen", "source conflict"], evidenceType: "measurement", context: { ...runBase.context, stage: "initial" }, measurement: { quantity: "droplet-diameter", value: 3.330, unit: "mm", kind: "measured", statistic: "single-run", method: "Slide 10 plot inset annotation; conflicts with slide 9 summary; not independently reprocessed", uncertainty: null, uncertaintyNote: "No uncertainty is printed; slide 9 reports a different value and no correction is identified." } },
  { ...runBase, id: "FLEX-145-EXTINCTION", title: "FLEX-145 droplet diameter at extinction · source conflict", summary: "Slide 10 labels Dext as 1.613 mm; slide 9 gives 1.66 (unit not repeated) for FLEX-145. The source does not resolve the difference.", finding: "Slide 10's FLEX-145 plot inset reports Dext = 1.613 mm; slide 9 also labels FLEX-145 and reports Dext = 1.66 without repeating a unit. Neither is established as a correction to the other.", topics: ["methanol", "droplet", "diameter", "extinction", "finite", "size", "oxygen", "source conflict"], evidenceType: "measurement", context: { ...runBase.context, stage: "extinction" }, measurement: { quantity: "droplet-diameter", value: 1.613, unit: "mm", kind: "measured", statistic: "single-run", method: "Slide 10 plot inset annotation; conflicts with slide 9 summary; not independently reprocessed", uncertainty: null, uncertaintyNote: "No uncertainty is printed; slide 9 reports a different value and no correction is identified." } },
  { ...runBase, id: "FLEX-145-RATE", title: "FLEX-145 average burning-rate constant · source conflict", summary: "Slide 10 labels Kavg as 0.448 mm²/s; slide 9 lists 0.44 m²/s. The value and units conflict.", finding: "Slide 10 annotates Kavg = 0.448 mm²/s; slide 9 lists K = 0.44 m²/s for FLEX-145. The source does not explain the value or unit difference. This is a derived burning-rate quantity, not droplet velocity or heat-release rate.", topics: ["methanol", "burning", "rate", "constant", "average", "regression", "source conflict"], evidenceType: "derived-result", measurement: { quantity: "burning-rate-constant", value: .448, unit: "mm²/s", kind: "derived", statistic: "single-run", method: "Slide 10's published average burning-rate constant from droplet-history analysis; slide 9 conflicts; fitting interval not specified", uncertainty: null, uncertaintyNote: "No uncertainty or fitting interval is supplied; slide 9 lists a conflicting value and unit." } },
]);

export function recordsForExperiment(id: Evidence["experimentId"]) {
  return evidenceRecords.filter((record) => record.experimentId === id);
}
export const sourceVerification = [
  { url: "https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/", status: "unavailable", note: "Returned HTTP 502 during verification. No scientific claims extracted." },
  { url: "https://psi.nasa.gov/", status: "verified", note: "Repository entry point; investigation claims come from PSI-69, not the home page." },
  ...[bassSource, psiSource, svsSource, plotSource].map((source) => ({ url: source.url, status: "verified", note: source.locator })),
  { url: flexTestSource.url, status: "verified", note: `${flexTestSource.table}, printed page ${flexTestSource.printedPage}; 30 individual rows transcribed.` },
];
