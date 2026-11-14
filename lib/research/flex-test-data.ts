import { z } from "zod";

const source = {
  documentId: "NASA/TP-2015-216046",
  ntrsId: "20150023456",
  title: "Detailed Results From the Flame Extinguishment Experiment (FLEX), March 2009 to December 2011",
  url: "https://ntrs.nasa.gov/api/citations/20150023456/downloads/20150023456.pdf",
  table: "Appendix A, Table IX — Results by Test Number and FLEX Identifier",
  printedPage: 20,
} as const;

const fraction = z.number().finite().min(0).max(1);
const nonnegative = z.number().finite().nonnegative();
const flexTestSchema = z.object({
  recordType: z.literal("individual-nasa-test"),
  testNumber: z.number().int().positive(),
  testId: z.string().regex(/^FLEX-\d{3}$/),
  flexIdentifier: z.string().trim().min(1),
  testDateReported: z.string().regex(/^\d{1,2}\/\d{1,2}\/\d{2}$/),
  testTimeGmt: z.string().regex(/^\d{1,2}:\d{2}:\d{2}$/).nullable(),
  fuel: z.enum(["Methanol", "Heptane"]),
  ambientPressure: z.object({ value: z.number().finite().positive(), unit: z.literal("mmHg") }).strict(),
  ambientComposition: z.object({
    o2: fraction, n2: fraction, co2: fraction, he: fraction,
    unit: z.literal("mole fraction"),
  }).strict(),
  initialDropletDiameter: z.object({ value: nonnegative, unit: z.literal("mm") }).strict().nullable(),
  visibleFlameExtinctionDiameter: z.object({ value: nonnegative, unit: z.literal("mm") }).strict().nullable(),
  averageBurningRateConstant: z.object({ value: nonnegative, unit: z.literal("mm²/s") }).strict().nullable(),
  burnTime: z.object({ value: nonnegative, unit: z.literal("s") }).strict().nullable(),
  terminationCategory: z.enum(["Disruption", "Extinction", "Completion"]),
  provenance: z.object({
    sourceDocumentId: z.literal(source.documentId),
    ntrsId: z.literal(source.ntrsId),
    sourceUrl: z.url(),
    table: z.literal(source.table),
    printedPage: z.literal(source.printedPage),
    row: z.string().regex(/^FLEX-\d{3}$/),
    valueProvenance: z.literal("Source-reported values transcribed from the individual test summary row."),
    fields: z.object({
      identifiersAndDate: z.literal("source-reported"),
      fuel: z.literal("source-reported"),
      ambientPressureAndComposition: z.literal("source-reported-condition"),
      initialDropletDiameter: z.literal("source-reported-measurement"),
      visibleFlameExtinctionDiameter: z.literal("source-reported-measurement-or-estimate"),
      averageBurningRateConstant: z.literal("source-reported-derived-average"),
      burnTimeAndTermination: z.literal("source-reported-test-summary"),
    }).strict(),
  }).strict(),
  missingData: z.array(z.object({
    field: z.enum(["testTimeGmt", "initialDropletDiameter", "visibleFlameExtinctionDiameter", "averageBurningRateConstant", "burnTime"]),
    sourceMarker: z.literal("–"),
    status: z.literal("not-reported"),
    interpretation: z.string().trim().min(1),
  }).strict()),
  qualifiers: z.array(z.string().trim().min(1)),
}).strict().superRefine((record, ctx) => {
  const total = record.ambientComposition.o2 + record.ambientComposition.n2 + record.ambientComposition.co2 + record.ambientComposition.he;
  if (total > 1.001) ctx.addIssue({ code: "custom", message: "Reported ambient mole fractions exceed one" });
  if (record.provenance.row !== record.testId) ctx.addIssue({ code: "custom", message: "Source row and FLEX test ID must agree" });
  const nullableFields = [
    ["testTimeGmt", record.testTimeGmt],
    ["initialDropletDiameter", record.initialDropletDiameter],
    ["visibleFlameExtinctionDiameter", record.visibleFlameExtinctionDiameter],
    ["averageBurningRateConstant", record.averageBurningRateConstant],
    ["burnTime", record.burnTime],
  ] as const;
  const nullFields = nullableFields.filter(([, value]) => value === null).map(([field]) => field).sort();
  const missingFields = record.missingData.map(({ field }) => field).sort();
  if (new Set(missingFields).size !== missingFields.length || nullFields.join("|") !== missingFields.join("|")) {
    ctx.addIssue({ code: "custom", message: "Missing-data markers must match nullable source fields exactly" });
  }
});

type RawRow = readonly [
  number, string, string, string | null, "Methanol" | "Heptane", number,
  number, number, number, number, number | null, number | null, number | null,
  number | null, "Disruption" | "Extinction" | "Completion",
];

// Table IX columns in order: test, FLEX identifier, date, GMT, fuel, pressure,
// O2, N2, CO2, He, initial diameter, visible-extinction diameter, average rate,
// burn time, and test end. Original units and printed date forms are retained.
const rawRows: readonly RawRow[] = [
  [1,"20CAL08","3/5/09","17:22:03","Methanol",757.7,.21,.79,0,0,1.69,.89,.52,4.3,"Disruption"],
  [2,"20CAL10","3/5/09","19:20:06","Methanol",762,.21,.79,0,0,1.86,.94,.6,5,"Extinction"],
  [3,"20CAL12","3/5/09","21:17:46","Methanol",764.2,.21,.79,0,0,1.61,.92,.58,3.2,"Extinction"],
  [4,"30CAL02","3/31/09","17:16:18","Methanol",760,.21,.79,0,0,2.06,null,.6,7.64,"Extinction"],
  [5,"30CAL03","3/31/09","19:00:48","Methanol",760,.21,.79,0,0,1.92,.81,.48,6.34,"Extinction"],
  [6,"40CAL01","3/31/09","20:05:49","Methanol",760,.21,.79,0,0,2.54,1.53,.51,9.6,"Extinction"],
  [7,"20CAL13","4/10/09","13:26:11","Heptane",761.3,.21,.79,0,0,1.87,null,.67,5.3,"Disruption"],
  [8,"30CAL06","4/10/09","18:07:15","Heptane",762.4,.21,.79,0,0,2.95,null,.79,14.8,"Disruption"],
  [9,"30CAL07","4/10/09",null,"Heptane",760,.21,.79,0,0,null,null,null,null,"Disruption"],
  [10,"256F002","5/22/09","14:53:27","Methanol",2319.7,.21,.09,.7,0,3.86,null,.37,13.6,"Extinction"],
  [11,"256R001","5/22/09","15:33:47","Methanol",2318.8,.21,.09,.7,0,3.03,null,.4,16.5,"Extinction"],
  [12,"264F003","5/22/09","19:23:35","Heptane",2319.9,.21,.09,.7,0,2.74,null,null,null,"Disruption"],
  [13,"256R002","6/25/09","15:33:05","Methanol",2074.2,.21,.09,.7,0,2.59,null,.49,10.8,"Extinction"],
  [14,"256F007","6/29/09","12:26:06","Methanol",2055.6,.21,.09,.7,0,3.7,null,null,11.3,"Extinction"],
  [15,"256F008","6/29/09","13:56:06","Methanol",2066.6,.21,.09,.7,0,4.42,null,null,23.1,"Extinction"],
  [16,"256F009","6/29/09","15:34:58","Methanol",2072.1,.21,.09,.7,0,1.66,1,.53,3.4,"Extinction"],
  [17,"240R003","7/1/09","12:28:41","Methanol",1545.7,.21,.09,.7,0,2.67,null,null,2.4,"Disruption"],
  [18,"248F001","7/1/09","16:28:56","Heptane",1553.8,.21,.09,.7,0,2.74,1.77,.61,8.1,"Extinction"],
  [19,"196F001","8/26/09","19:07:28","Heptane",539.1,.34,.66,0,0,3.39,null,.9,4.2,"Disruption"],
  [20,"192F001","10/24/09","14:09:04","Methanol",539.5,.34,.66,0,0,3.4,1.56,.53,17.4,"Completion"],
  [21,"192F002","10/24/09","15:15:24","Methanol",540.6,.34,.66,0,0,3.49,.95,.66,17.8,"Disruption"],
  [22,"192F003","10/24/09","15:39:48","Methanol",540.5,.34,.66,0,0,3.5,null,.65,18.2,"Disruption"],
  [23,"196F002","10/24/09","18:29:53","Heptane",541.8,.34,.66,0,0,3.01,null,.73,13.1,"Disruption"],
  [24,"196F003","10/24/09","19:44:04","Heptane",542.8,.34,.66,0,0,null,null,null,null,"Disruption"],
  [25,"191R001","11/9/09","11:42:23","Methanol",537.3,.3,.7,0,0,2.6,.59,.65,10.3,"Completion"],
  [26,"191F001","11/9/09","11:59:59","Methanol",538.4,.3,.7,0,0,3.63,.4,.62,22.2,"Disruption"],
  [27,"195F001","11/9/09","14:04:11","Heptane",540.7,.3,.7,0,0,3.87,null,.64,23.8,"Disruption"],
  [28,"195F002","11/9/09","14:56:05","Heptane",539.7,.3,.7,0,0,3.36,null,.64,17.3,"Disruption"],
  [29,"178R001","11/13/09","13:11:23","Methanol",766.9,.3,.7,0,0,2.57,null,.74,10.4,"Completion"],
  [30,"178F001","11/13/09","14:03:46","Methanol",769.2,.3,.7,0,0,3.26,1.32,.59,15.6,"Extinction"],
];

const fieldFor = (value: number | string | null, field: string) => value === null ? {
  field,
  sourceMarker: "–" as const,
  status: "not-reported" as const,
  interpretation: field === "visibleFlameExtinctionDiameter"
    ? "NASA explains that a dash can indicate no visible-flame extinction before completion/disruption, or an unavailable estimate when image history was insufficient; the row-specific reason is not assigned here."
    : "The table prints a dash; no value is inferred or replaced with zero.",
} : null;

const records = rawRows.map(([testNumber, flexIdentifier, testDateReported, testTimeGmt, fuel, pressure, o2, n2, co2, he, initial, extinction, rate, burnTime, terminationCategory]) => {
  const testId = `FLEX-${String(testNumber).padStart(3, "0")}`;
  const missingData = [
    fieldFor(testTimeGmt, "testTimeGmt"), fieldFor(initial, "initialDropletDiameter"),
    fieldFor(extinction, "visibleFlameExtinctionDiameter"), fieldFor(rate, "averageBurningRateConstant"),
    fieldFor(burnTime, "burnTime"),
  ].filter((missing): missing is NonNullable<typeof missing> => missing !== null);
  return {
    recordType: "individual-nasa-test" as const,
    testNumber, testId, flexIdentifier, testDateReported, testTimeGmt, fuel,
    ambientPressure: { value: pressure, unit: "mmHg" as const },
    ambientComposition: { o2, n2, co2, he, unit: "mole fraction" as const },
    initialDropletDiameter: initial === null ? null : { value: initial, unit: "mm" as const },
    visibleFlameExtinctionDiameter: extinction === null ? null : { value: extinction, unit: "mm" as const },
    averageBurningRateConstant: rate === null ? null : { value: rate, unit: "mm²/s" as const },
    burnTime: burnTime === null ? null : { value: burnTime, unit: "s" as const },
    terminationCategory,
    provenance: {
      sourceDocumentId: source.documentId, ntrsId: source.ntrsId, sourceUrl: source.url,
      table: source.table, printedPage: source.printedPage, row: testId,
      valueProvenance: "Source-reported values transcribed from the individual test summary row.",
      fields: {
        identifiersAndDate: "source-reported", fuel: "source-reported",
        ambientPressureAndComposition: "source-reported-condition",
        initialDropletDiameter: "source-reported-measurement",
        visibleFlameExtinctionDiameter: "source-reported-measurement-or-estimate",
        averageBurningRateConstant: "source-reported-derived-average",
        burnTimeAndTermination: "source-reported-test-summary",
      },
    },
    missingData,
    qualifiers: [
      "Burning rate is an average burning-rate constant from a linear fit of droplet diameter squared versus time; it is not an instantaneous measurement.",
      ...(extinction === null ? ["The report gives multiple possible meanings for a missing visible-flame extinction diameter; this record does not infer which applies to this test."] : []),
      "The table is a summary of individual tests, not a complete combustion time history; no uncertainty is supplied in these columns.",
    ],
  };
});

export const flexTestRecordsSchema = z.array(flexTestSchema)
  .min(1)
  .refine((rows) => new Set(rows.map((row) => row.testId)).size === rows.length, "FLEX test IDs must be unique")
  .refine((rows) => new Set(rows.map((row) => row.flexIdentifier)).size === rows.length, "FLEX engineering identifiers must be unique");
export const flexTestRecords = flexTestRecordsSchema.parse(records);

export type FlexTestRecord = (typeof flexTestRecords)[number];
export const flexTestSource = source;
export const flexTestRecordCount = flexTestRecords.length;
